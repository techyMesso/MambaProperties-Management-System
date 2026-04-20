import { API_RESPONSES } from '@/libs/api/apiResponses'
import { safeQuery } from '@/libs/api/safeQuery'
import { resolveUserRole } from '@/libs/auth/resolveRole'
import { USER_ROLES } from '@/libs/auth/roles'
import { createClient as createServerSupabaseClient } from '@/libs/supabase/server'

const REVIEWABLE_ROLES = new Set([USER_ROLES.LANDLORD, USER_ROLES.ADMIN])

const toAmount = value => {
  const parsed = Number(value)

  return Number.isFinite(parsed) ? parsed : 0
}

const toMetadata = value => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {}
  }

  return value
}

const normalizeStatus = value => String(value || '').trim().toLowerCase()

export async function GET(request) {
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

  const statusFilter = String(request.nextUrl.searchParams.get('status') || '').trim().toLowerCase()
  const adminOwnerId = String(request.nextUrl.searchParams.get('ownerId') || '').trim()
  const ownerId = role === USER_ROLES.ADMIN ? adminOwnerId || user.id : user.id

  let documentsQuery = supabase
    .from('documents')
    .select('id,doc_id,type,owner_name,uploaded,status,file_path,created_at')
    .eq('owner_id', ownerId)
    .ilike('type', '%payment proof%')
    .order('created_at', { ascending: false })
    .limit(100)

  if (statusFilter && statusFilter !== 'all') {
    documentsQuery = documentsQuery.eq('status', statusFilter)
  }

  const [documentResult, paymentResult] = await Promise.all([
    safeQuery(documentsQuery, { fallbackData: [] }),
    safeQuery(
      supabase
        .from('payments')
        .select('id,receipt_no,channel,amount,status,metadata,created_at')
        .eq('owner_id', ownerId)
        .order('created_at', { ascending: false })
        .limit(500),
      { fallbackData: [] }
    )
  ])

  if (documentResult.error) {
    return API_RESPONSES.badRequest(request, documentResult.error.message || 'Unable to load payment proofs.')
  }

  if (paymentResult.error) {
    return API_RESPONSES.badRequest(request, paymentResult.error.message || 'Unable to load payment records for proof matching.')
  }

  const byProofPath = new Map()

  ;(paymentResult.data || []).forEach(row => {
    const metadata = toMetadata(row?.metadata)
    const proofPath = String(metadata?.proof_path || '').trim()

    if (!proofPath || byProofPath.has(proofPath)) {
      return
    }

    byProofPath.set(proofPath, {
      paymentId: row.id,
      receiptNo: row.receipt_no || null,
      channel: row.channel || null,
      amount: toAmount(row.amount),
      status: row.status || null,
      createdAt: row.created_at || null,
      method: String(metadata?.method || '').trim() || null
    })
  })

  const proofs = (documentResult.data || []).map(row => {
    const paymentMatch = byProofPath.get(String(row.file_path || '').trim()) || null

    return {
      id: row.id,
      docId: row.doc_id || null,
      tenantName: row.owner_name || 'Tenant',
      type: row.type || 'Tenant Payment Proof',
      status: row.status || 'pending review',
      uploaded: row.uploaded || null,
      createdAt: row.created_at || null,
      filePath: row.file_path || null,
      payment: paymentMatch
    }
  })

  const summary = proofs.reduce(
    (acc, item) => {
      const status = normalizeStatus(item.status)

      if (status === 'approved') {
        acc.approved += 1
      } else if (status === 'rejected') {
        acc.rejected += 1
      } else {
        acc.pending += 1
      }

      return acc
    },
    {
      pending: 0,
      approved: 0,
      rejected: 0
    }
  )

  return API_RESPONSES.ok(
    request,
    {
      ownerId,
      proofs,
      summary
    },
    {
      headers: {
        'Cache-Control': 'private, max-age=0, must-revalidate'
      }
    }
  )
}
