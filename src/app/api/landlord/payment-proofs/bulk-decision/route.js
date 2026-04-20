import { API_RESPONSES } from '@/libs/api/apiResponses'
import { safeQuery } from '@/libs/api/safeQuery'
import { resolveUserRole } from '@/libs/auth/resolveRole'
import { USER_ROLES } from '@/libs/auth/roles'
import { enforceSameOriginMutation } from '@/libs/security/requestGuards'
import { createClient as createServerSupabaseClient } from '@/libs/supabase/server'

const REVIEWABLE_ROLES = new Set([USER_ROLES.LANDLORD, USER_ROLES.ADMIN])

const DECISION_TO_STATUS = {
  approve: 'approved',
  approved: 'approved',
  reject: 'rejected',
  rejected: 'rejected'
}

const toMetadata = value => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {}
  }

  return value
}

const normalizeDocIds = value => {
  if (!Array.isArray(value)) {
    return []
  }

  return [...new Set(value.map(item => String(item || '').trim()).filter(Boolean))].slice(0, 200)
}

const fetchPaymentsForProof = async ({ supabase, ownerId, proofPath }) => {
  const byPath = await safeQuery(
    supabase
      .from('payments')
      .select('id,metadata,status')
      .eq('owner_id', ownerId)
      .eq('metadata->>proof_path', proofPath)
      .limit(100),
    { fallbackData: [] }
  )

  if (!byPath.error) {
    return byPath.data || []
  }

  const fallback = await safeQuery(
    supabase
      .from('payments')
      .select('id,metadata,status')
      .eq('owner_id', ownerId)
      .order('created_at', { ascending: false })
      .limit(500),
    { fallbackData: [] }
  )

  if (fallback.error) {
    throw new Error(fallback.error.message || 'Unable to load payment records for proof review.')
  }

  return (fallback.data || []).filter(row => String(toMetadata(row?.metadata)?.proof_path || '').trim() === proofPath)
}

export async function POST(request) {
  const originError = enforceSameOriginMutation(request)

  if (originError) {
    return originError
  }

  const supabase = await createServerSupabaseClient()

  if (!supabase) {
    return API_RESPONSES.unavailable(request, 'Supabase is not configured.')
  }

  const {
    data: { user }
  } = await supabase.auth.getUser()

  if (!user?.id) {
    return API_RESPONSES.unauthorized(request)
  }

  const role = await resolveUserRole(supabase, user)

  if (!REVIEWABLE_ROLES.has(role)) {
    return API_RESPONSES.forbidden(request, 'Only landlord or admin accounts can review payment proofs.')
  }

  let body

  try {
    body = await request.json()
  } catch {
    return API_RESPONSES.badRequest(request, 'Invalid JSON payload.')
  }

  const docIds = normalizeDocIds(body?.docIds)
  const decision = String(body?.decision || '').trim().toLowerCase()
  const nextStatus = DECISION_TO_STATUS[decision]
  const adminOwnerId = String(body?.ownerId || '').trim()
  const ownerId = role === USER_ROLES.ADMIN ? adminOwnerId || user.id : user.id

  if (!docIds.length) {
    return API_RESPONSES.badRequest(request, 'docIds must include at least one document id.')
  }

  if (!nextStatus) {
    return API_RESPONSES.badRequest(request, 'decision must be approve or reject.')
  }

  const documentsResult = await safeQuery(
    supabase
      .from('documents')
      .select('id,doc_id,type,status,file_path,owner_id')
      .eq('owner_id', ownerId)
      .in('id', docIds)
      .ilike('type', '%payment proof%'),
    { fallbackData: [] }
  )

  if (documentsResult.error) {
    return API_RESPONSES.badRequest(request, documentsResult.error.message || 'Unable to load proof documents.')
  }

  const documents = documentsResult.data || []

  if (!documents.length) {
    return API_RESPONSES.notFound(request, 'No matching payment proof documents found.')
  }

  const matchedIds = documents.map(row => row.id)

  const updateResult = await safeQuery(
    supabase.from('documents').update({ status: nextStatus }).in('id', matchedIds).select('id,status,file_path'),
    { fallbackData: [] }
  )

  if (updateResult.error) {
    return API_RESPONSES.badRequest(request, updateResult.error.message || 'Unable to update proof statuses.')
  }

  let matchedPayments = 0

  try {
    for (const row of updateResult.data || []) {
      const proofPath = String(row?.file_path || '').trim()

      if (!proofPath) {
        continue
      }

      const payments = await fetchPaymentsForProof({
        supabase,
        ownerId,
        proofPath
      })

      matchedPayments += payments.length

      await Promise.all(
        payments.map(paymentRow => {
          const metadata = toMetadata(paymentRow?.metadata)

          const updatedMetadata = {
            ...metadata,
            proof_review: {
              decision: nextStatus,
              reviewed_by: user.id,
              reviewed_at: new Date().toISOString(),
              document_id: row.id
            }
          }

          return safeQuery(supabase.from('payments').update({ metadata: updatedMetadata }).eq('id', paymentRow.id))
        })
      )
    }
  } catch {
    // Metadata update is best effort and should not block bulk review action.
  }

  return API_RESPONSES.ok(request, {
    status: nextStatus,
    updated: (updateResult.data || []).length,
    matchedPayments
  })
}
