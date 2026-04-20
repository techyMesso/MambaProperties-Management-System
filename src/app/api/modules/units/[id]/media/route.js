import { API_RESPONSES } from '@/libs/api/apiResponses'
import { safeQuery } from '@/libs/api/safeQuery'
import { canAccessPath } from '@/libs/auth/roles'
import { resolveUserRole } from '@/libs/auth/resolveRole'
import { enforceSameOriginMutation, isStoragePathOwnedByUser } from '@/libs/security/requestGuards'
import { createClient as createServerSupabaseClient } from '@/libs/supabase/server'
import { BUCKET_NAME, SIGNED_URL_TTL_SECONDS_LONG } from '@/libs/constants'

const resolveRouteParams = async params => (params ? await params : {})

const sanitizeText = value => String(value || '').trim()

const getContext = async (request, unitId) => {
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

  const unitResult = await safeQuery(
    supabase
      .from('units')
      .select('id,owner_id,unit_id,plot_id,category,rent,status,booking_stage,description,amenities,is_listed')
      .eq('id', unitId)
      .maybeSingle()
  )

  if (unitResult.error) {
    return {
      error: API_RESPONSES.badRequest(request, unitResult.error.message)
    }
  }

  if (!unitResult.data) {
    return {
      error: API_RESPONSES.notFound(request, 'Unit not found.')
    }
  }

  const canWrite = role === 'admin' || (unitResult.data.owner_id && unitResult.data.owner_id === user.id)

  return {
    supabase,
    user,
    role,
    unit: unitResult.data,
    canWrite
  }
}

export async function GET(request, { params }) {
  const routeParams = await resolveRouteParams(params)
  const unitId = String(routeParams?.id || '').trim()
  const context = await getContext(request, unitId)

  if (context.error) {
    return context.error
  }

  const { supabase, unit } = context

  const mediaResult = await safeQuery(
    supabase
      .from('unit_media')
      .select('id,file_path,caption,is_primary,created_at,media_type')
      .eq('unit_id', unit.id)
      .order('is_primary', { ascending: false })
      .order('created_at', { ascending: false }),
    { fallbackData: [] }
  )

  if (mediaResult.error) {
    return API_RESPONSES.badRequest(request, mediaResult.error.message)
  }

  const mediaItems = mediaResult.data || []
  const filePaths = mediaItems.map(item => item.file_path)

  // Batch create signed URLs
  const { data: signedUrlsData, error: signedUrlsError } = await supabase.storage
    .from(BUCKET_NAME)
    .createSignedUrls(filePaths, SIGNED_URL_TTL_SECONDS_LONG)

  // Map signed URLs back to items
  const items = mediaItems.map((item, index) => ({
    ...item,
    url: signedUrlsError ? null : signedUrlsData?.[index]?.signedUrl || null
  }))

  return API_RESPONSES.ok(
    request,
    {
      unit: {
        id: unit.id,
        unitId: unit.unit_id,
        plotId: unit.plot_id,
        category: unit.category,
        rent: unit.rent,
        status: unit.status,
        stage: unit.booking_stage,
        description: unit.description,
        amenities: unit.amenities,
        isListed: unit.is_listed
      },
      items
    },
    {
      headers: {
        'Cache-Control': 'no-store'
      }
    }
  )
}

export async function POST(request, { params }) {
  const originError = enforceSameOriginMutation(request)

  if (originError) {
    return originError
  }

  const routeParams = await resolveRouteParams(params)
  const unitId = String(routeParams?.id || '').trim()
  const context = await getContext(request, unitId)

  if (context.error) {
    return context.error
  }

  if (!context.canWrite) {
    return API_RESPONSES.forbidden(request, 'You do not have permission to add media for this unit.')
  }

  let body

  try {
    body = await request.json()
  } catch {
    return API_RESPONSES.badRequest(request, 'Invalid JSON payload.')
  }

  const items = Array.isArray(body?.items) ? body.items : []

  if (!items.length) {
    return API_RESPONSES.badRequest(request, 'items is required.')
  }

  const normalizedItems = items
    .map(item => ({
      path: sanitizeText(item?.path),
      caption: sanitizeText(item?.caption) || null,
      isPrimary: Boolean(item?.isPrimary)
    }))
    .filter(item => item.path)

  if (!normalizedItems.length) {
    return API_RESPONSES.badRequest(request, 'No valid media paths were provided.')
  }

  if (context.role !== 'admin' && normalizedItems.some(item => !isStoragePathOwnedByUser(item.path, context.user.id))) {
    return API_RESPONSES.badRequest(request, 'Media path must belong to the signed-in account.')
  }

  if (normalizedItems.some(item => item.isPrimary)) {
    const resetPrimaryResult = await safeQuery(
      context.supabase.from('unit_media').update({ is_primary: false }).eq('unit_id', context.unit.id)
    )

    if (resetPrimaryResult.error) {
      return API_RESPONSES.badRequest(request, resetPrimaryResult.error.message)
    }
  }

  const hasExplicitPrimary = normalizedItems.some(item => item.isPrimary)
  let existingPrimary = false

  if (!hasExplicitPrimary) {
    const existingPrimaryResult = await safeQuery(
      context.supabase.from('unit_media').select('id').eq('unit_id', context.unit.id).eq('is_primary', true).limit(1).maybeSingle()
    )

    existingPrimary = Boolean(existingPrimaryResult.data?.id)
  }

  const insertRows = normalizedItems.map((item, index) => ({
    owner_id: context.unit.owner_id,
    unit_id: context.unit.id,
    media_type: 'photo',
    file_path: item.path,
    caption: item.caption,
    is_primary: item.isPrimary || (!hasExplicitPrimary && !existingPrimary && index === 0)
  }))

  const insertResult = await safeQuery(
    context.supabase.from('unit_media').insert(insertRows).select('id,file_path,caption,is_primary,created_at,media_type'),
    { fallbackData: [] }
  )

  if (insertResult.error) {
    return API_RESPONSES.badRequest(request, insertResult.error.message)
  }

  return API_RESPONSES.created(request, { items: insertResult.data || [] })
}
