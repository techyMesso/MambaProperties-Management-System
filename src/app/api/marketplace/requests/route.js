import { API_RESPONSES } from '@/libs/api/apiResponses'
import { safeQuery } from '@/libs/api/safeQuery'
import { queueUserNotifications } from '@/libs/notifications/queue'
import { USER_ROLES } from '@/libs/auth/roles'
import { resolveUserRole } from '@/libs/auth/resolveRole'
import { checkHouseSearchAccess } from '@/libs/tenant/subscriptionAccess'
import { enforceSameOriginMutation } from '@/libs/security/requestGuards'
import { createAdminClient } from '@/libs/supabase/admin'
import { createClient as createServerSupabaseClient } from '@/libs/supabase/server'

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const isUuid = value => UUID_REGEX.test(String(value || '').trim())

const toIsoOrNull = value => {
  if (!value) {
    return null
  }

  const parsed = new Date(value)

  if (Number.isNaN(parsed.getTime())) {
    return null
  }

  return parsed.toISOString()
}

const toNonNegativeNumber = value => {
  if (value === null || value === undefined || value === '') {
    return null
  }

  const parsed = Number(value)

  if (!Number.isFinite(parsed) || parsed < 0) {
    return null
  }

  return Math.round(parsed * 100) / 100
}

const getEmailName = email => String(email || '').split('@')[0] || 'Tenant'

const loadUnitForMarketplace = async (supabase, unitId, ownerId) => {
  let lookup = await safeQuery(
    supabase
      .from('units')
      .select('id,owner_id,unit_id,category,status,is_listed')
      .eq('id', unitId)
      .eq('owner_id', ownerId)
      .maybeSingle()
  )

  if (lookup.error && String(lookup.error?.message || '').toLowerCase().includes('is_listed')) {
    lookup = await safeQuery(
      supabase.from('units').select('id,owner_id,status').eq('id', unitId).eq('owner_id', ownerId).maybeSingle()
    )
  }

  return lookup
}

const createMarketplaceMessagePayload = ({
  ownerId,
  tenantUserId,
  action,
  tenantName,
  ownerName,
  unitLookup,
  notes,
  requestId,
  preferredTime
}) => {
  const unitLabel = toText(unitLookup?.unit_id || unitLookup?.category || unitLookup?.id).slice(0, 80) || 'listing'
  const normalizedAction = toText(action).toLowerCase()

  const threadPrefix =
    normalizedAction === 'booking'
      ? 'Booking request'
      : normalizedAction === 'viewing'
        ? 'Viewing request'
        : 'Marketplace inquiry'

  const thread = `${threadPrefix} · ${unitLabel}`
  const bodyParts = []

  if (normalizedAction === 'viewing' && preferredTime) {
    bodyParts.push(`Preferred viewing time: ${preferredTime}.`)
  }

  if (notes) {
    bodyParts.push(notes)
  }

  const body = bodyParts.join(' ').trim() || `${tenantName} sent a ${normalizedAction} request.`

  return [
    {
      owner_id: ownerId,
      thread,
      audience: tenantName,
      channel: 'Marketplace',
      status: 'pending',
      last_update: new Date().toISOString(),
      sender_profile_id: tenantUserId,
      recipient_profile_id: ownerId,
      inquiry_type: normalizedAction,
      related_unit_id: unitLookup?.id || null,
      related_request_id: requestId || null,
      body
    },
    {
      owner_id: tenantUserId,
      thread,
      audience: ownerName || 'Landlord',
      channel: 'Marketplace',
      status: 'pending',
      last_update: new Date().toISOString(),
      sender_profile_id: tenantUserId,
      recipient_profile_id: ownerId,
      inquiry_type: normalizedAction,
      related_unit_id: unitLookup?.id || null,
      related_request_id: requestId || null,
      body
    }
  ]
}

