import { API_RESPONSES } from '@/libs/api/apiResponses'
import { safeQuery } from '@/libs/api/safeQuery'
import { canAccessPath } from '@/libs/auth/roles'
import { resolveUserRole } from '@/libs/auth/resolveRole'
import { enforceSameOriginMutation } from '@/libs/security/requestGuards'
import { createClient as createServerSupabaseClient } from '@/libs/supabase/server'
import { BUCKET_NAME } from '@/libs/constants'

const resolveRouteParams = async params => (params ? await params : {})

const getContext = async (request, unitId, mediaId) => {
  const supabase = await createServerSupabaseClient()

  if (!supabase) {
    return {
      error: API_RESPONSES.unavailable(request, 'Supabase is not configured.')
    }
  }

  const {
    data: { user }
  } = await supabase.auth.getUser()

  if (!user?.id) {
    return {
      error: API_RESPONSES.unauthorized(request)
    }
  }

  const role = await resolveUserRole(supabase, user)

  if (!canAccessPath('/units', role)) {
    return {
      error: API_RESPONSES.forbidden(request, 'Forbidden module for current user role.')
    }
  }

  const mediaResult = await safeQuery(
    supabase.from('unit_media').select('id,owner_id,unit_id,file_path').eq('id', mediaId).eq('unit_id', unitId).maybeSingle()
  )

  if (mediaResult.error) {
    return {
      error: API_RESPONSES.badRequest(request, mediaResult.error.message)
    }
  }

  if (!mediaResult.data) {
    return {
      error: API_RESPONSES.notFound(request, 'Media record not found.')
    }
  }

  const canWrite = role === 'admin' || mediaResult.data.owner_id === user.id

  return {
    supabase,
    media: mediaResult.data,
    canWrite
  }
}

export async function DELETE(request, { params }) {
  const originError = enforceSameOriginMutation(request)

  if (originError) {
    return originError
  }

  const routeParams = await resolveRouteParams(params)
  const unitId = String(routeParams?.id || '').trim()
  const mediaId = String(routeParams?.mediaId || '').trim()
  const context = await getContext(request, unitId, mediaId)

  if (context.error) {
    return context.error
  }

  if (!context.canWrite) {
    return API_RESPONSES.forbidden(request, 'You do not have permission to delete this photo.')
  }

  const deleteResult = await safeQuery(
    context.supabase.from('unit_media').delete().eq('id', context.media.id).select('id').maybeSingle()
  )

  if (deleteResult.error) {
    return API_RESPONSES.badRequest(request, deleteResult.error.message)
  }

  await context.supabase.storage.from(BUCKET_NAME).remove([context.media.file_path])

  return API_RESPONSES.ok(request, { deleted: true })
}

export async function PATCH(request, { params }) {
  const originError = enforceSameOriginMutation(request)

  if (originError) {
    return originError
  }

  const routeParams = await resolveRouteParams(params)
  const unitId = String(routeParams?.id || '').trim()
  const mediaId = String(routeParams?.mediaId || '').trim()
  const context = await getContext(request, unitId, mediaId)

  if (context.error) {
    return context.error
  }

  if (!context.canWrite) {
    return API_RESPONSES.forbidden(request, 'You do not have permission to update this photo.')
  }

  const { error: resetError } = await context.supabase.from('unit_media').update({ is_primary: false }).eq('unit_id', unitId)

  if (resetError) {
    return API_RESPONSES.badRequest(request, resetError.message)
  }

  const { data, error } = await context.supabase
    .from('unit_media')
    .update({ is_primary: true })
    .eq('id', context.media.id)
    .eq('unit_id', unitId)
    .select('id')
    .maybeSingle()

  if (error) {
    return API_RESPONSES.badRequest(request, error.message)
  }

  if (!data) {
    return API_RESPONSES.notFound(request, 'Photo not found for this unit.')
  }

  return API_RESPONSES.ok(request, { updated: true })
}
