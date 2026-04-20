import { API_RESPONSES } from '@/libs/api/apiResponses'
import { safeQuery } from '@/libs/api/safeQuery'
import { requireAdminContext } from '@/app/api/admin/_lib/requireAdminContext'
import { toText, tryAuditLog } from '@/libs/admin/transforms'

export async function POST(request, { params }) {
  const context = await requireAdminContext(request, { enforceMutationOrigin: true })

  if (context.error) {
    return context.error
  }

  const { adminSupabase, user } = context
  const plotId = toText((await params).plotId)

  if (!plotId) {
    return API_RESPONSES.badRequest(request, 'Plot ID is required.')
  }

  let body

  try {
    body = await request.json()
  } catch {
    return API_RESPONSES.badRequest(request, 'Invalid JSON payload.')
  }

  const decision = toText(body?.decision).toLowerCase()
  const notes = toText(body?.notes || '')
  const ownershipVerified = body?.ownershipVerified === true

  if (!['approve', 'reject'].includes(decision)) {
    return API_RESPONSES.badRequest(request, 'Decision must be approve or reject.')
  }

  if (decision === 'approve' && !ownershipVerified) {
    return API_RESPONSES.badRequest(request, 'Ownership verification must be confirmed before plot approval.')
  }

  try {
    // Fetch plot
    const plotResult = await safeQuery(adminSupabase.from('plots').select('*').eq('id', plotId).maybeSingle())

    if (plotResult.error) {
      return API_RESPONSES.badRequest(request, plotResult.error.message)
    }

    if (!plotResult.data) {
      return API_RESPONSES.notFound(request, 'Plot not found.')
    }

    // Update plot
    const payload = {
      approval_status: decision === 'approve' ? 'approved' : 'rejected',
      approved_by: user.id,
      approved_at: new Date().toISOString(),
      approval_notes: notes,
      ownership_verified: decision === 'approve' && ownershipVerified,
      listed_at: decision === 'approve' ? new Date().toISOString() : null,
      updated_at: new Date().toISOString()
    }

    const updatedResult = await safeQuery(
      adminSupabase.from('plots').update(payload).eq('id', plotId).select().maybeSingle()
    )

    if (updatedResult.error) {
      return API_RESPONSES.badRequest(request, updatedResult.error.message)
    }

    // Log audit
    await tryAuditLog({
      supabase: adminSupabase,
      user,
      entity: `Plot ${plotId}`,
      action: `Plot ${decision}ed`,
      status: 'completed',
      note: notes
    })

    // TODO: Send notification email to landlord

    return API_RESPONSES.ok(request, {
      id: updatedResult.data?.id,
      name: updatedResult.data?.plot_name || updatedResult.data?.plot_number,
      status: updatedResult.data?.approval_status,
      message: `Plot ${decision}ed successfully.`
    })
  } catch (error) {
    return API_RESPONSES.internal(request, error.message)
  }
}
