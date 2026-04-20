import { API_RESPONSES } from '@/libs/api/apiResponses'
import { safeQuery } from '@/libs/api/safeQuery'
import { requireAdminContext } from '@/app/api/admin/_lib/requireAdminContext'
import { queueUserNotifications } from '@/libs/notifications/queue'
import { toText, normalizeDecision, tryAuditLog } from '@/libs/admin/transforms'

const DECISION_MAP = {
  approve: 'approved',
  approved: 'approved',
  reject: 'rejected',
  rejected: 'rejected',
  suspend: 'suspended',
  suspended: 'suspended'
}

const MANAGEMENT_ROLES = new Set(['landlord', 'agent'])

const resolveTargetRole = profile => {
  const requestedRole = toText(profile?.requested_role).toLowerCase()
  const currentRole = toText(profile?.role).toLowerCase()

  if (MANAGEMENT_ROLES.has(requestedRole)) {
    return requestedRole
  }

  if (MANAGEMENT_ROLES.has(currentRole)) {
    return currentRole
  }

  return ''
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

const hasLiveLandlordAccess = async (adminSupabase, userId) => {
  try {
    const { data, error } = await adminSupabase
      .from('landlord_feature_access')
      .select('id,is_active,expires_at')
      .eq('landlord_id', userId)
      .limit(20)

    if (error) {
      return false
    }

    const rows = Array.isArray(data) ? data : []
    const now = new Date()

    return rows.some(item => {
      if (item?.is_active !== true) {
        return false
      }

      if (!item?.expires_at) {
        return true
      }

      return new Date(item.expires_at) > now
    })
  } catch {
    return false
  }
}

export async function POST(request, { params }) {
  const context = await requireAdminContext(request, { enforceMutationOrigin: true })

  if (context.error) {
    return context.error
  }

  const { adminSupabase, user } = context
  const landlordId = toText((await params).landlordId)

  if (!landlordId) {
    return API_RESPONSES.badRequest(request, 'Landlord ID is required.')
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
    return API_RESPONSES.badRequest(request, 'Decision must be: approve, reject, or suspend.')
  }

  try {
    const landlordResult = await safeQuery(adminSupabase.from('profiles').select('*').eq('id', landlordId).maybeSingle())

    if (landlordResult.error) {
      return API_RESPONSES.badRequest(request, landlordResult.error.message)
    }

    const landlordProfile = landlordResult.data
    const targetRole = resolveTargetRole(landlordProfile)
    const currentRole = toText(landlordProfile?.role).toLowerCase()
    const isPendingRolePromotion = targetRole && targetRole !== currentRole

    if (!landlordProfile || !targetRole) {
      return API_RESPONSES.notFound(request, 'Landlord or agent not found.')
    }

    if (decisionStatus === 'approved' && landlordProfile.kyc_verified !== true && landlordProfile.kyc_verified !== 1) {
      return API_RESPONSES.badRequest(request, 'KYC verification must be completed before landlord approval.')
    }

    const updatePayload = {
      approval_status: decisionStatus,
      approved_by: user.id,
      approved_at: new Date().toISOString(),
      approval_notes: notes,
      updated_at: new Date().toISOString()
    }

    if (decisionStatus === 'approved') {
      updatePayload.role = targetRole
      updatePayload.requested_role = null
    } else if (isPendingRolePromotion) {
      updatePayload.requested_role = null
    }

    const updatedResult = await safeQuery(
      adminSupabase
        .from('profiles')
        .update(updatePayload)
        .eq('id', landlordId)
        .select()
        .maybeSingle()
    )

    if (updatedResult.error) {
      return API_RESPONSES.badRequest(request, updatedResult.error.message)
    }

    if (decisionStatus === 'approved') {
      const authMetadata = await loadAuthMetadata(adminSupabase, landlordId)

      try {
        await adminSupabase.auth.admin.updateUserById(landlordId, {
          app_metadata: {
            ...authMetadata.appMetadata,
            role: targetRole
          },
          user_metadata: {
            ...authMetadata.userMetadata,
            requested_role: null
          }
        })
      } catch {
        // Auth metadata sync is best effort.
      }
    } else if (isPendingRolePromotion) {
      const authMetadata = await loadAuthMetadata(adminSupabase, landlordId)

      try {
        await adminSupabase.auth.admin.updateUserById(landlordId, {
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
      entity: `Landlord ${landlordId}`,
      action: `Landlord ${decision}ed`,
      status: 'completed',
      note: notes
    })

    const roleLabel = targetRole === 'agent' ? 'agent' : 'landlord'
    const liveAccessReady = decisionStatus === 'approved' ? await hasLiveLandlordAccess(adminSupabase, landlordId) : false

    const decisionMessage =
      decisionStatus === 'approved'
        ? liveAccessReady
          ? `Your ${roleLabel} account has been approved and your paid access is active. You can now sign in and access your dashboard.`
          : `Your ${roleLabel} account has been approved. Dashboard access will unlock automatically once your paid plan becomes active.`
        : decisionStatus === 'suspended'
          ? `Your ${roleLabel} account has been suspended. Contact support if you need help.`
          : `Your ${roleLabel} account request was not approved. Review the notes from admin and contact support if needed.`

    await queueUserNotifications({
      supabase: adminSupabase,
      ownerId: landlordId,
      recipientUserId: landlordId,
      subject: `Mamba Properties ${targetRole === 'agent' ? 'Agent' : 'Landlord'} Account Update`,
      message: notes ? `${decisionMessage} Notes: ${notes}` : decisionMessage,
      channels: ['sms', 'email']
    })

    return API_RESPONSES.ok(request, {
      id: updatedResult.data?.id,
      name: updatedResult.data?.full_name,
      status: updatedResult.data?.approval_status,
      message: `${targetRole === 'agent' ? 'Agent' : 'Landlord'} ${decision}ed successfully.`
    })
  } catch (error) {
    return API_RESPONSES.internal(request, error.message)
  }
}
