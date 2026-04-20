import { API_RESPONSES } from '@/libs/api/apiResponses'
import { safeQuery } from '@/libs/api/safeQuery'
import { requireAdminContext } from '@/app/api/admin/_lib/requireAdminContext'
import { queueUserNotifications } from '@/libs/notifications/queue'
import { normalizeDecision, toText, tryAuditLog } from '@/libs/admin/transforms'

const DECISION_MAP = {
  approve: 'approved',
  approved: 'approved',
  reject: 'rejected',
  rejected: 'rejected'
}

const resolveRouteParams = async params => (params ? await params : {})

const applyRoleApprovalUpdates = (requestedRole, adminId) => {
  const updates = {
    role: requestedRole,
    requested_role: null,
    updated_at: new Date().toISOString()
  }

  if (requestedRole === 'landlord' || requestedRole === 'agent') {
    Object.assign(updates, {
      approval_status: 'pending',
      approved_by: null,
      approved_at: null,
      approval_notes: null,
      kyc_verified: false,
      kyc_verified_at: null,
      kyc_verification_notes: null
    })
  } else if (requestedRole === 'admin') {
    updates.approved_by = adminId
  }

  return updates
}

const loadAuthMetadata = async (adminSupabase, userId) => {
  try {
    const authResult = await adminSupabase.auth.admin.getUserById(userId)

    return {
      appMetadata: authResult?.data?.user?.app_metadata || {},
      userMetadata: authResult?.data?.user?.user_metadata || {}
    }
  } catch {
    return {
      appMetadata: {},
      userMetadata: {}
    }
  }
}

export async function POST(request, { params }) {
  const context = await requireAdminContext(request, { enforceMutationOrigin: true })

  if (context.error) {
    return context.error
  }

  const { adminSupabase, user } = context
  const routeParams = await resolveRouteParams(params)
  const userId = toText(routeParams?.userId)

  if (!userId) {
    return API_RESPONSES.badRequest(request, 'User ID is required.')
  }

  let body

  try {
    body = await request.json()
  } catch {
    return API_RESPONSES.badRequest(request, 'Invalid JSON payload.')
  }

  const decision = normalizeDecision(body?.decision)
  const decisionStatus = DECISION_MAP[decision]
  const notes = toText(body?.notes || '')

  if (!decisionStatus) {
    return API_RESPONSES.badRequest(request, 'Decision must be approve or reject.')
  }

  try {
    const profileResult = await safeQuery(
      adminSupabase.from('profiles').select('id,full_name,role,requested_role,approval_status').eq('id', userId).maybeSingle()
    )

    if (profileResult.error) {
      return API_RESPONSES.badRequest(request, profileResult.error.message)
    }

    if (!profileResult.data) {
      return API_RESPONSES.notFound(request, 'User profile not found.')
    }

    const requestedRole = toText(profileResult.data.requested_role)
    const currentRole = toText(profileResult.data.role)

    if (!requestedRole || requestedRole === currentRole) {
      return API_RESPONSES.badRequest(request, 'No pending role request for this user.')
    }

    const updates =
      decisionStatus === 'approved'
        ? applyRoleApprovalUpdates(requestedRole, user.id)
        : {
            requested_role: null,
            updated_at: new Date().toISOString()
          }

    const updatedResult = await safeQuery(
      adminSupabase.from('profiles').update(updates).eq('id', userId).select('id,role,requested_role,approval_status').maybeSingle()
    )

    if (updatedResult.error) {
      return API_RESPONSES.badRequest(request, updatedResult.error.message)
    }

    const authMetadata = await loadAuthMetadata(adminSupabase, userId)

    if (decisionStatus === 'approved') {
      try {
        await adminSupabase.auth.admin.updateUserById(userId, {
          app_metadata: {
            ...authMetadata.appMetadata,
            role: requestedRole
          },
          user_metadata: {
            ...authMetadata.userMetadata,
            requested_role: null
          }
        })
      } catch {
        // Auth metadata sync is best effort.
      }
    } else {
      try {
        await adminSupabase.auth.admin.updateUserById(userId, {
          user_metadata: {
            ...authMetadata.userMetadata,
            requested_role: null
          }
        })
      } catch {
        // Auth metadata sync is best effort.
      }
    }

    await tryAuditLog({
      supabase: adminSupabase,
      user,
      entity: `User ${userId}`,
      action: `Role request ${decisionStatus}`,
      status: 'completed',
      note: notes || null
    })

    const roleDecisionMessage =
      decisionStatus === 'approved'
        ? `Your request to switch to ${requestedRole} has been approved.`
        : `Your request to switch to ${requestedRole} was not approved.`

    await queueUserNotifications({
      supabase: adminSupabase,
      ownerId: userId,
      recipientUserId: userId,
      subject: 'Mamba Properties Role Request Update',
      message: notes ? `${roleDecisionMessage} Notes: ${notes}` : roleDecisionMessage,
      channels: ['sms', 'email']
    })

    return API_RESPONSES.ok(request, {
      id: updatedResult.data?.id,
      role: updatedResult.data?.role,
      approvalStatus: updatedResult.data?.approval_status,
      message: `Role request ${decisionStatus}.`
    })
  } catch (error) {
    return API_RESPONSES.internal(request, error.message)
  }
}
