import { API_RESPONSES } from '@/libs/api/apiResponses'
import { safeQuery } from '@/libs/api/safeQuery'
import { resolveUserRole } from '@/libs/auth/resolveRole'
import { USER_ROLES } from '@/libs/auth/roles'
import { enforceSameOriginMutation } from '@/libs/security/requestGuards'
import { createClient as createServerSupabaseClient } from '@/libs/supabase/server'

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const isUuid = value => UUID_REGEX.test(String(value || '').trim())

const toText = value => String(value || '').trim()

export async function DELETE(request, { params }) {
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

  if (role !== USER_ROLES.TENANT) {
    return API_RESPONSES.forbidden(request, 'Only tenant accounts can remove saved houses.')
  }

  const unitId = toText((await params)?.unitId)

  if (!isUuid(unitId)) {
    return API_RESPONSES.badRequest(request, 'unitId must be a valid UUID.')
  }

  const deleteResult = await safeQuery(
    supabase
      .from('tenant_saved_listings')
      .delete()
      .eq('tenant_id', user.id)
      .eq('unit_id', unitId)
      .select('id')
      .maybeSingle()
  )

  if (deleteResult.error) {
    return API_RESPONSES.badRequest(request, deleteResult.error.message || 'Unable to remove saved house.')
  }

  return API_RESPONSES.ok(request, {
    removed: Boolean(deleteResult.data?.id),
    unitId,
    message: 'Saved house removed.'
  })
}
