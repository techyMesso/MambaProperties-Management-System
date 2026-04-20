import { API_RESPONSES } from '@/libs/api/apiResponses'
import { safeQuery } from '@/libs/api/safeQuery'
import { resolveUserRole } from '@/libs/auth/resolveRole'
import { USER_ROLES } from '@/libs/auth/roles'
import { enforceSameOriginMutation } from '@/libs/security/requestGuards'
import { createClient as createServerSupabaseClient } from '@/libs/supabase/server'

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const isUuid = value => UUID_REGEX.test(String(value || '').trim())

const toText = value => String(value || '').trim()

const loadUnit = async ({ supabase, unitId, ownerId }) => {
  const query = supabase.from('units').select('id,owner_id,status,is_listed').eq('id', unitId)

  if (ownerId) {
    query.eq('owner_id', ownerId)
  }

  let result = await safeQuery(query.maybeSingle())

  if (result.error && String(result.error?.message || '').toLowerCase().includes('is_listed')) {
    const fallbackQuery = supabase.from('units').select('id,owner_id,status').eq('id', unitId)

    if (ownerId) {
      fallbackQuery.eq('owner_id', ownerId)
    }

    result = await safeQuery(fallbackQuery.maybeSingle())
  }

  return result
}

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

  if (role !== USER_ROLES.TENANT) {
    return API_RESPONSES.forbidden(request, 'Only tenant accounts can access saved houses.')
  }

  const result = await safeQuery(
    supabase
      .from('tenant_saved_listings')
      .select('id,unit_id,owner_id,created_at')
      .eq('tenant_id', user.id)
      .order('created_at', { ascending: false })
  )

  if (result.error) {
    return API_RESPONSES.badRequest(request, result.error.message || 'Unable to load saved houses.')
  }

  const rows = result.data || []

  return API_RESPONSES.ok(request, {
    favorites: rows.map(row => ({
      id: row.id,
      unitId: row.unit_id,
      ownerId: row.owner_id,
      createdAt: row.created_at
    }))
  })
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

  if (role !== USER_ROLES.TENANT) {
    return API_RESPONSES.forbidden(request, 'Only tenant accounts can save houses.')
  }

  let body

  try {
    body = await request.json()
  } catch {
    return API_RESPONSES.badRequest(request, 'Invalid JSON payload.')
  }

  const unitId = toText(body?.unitId)
  const ownerId = toText(body?.ownerId)

  if (!isUuid(unitId)) {
    return API_RESPONSES.badRequest(request, 'unitId must be a valid UUID.')
  }

  if (ownerId && !isUuid(ownerId)) {
    return API_RESPONSES.badRequest(request, 'ownerId must be a valid UUID when provided.')
  }

  const unitResult = await loadUnit({ supabase, unitId, ownerId: ownerId || null })

  if (unitResult.error) {
    return API_RESPONSES.badRequest(request, unitResult.error.message || 'Unable to validate listing.')
  }

  if (!unitResult.data?.id) {
    return API_RESPONSES.notFound(request, 'Listing not found.')
  }

  if (String(unitResult.data.status || '').trim().toLowerCase() !== 'vacant') {
    return API_RESPONSES.badRequest(request, 'Only vacant listings can be saved.')
  }

  if (Object.prototype.hasOwnProperty.call(unitResult.data, 'is_listed') && unitResult.data.is_listed === false) {
    return API_RESPONSES.badRequest(request, 'This listing is not available in the marketplace.')
  }

  const insertResult = await safeQuery(
    supabase
      .from('tenant_saved_listings')
      .upsert(
        {
          tenant_id: user.id,
          unit_id: unitResult.data.id,
          owner_id: unitResult.data.owner_id || ownerId || null
        },
        {
          onConflict: 'tenant_id,unit_id',
          ignoreDuplicates: false
        }
      )
      .select('id,unit_id,owner_id,created_at')
      .maybeSingle()
  )

  if (insertResult.error) {
    return API_RESPONSES.badRequest(request, insertResult.error.message || 'Unable to save house.')
  }

  return API_RESPONSES.ok(request, {
    favorite: {
      id: insertResult.data?.id,
      unitId: insertResult.data?.unit_id || unitId,
      ownerId: insertResult.data?.owner_id || unitResult.data.owner_id || null,
      createdAt: insertResult.data?.created_at || new Date().toISOString()
    },
    message: 'House saved successfully.'
  })
}