const queueMarketplaceNotifications = async ({
  adminSupabase,
  ownerId,
  tenantUserId,
  tenantName,
  unitLookup,
  action,
  notes
}) => {
  if (!adminSupabase) {
    return
  }

  const unitLabel = toText(unitLookup?.unit_id || unitLookup?.category || unitLookup?.id) || 'listing'

  const actionLabel =
    action === 'booking' ? 'booking request' : action === 'viewing' ? 'viewing request' : 'marketplace inquiry'

  const landlordMessage = `${tenantName} submitted a ${actionLabel} for ${unitLabel}.${notes ? ` Notes: ${notes}` : ''}`
  const tenantMessage = `Your ${actionLabel} for ${unitLabel} has been sent to the landlord.${notes ? ` Notes saved: ${notes}` : ''}`

  await Promise.all([
    queueUserNotifications({
      supabase: adminSupabase,
      ownerId,
      recipientUserId: ownerId,
      subject: 'New marketplace lead',
      message: landlordMessage,
      channels: ['sms', 'email']
    }),
    queueUserNotifications({
      supabase: adminSupabase,
      ownerId: tenantUserId,
      recipientUserId: tenantUserId,
      subject: 'Marketplace request received',
      message: tenantMessage,
      channels: ['sms', 'email']
    })
  ])
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
    return API_RESPONSES.forbidden(request, 'Only tenant accounts can submit marketplace requests.')
  }

  const houseSearchAccess = await checkHouseSearchAccess(supabase, user.id)

  if (!houseSearchAccess?.hasAccess) {
    return API_RESPONSES.forbidden(request, houseSearchAccess?.message || 'An active house-search subscription is required.')
  }

  let body

  try {
    body = await request.json()
  } catch {
    return API_RESPONSES.badRequest(request, 'Invalid JSON payload.')
  }

  const action = String(body?.action || '').trim().toLowerCase()
  const unitId = String(body?.unitId || '').trim()
  const ownerId = String(body?.ownerId || '').trim()
  const notes = String(body?.notes || '').trim() || null

  if (!['viewing', 'booking', 'inquiry'].includes(action)) {
    return API_RESPONSES.badRequest(request, 'action must be inquiry, viewing, or booking.')
  }

  if (!isUuid(unitId) || !isUuid(ownerId)) {
    return API_RESPONSES.badRequest(request, 'unitId and ownerId must be valid UUID values.')
  }

  const unitLookup = await loadUnitForMarketplace(supabase, unitId, ownerId)

  if (unitLookup.error) {
    return API_RESPONSES.badRequest(request, unitLookup.error.message)
  }

  if (!unitLookup.data) {
    return API_RESPONSES.notFound(request, 'Marketplace listing not found.')
  }

  if (String(unitLookup.data.status || '').toLowerCase() !== 'vacant') {
    return API_RESPONSES.badRequest(request, 'This unit is no longer vacant.')
  }

  if (Object.prototype.hasOwnProperty.call(unitLookup.data, 'is_listed') && unitLookup.data.is_listed === false) {
    return API_RESPONSES.badRequest(request, 'This listing is no longer available in marketplace.')
  }

  const [profileResult, tenantResult] = await Promise.all([
    safeQuery(supabase.from('profiles').select('full_name,phone').eq('id', user.id).maybeSingle()),
    safeQuery(supabase.from('tenants').select('tenant_name,phone').eq('auth_user_id', user.id).eq('owner_id', ownerId).maybeSingle())
  ])

  const profile = profileResult.data
  const tenantMapping = tenantResult.data

  const tenantName = String(tenantMapping?.tenant_name || profile?.full_name || getEmailName(user.email)).trim()
  const tenantPhone = String(tenantMapping?.phone || profile?.phone || '').trim() || null
  const adminSupabase = createAdminClient()

  if (action === 'viewing') {
    const preferredTime = toIsoOrNull(body?.preferredTime)

    if (!preferredTime) {
      return API_RESPONSES.badRequest(request, 'preferredTime is required for viewing requests.')
    }

    const insertResult = await safeQuery(
      supabase
        .from('viewing_appointments')
        .insert({
          owner_id: ownerId,
          unit_id: unitId,
          tenant_profile_id: user.id,
          tenant_name: tenantName,
          tenant_phone: tenantPhone,
          preferred_time: preferredTime,
          notes,
          status: 'pending'
        })
        .select('id,preferred_time,status')
        .single()
    )

    if (insertResult.error) {
      return API_RESPONSES.badRequest(request, insertResult.error.message)
    }

    if (adminSupabase) {
      await safeQuery(
        adminSupabase.from('messages').insert(
          createMarketplaceMessagePayload({
            ownerId,
            tenantUserId: user.id,
            action,
            tenantName,
            ownerName: 'Landlord',
            unitLookup: unitLookup.data,
            notes,
            requestId: insertResult.data?.id,
            preferredTime
          })
        )
      )

      await queueMarketplaceNotifications({
        adminSupabase,
        ownerId,
        tenantUserId: user.id,
        tenantName,
        unitLookup: unitLookup.data,
        action,
        notes
      })
    }

    return API_RESPONSES.ok(request, {
      requestType: 'viewing',
      requestId: insertResult.data?.id,
      message: 'Viewing request submitted successfully.'
    })
  }

  const bookingFee = toNonNegativeNumber(body?.bookingFee)

  if (body?.bookingFee !== undefined && body?.bookingFee !== '' && bookingFee === null) {
    return API_RESPONSES.badRequest(request, 'bookingFee must be a non-negative number.')
  }

  const expiresAt = toIsoOrNull(body?.expiresAt)

  if (body?.expiresAt && !expiresAt) {
    return API_RESPONSES.badRequest(request, 'expiresAt must be a valid datetime.')
  }

  if (action === 'inquiry' && !notes) {
    return API_RESPONSES.badRequest(request, 'notes are required for a marketplace inquiry.')
  }

  if (action === 'inquiry') {
    if (!adminSupabase) {
      return API_RESPONSES.unavailable(request, 'Service role is required to store marketplace inquiries.')
    }

    const inquiryResult = await safeQuery(
      adminSupabase.from('messages').insert(
        createMarketplaceMessagePayload({
          ownerId,
          tenantUserId: user.id,
          action,
          tenantName,
          ownerName: 'Landlord',
          unitLookup: unitLookup.data,
          notes,
          requestId: null
        })
      )
    )

    if (inquiryResult.error) {
      return API_RESPONSES.badRequest(request, inquiryResult.error.message || 'Unable to save marketplace inquiry.')
    }

    await queueMarketplaceNotifications({
      adminSupabase,
      ownerId,
      tenantUserId: user.id,
      tenantName,
      unitLookup: unitLookup.data,
      action,
      notes
    })

    return API_RESPONSES.ok(request, {
      requestType: 'inquiry',
      message: 'Inquiry sent successfully. The landlord can now respond from the messaging workspace.'
    })
  }

  const insertResult = await safeQuery(
    supabase
      .from('bookings')
      .insert({
        owner_id: ownerId,
        unit_id: unitId,
        tenant_profile_id: user.id,
        booking_fee: bookingFee ?? 0,
        currency: 'KES',
        status: 'pending',
        expires_at: expiresAt
      })
      .select('id,booking_reference,status')
      .single()
  )

  if (insertResult.error) {
    return API_RESPONSES.badRequest(request, insertResult.error.message)
  }

  if (adminSupabase) {
    await safeQuery(
      adminSupabase.from('messages').insert(
        createMarketplaceMessagePayload({
          ownerId,
          tenantUserId: user.id,
          action,
          tenantName,
          ownerName: 'Landlord',
          unitLookup: unitLookup.data,
          notes,
          requestId: insertResult.data?.id
        })
      )
    )

    await queueMarketplaceNotifications({
      adminSupabase,
      ownerId,
      tenantUserId: user.id,
      tenantName,
      unitLookup: unitLookup.data,
      action,
      notes
    })
  }

  return API_RESPONSES.ok(request, {
    requestType: 'booking',
    requestId: insertResult.data?.id,
    bookingReference: insertResult.data?.booking_reference,
    message: 'Booking request submitted successfully.'
  })
}
