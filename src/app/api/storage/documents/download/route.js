import { NextResponse } from 'next/server'

import { API_RESPONSES } from '@/libs/api/apiResponses'
import { resolveUserRole } from '@/libs/auth/resolveRole'
import { USER_ROLES } from '@/libs/auth/roles'
import { getStoragePathOwnerId, isStoragePathOwnedByUser } from '@/libs/security/requestGuards'
import { createAdminClient } from '@/libs/supabase/admin'
import { createClient as createServerSupabaseClient } from '@/libs/supabase/server'
import { BUCKET_NAME, SIGNED_URL_TTL_SECONDS } from '@/libs/constants'

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

  const path = String(request.nextUrl.searchParams.get('path') || '').trim()
  const shouldDownload = request.nextUrl.searchParams.get('download') !== '0'

  if (!path) {
    return API_RESPONSES.badRequest(request, 'Missing file path.')
  }

  if (path.includes('..')) {
    return API_RESPONSES.badRequest(request, 'Invalid file path.')
  }

  const signedOptions = shouldDownload ? { download: true } : {}

  const { data, error } = await supabase.storage.from(BUCKET_NAME).createSignedUrl(path, SIGNED_URL_TTL_SECONDS, signedOptions)

  if (!error && data?.signedUrl) {
    return NextResponse.redirect(data.signedUrl)
  }

  const adminSupabase = createAdminClient()

  if (!adminSupabase) {
    return API_RESPONSES.badRequest(request, error?.message || 'Unable to generate download URL.')
  }

  const role = await resolveUserRole(supabase, user)
  const pathOwnerId = getStoragePathOwnerId(path)
  const isAdmin = role === USER_ROLES.ADMIN
  let isAuthorized = isAdmin || isStoragePathOwnedByUser(path, user.id)

  if (!isAuthorized && pathOwnerId && pathOwnerId !== user.id) {
    const { data: rows, error: documentError } = await adminSupabase
      .from('documents')
      .select('owner_id')
      .eq('file_path', path)
      .in('owner_id', [user.id, pathOwnerId])
      .limit(10)

    if (!documentError && Array.isArray(rows)) {
      const hasViewerOwnershipLink = rows.some(row => row?.owner_id === user.id)
      const hasPathOwnerLink = rows.some(row => row?.owner_id === pathOwnerId)

      // Shared document access is allowed only when both path-owner and viewer links exist.
      isAuthorized = hasViewerOwnershipLink && hasPathOwnerLink
    }
  }

  if (!isAuthorized) {
    return API_RESPONSES.forbidden(request, 'Forbidden document access.')
  }

  const adminSigned = await adminSupabase.storage.from(BUCKET_NAME).createSignedUrl(path, SIGNED_URL_TTL_SECONDS, signedOptions)

  if (adminSigned.error || !adminSigned.data?.signedUrl) {
    return API_RESPONSES.badRequest(request, adminSigned.error?.message || 'Unable to generate download URL.')
  }

  return NextResponse.redirect(adminSigned.data.signedUrl)
}
