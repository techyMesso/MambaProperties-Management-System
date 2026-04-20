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

const resolveRouteParams = async params => (params ? await params : {})

const toMetadata = value => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {}
  }

  return value
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

export async function POST(request, { params }) {
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

  const decision = String(body?.decision || '').trim().toLowerCase()
  const nextStatus = DECISION_TO_STATUS[decision]
  const adminOwnerId = String(body?.ownerId || '').trim()
  const ownerId = role === USER_ROLES.ADMIN ? adminOwnerId || user.id : user.id
  const routeParams = await resolveRouteParams(params)
  const docId = String(routeParams?.docId || '').trim()

  if (!docId) {
    return API_RESPONSES.badRequest(request, 'Document id is required.')
  }

  if (!nextStatus) {
    return API_RESPONSES.badRequest(request, 'decision must be approve or reject.')
  }

  const proofResult = await safeQuery(
    supabase
      .from('documents')
      .select('id,doc_id,type,status,file_path,owner_id')
      .eq('id', docId)
      .eq('owner_id', ownerId)
      .ilike('type', '%payment proof%')
      .maybeSingle()
  )

  if (proofResult.error) {
    return API_RESPONSES.badRequest(request, proofResult.error.message || 'Unable to load proof document.')
  }

  if (!proofResult.data) {
    return API_RESPONSES.notFound(request, 'Payment proof document not found.')
  }

  const updateResult = await safeQuery(
    supabase.from('documents').update({ status: nextStatus }).eq('id', proofResult.data.id).select('id,status').single()
  )

  if (updateResult.error) {
    return API_RESPONSES.badRequest(request, updateResult.error.message || 'Unable to update proof status.')
  }

  const proofPath = String(proofResult.data.file_path || '').trim()
  let matchedPayments = 0

  if (proofPath) {
    try {
      const payments = await fetchPaymentsForProof({
        supabase,
        ownerId,
        proofPath
      })

      matchedPayments = payments.length

      await Promise.all(
        payments.map(row => {
          const metadata = toMetadata(row?.metadata)

          const updatedMetadata = {
            ...metadata,
            proof_review: {
              decision: nextStatus,
              reviewed_by: user.id,
              reviewed_at: new Date().toISOString(),
              document_id: proofResult.data.id
            }
          }

          return safeQuery(supabase.from('payments').update({ metadata: updatedMetadata }).eq('id', row.id))
        })
      )
    } catch {
      // Metadata update is best effort and should not block review action.
    }
  }

  return API_RESPONSES.ok(request, {
    id: updateResult.data.id,
    status: updateResult.data.status,
    matchedPayments
  })
}
