import { API_RESPONSES } from '@/libs/api/apiResponses'
import { safeQuery } from '@/libs/api/safeQuery'
import { USER_ROLES } from '@/libs/auth/roles'
import { KYC_DOCUMENT_TYPES, isKycDocumentType, mapKycDocumentRow } from '@/libs/landlord/kyc'
import { enforceSameOriginMutation, isStoragePathOwnedByUser } from '@/libs/security/requestGuards'
import { enforceRouteRateLimit } from '@/libs/security/rateLimit'
import { createClient as createServerSupabaseClient } from '@/libs/supabase/server'

const MANAGEMENT_ACCOUNT_ROLES = new Set([USER_ROLES.LANDLORD, USER_ROLES.AGENT])

const toText = value => String(value || '').trim()

const hasLandlordKycAccess = profile => {
  const role = toText(profile?.role).toLowerCase()
  const requestedRole = toText(profile?.requested_role).toLowerCase()

  return MANAGEMENT_ACCOUNT_ROLES.has(role) || MANAGEMENT_ACCOUNT_ROLES.has(requestedRole)
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

  const rateLimitError = await enforceRouteRateLimit(request, {
    scope: 'landlord-kyc-documents-get',
    identifier: user.id,
    limit: 120,
    windowMs: 60_000
  })

  if (rateLimitError) {
    return rateLimitError
  }

  const profileResult = await safeQuery(
    supabase.from('profiles').select('full_name,role,requested_role,approval_status,kyc_verified').eq('id', user.id).maybeSingle()
  )

  if (profileResult.error) {
    return API_RESPONSES.badRequest(request, profileResult.error.message || 'Unable to load account profile.')
  }

  if (!hasLandlordKycAccess(profileResult.data)) {
    return API_RESPONSES.forbidden(request, 'Only landlord or agent onboarding accounts can access KYC documents.')
  }

  const docsResult = await safeQuery(
    supabase
      .from('landlord_documents')
      .select('id,landlord_id,document_type,file_path,file_name,file_size,mime_type,verification_status,verified_by,verified_at,rejection_reason,verification_notes,created_at,updated_at')
      .eq('landlord_id', user.id)
      .order('created_at', { ascending: false })
  )

  if (docsResult.error) {
    return API_RESPONSES.badRequest(request, docsResult.error.message || 'Unable to load KYC documents.')
  }

  return API_RESPONSES.ok(request, {
    profile: profileResult.data || null,
    documentTypes: KYC_DOCUMENT_TYPES,
    documents: (docsResult.data || []).map(mapKycDocumentRow)
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

  const rateLimitError = await enforceRouteRateLimit(request, {
    scope: 'landlord-kyc-documents-post',
    identifier: user.id,
    limit: 20,
    windowMs: 5 * 60_000,
    message: 'Too many KYC uploads. Please wait before uploading again.'
  })

  if (rateLimitError) {
    return rateLimitError
  }

  const profileResult = await safeQuery(
    supabase.from('profiles').select('role,requested_role').eq('id', user.id).maybeSingle()
  )

  if (profileResult.error) {
    return API_RESPONSES.badRequest(request, profileResult.error.message || 'Unable to load account profile.')
  }

  if (!hasLandlordKycAccess(profileResult.data)) {
    return API_RESPONSES.forbidden(request, 'Only landlord or agent onboarding accounts can upload KYC documents.')
  }

  let body

  try {
    body = await request.json()
  } catch {
    return API_RESPONSES.badRequest(request, 'Invalid JSON payload.')
  }

  const documentType = toText(body?.documentType).toLowerCase()
  const filePath = toText(body?.filePath)
  const fileName = toText(body?.fileName)
  const mimeType = toText(body?.mimeType)
  const verificationNotes = toText(body?.notes)
  const fileSize = Number(body?.fileSize || 0)

  if (!isKycDocumentType(documentType)) {
    return API_RESPONSES.badRequest(request, `Invalid documentType. Allowed: ${KYC_DOCUMENT_TYPES.join(', ')}`)
  }

  if (!filePath || !isStoragePathOwnedByUser(filePath, user.id)) {
    return API_RESPONSES.badRequest(request, 'Invalid KYC file path.')
  }

  if (!fileName) {
    return API_RESPONSES.badRequest(request, 'File name is required.')
  }

  const insertResult = await safeQuery(
    supabase
      .from('landlord_documents')
      .insert({
        landlord_id: user.id,
        document_type: documentType,
        file_path: filePath,
        file_name: fileName,
        file_size: Number.isFinite(fileSize) ? fileSize : 0,
        mime_type: mimeType || null,
        verification_status: 'pending',
        rejection_reason: null,
        verification_notes: verificationNotes || null
      })
      .select('id,landlord_id,document_type,file_path,file_name,file_size,mime_type,verification_status,verified_by,verified_at,rejection_reason,verification_notes,created_at,updated_at')
      .maybeSingle()
  )

  if (insertResult.error) {
    return API_RESPONSES.badRequest(request, insertResult.error.message || 'Unable to save KYC document.')
  }

  return API_RESPONSES.ok(request, {
    document: mapKycDocumentRow(insertResult.data),
    message: 'KYC document uploaded successfully. It is now awaiting admin review.'
  })
}
