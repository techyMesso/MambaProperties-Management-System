import { API_RESPONSES } from '@/libs/api/apiResponses'
import { safeQuery } from '@/libs/api/safeQuery'
import { requireAdminContext } from '@/app/api/admin/_lib/requireAdminContext'
import { isKycDecisionStatus, mapKycDocumentRow, syncLandlordKycStatus } from '@/libs/landlord/kyc'
import { toText, tryAuditLog } from '@/libs/admin/transforms'

const resolveRouteParams = async params => (params ? await params : {})

export async function POST(request, { params }) {
  const context = await requireAdminContext(request, { enforceMutationOrigin: true })

  if (context.error) {
    return context.error
  }

  const { adminSupabase, user } = context
  const routeParams = await resolveRouteParams(params)
  const docId = toText(routeParams?.docId)

  if (!docId) {
    return API_RESPONSES.badRequest(request, 'Document ID is required.')
  }

  let body

  try {
    body = await request.json()
  } catch {
    return API_RESPONSES.badRequest(request, 'Invalid JSON payload.')
  }

  const decision = toText(body?.decision || '').toLowerCase()
  const notes = toText(body?.notes || '')

  if (!isKycDecisionStatus(decision)) {
    return API_RESPONSES.badRequest(request, 'Decision must be pending, approved, rejected, or resubmit.')
  }

  const currentResult = await safeQuery(
    adminSupabase
      .from('landlord_documents')
      .select('id,landlord_id,document_type,file_path,file_name,file_size,mime_type,verification_status,verified_by,verified_at,rejection_reason,verification_notes,created_at,updated_at')
      .eq('id', docId)
      .maybeSingle()
  )

  if (currentResult.error) {
    return API_RESPONSES.badRequest(request, currentResult.error.message || 'Unable to load KYC document.')
  }

  if (!currentResult.data) {
    return API_RESPONSES.notFound(request, 'KYC document not found.')
  }

  const updatePayload = {
    verification_status: decision,
    verification_notes: notes || null,
    verified_by: decision === 'approved' ? user.id : null,
    verified_at: decision === 'approved' ? new Date().toISOString() : null,
    rejection_reason: decision === 'approved' ? null : notes || null
  }

  const updateResult = await safeQuery(
    adminSupabase
      .from('landlord_documents')
      .update(updatePayload)
      .eq('id', docId)
      .select('id,landlord_id,document_type,file_path,file_name,file_size,mime_type,verification_status,verified_by,verified_at,rejection_reason,verification_notes,created_at,updated_at')
      .maybeSingle()
  )

  if (updateResult.error) {
    return API_RESPONSES.badRequest(request, updateResult.error.message || 'Unable to update KYC document.')
  }

  const kycStatus = await syncLandlordKycStatus({
    supabase: adminSupabase,
    landlordId: currentResult.data.landlord_id
  })

  await tryAuditLog({
    supabase: adminSupabase,
    user,
    entity: `KYC Document ${docId}`,
    action: `KYC document ${decision}`,
    status: 'completed',
    note: notes || null
  })

  return API_RESPONSES.ok(request, {
    document: mapKycDocumentRow(updateResult.data),
    kycVerified: kycStatus.kycVerified,
    message: `KYC document marked as ${decision}.`
  })
}
