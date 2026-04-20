import { randomUUID } from 'crypto'

import { API_RESPONSES } from '@/libs/api/apiResponses'
import { enforceRequestSizeLimit, enforceSameOriginMutation, isStoragePathOwnedByUser } from '@/libs/security/requestGuards'
import { enforceRouteRateLimit } from '@/libs/security/rateLimit'
import { createAdminClient } from '@/libs/supabase/admin'
import { createClient as createServerSupabaseClient } from '@/libs/supabase/server'
import { BUCKET_NAME, MAX_FILE_SIZE_BYTES, MAX_UPLOAD_BYTES } from '@/libs/constants'

const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])

const MIME_ALIASES = {
  'image/jpg': 'image/jpeg',
  'image/pjpeg': 'image/jpeg',
  'image/x-png': 'image/png'
}

const EXTENSION_TO_MIME = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  jfif: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp'
}

const toText = value => String(value || '').trim()
const hasFn = (value, name) => typeof value?.[name] === 'function'
const isDevelopment = process.env.NODE_ENV !== 'production'

const getExtension = fileName => {
  const normalized = toText(fileName).toLowerCase()
  const lastDot = normalized.lastIndexOf('.')

  if (lastDot < 0 || lastDot === normalized.length - 1) {
    return ''
  }

  return normalized.slice(lastDot + 1)
}

const resolveImageMimeType = file => {
  const extension = getExtension(file?.name)
  const declaredRaw = toText(file?.type).toLowerCase()
  const declared = MIME_ALIASES[declaredRaw] || declaredRaw
  const inferred = toText(EXTENSION_TO_MIME[extension]).toLowerCase()

  if (ALLOWED_IMAGE_TYPES.has(declared)) {
    return declared
  }

  if (ALLOWED_IMAGE_TYPES.has(inferred)) {
    return inferred
  }

  return declared || inferred
}

const isFileLike = value => {
  if (!value || typeof value !== 'object') {
    return false
  }

  const hasSize = Number.isFinite(Number(value?.size)) && Number(value?.size) >= 0
  const canReadBytes = hasFn(value, 'arrayBuffer') || (hasFn(value, 'stream') && hasFn(value, 'slice'))

  return hasSize && canReadBytes
}

const isStoragePolicyError = error => {
  const message = String(error?.message || '').toLowerCase()

  if (!message) {
    return false
  }

  return (
    message.includes('row-level security') ||
    message.includes('new row violates') ||
    message.includes('permission denied') ||
    message.includes('policy')
  )
}

const isStorageMimeError = error => {
  const message = String(error?.message || '').toLowerCase()

  return message.includes('mime') || message.includes('content type')
}

const isColumnMissingError = (error, columnName) => {
  const message = String(error?.message || '').toLowerCase()
  const normalizedColumn = String(columnName || '').toLowerCase()

  if (!message || !message.includes('does not exist') || !message.includes('column')) {
    return false
  }

  if (!normalizedColumn) {
    return true
  }

  return message.includes(normalizedColumn)
}

const sanitizeFileName = value => {
  const normalized = String(value || 'avatar.jpg')
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')

  return normalized || 'avatar.jpg'
}

const isPathSafe = value => {
  const path = toText(value)

  if (!path) {
    return false
  }

  return !path.includes('..')
}

const buildAvatarUrl = avatarPath => {
  const safePath = toText(avatarPath)

  if (!safePath) {
    return ''
  }

  return `/api/storage/documents/download?path=${encodeURIComponent(safePath)}&download=0`
}

const readExistingAvatarPath = async ({ supabase, user }) => {
  const withAvatar = await supabase.from('profiles').select('avatar_path').eq('id', user.id).maybeSingle()

  if (!withAvatar.error) {
    return toText(withAvatar.data?.avatar_path || user.user_metadata?.avatar_path || '')
  }

  if (isColumnMissingError(withAvatar.error, 'avatar_path')) {
    return toText(user.user_metadata?.avatar_path || '')
  }

  throw new Error(withAvatar.error.message || 'Unable to read existing avatar path.')
}

const persistAvatarPath = async ({ supabase, user, avatarPath }) => {
  let warning = null

  const metadataPayload = {
    ...(user.user_metadata || {}),
    avatar_path: avatarPath,
    avatar_url: buildAvatarUrl(avatarPath)
  }

  const [profileUpsert, authUpdate] = await Promise.all([
    supabase.from('profiles').upsert({ id: user.id, avatar_path: avatarPath }, { onConflict: 'id' }),
    supabase.auth.updateUser({
      data: metadataPayload
    })
  ])

  if (profileUpsert.error) {
    if (isColumnMissingError(profileUpsert.error, 'avatar_path')) {
      const profileTouch = await supabase.from('profiles').upsert({ id: user.id }, { onConflict: 'id' })

      if (profileTouch.error) {
        warning = profileTouch.error.message || 'Unable to sync avatar path to profile.'
      }
    } else {
      warning = profileUpsert.error.message || 'Unable to sync avatar path to profile.'
    }
  }

  if (authUpdate.error) {
    warning = authUpdate.error.message || 'Avatar uploaded, but auth metadata refresh failed.'
  }

  return warning
}

export async function POST(request) {
  const failBadRequest = (message, meta) => {
    if (isDevelopment) {
      console.error('[account-avatar-upload] badRequest', {
        message,
        ...meta
      })
    }

    return API_RESPONSES.badRequest(request, message)
  }

  const failPayloadTooLarge = (message, meta) => {
    if (isDevelopment) {
      console.error('[account-avatar-upload] payloadTooLarge', {
        message,
        ...meta
      })
    }

    return API_RESPONSES.payloadTooLarge(request, message)
  }

  const originError = enforceSameOriginMutation(request)

  if (originError) {
    return originError
  }

  const sizeError = enforceRequestSizeLimit(request, {
    maxBytes: MAX_UPLOAD_BYTES,
    message: 'Profile photo upload is too large.'
  })

  if (sizeError) {
    return sizeError
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
    scope: 'account-avatar-upload',
    identifier: user.id,
    limit: 10,
    windowMs: 5 * 60_000,
    message: 'Too many avatar uploads. Please wait before trying again.'
  })

  if (rateLimitError) {
    return rateLimitError
  }

  let formData

  try {
    formData = await request.formData()
  } catch {
    return failBadRequest('Invalid upload request payload.', { stage: 'form-data-parse' })
  }

  const file = formData.get('file')

  if (!isFileLike(file)) {
    return failBadRequest('A profile photo file is required.', {
      stage: 'file-validation',
      fileType: typeof file,
      hasName: Boolean(file?.name)
    })
  }

  const mimeType = resolveImageMimeType(file)

  if (!ALLOWED_IMAGE_TYPES.has(mimeType)) {
    return failBadRequest('Unsupported image type. Use JPG, PNG, or WEBP.', {
      stage: 'mime-validation',
      declaredType: toText(file?.type),
      resolvedType: mimeType,
      fileName: toText(file?.name)
    })
  }

  if (!Number.isFinite(Number(file.size)) || Number(file.size) <= 0) {
    return failBadRequest('Profile photo file is empty.', {
      stage: 'size-validation',
      size: Number(file.size)
    })
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    return failPayloadTooLarge('Profile photo must be 10MB or less.', {
      stage: 'size-validation',
      size: Number(file.size),
      max: MAX_FILE_SIZE_BYTES
    })
  }

  let previousAvatarPath = toText(user.user_metadata?.avatar_path || '')

  if (!previousAvatarPath) {
    try {
      previousAvatarPath = await readExistingAvatarPath({ supabase, user })
    } catch (error) {
      return failBadRequest(error.message || 'Unable to load existing profile photo.', {
        stage: 'load-existing-avatar',
        error: error?.message
      })
    }
  }

  const fileName = sanitizeFileName(file.name)
  const storagePath = `${user.id}/profile-avatar/${Date.now()}-${randomUUID()}-${fileName}`

  const adminSupabase = createAdminClient()
  let uploadClient = adminSupabase || supabase
  let uploadResult = await uploadClient.storage.from(BUCKET_NAME).upload(storagePath, file, {
    contentType: mimeType || 'application/octet-stream',
    cacheControl: '3600',
    upsert: false
  })

  if (uploadResult.error && uploadClient !== supabase) {
    const userUploadResult = await supabase.storage.from(BUCKET_NAME).upload(storagePath, file, {
      contentType: mimeType || 'application/octet-stream',
      cacheControl: '3600',
      upsert: false
    })

    if (!userUploadResult.error) {
      uploadClient = supabase
      uploadResult = userUploadResult
    }
  }

  if (uploadResult.error) {
    const isPolicy = isStoragePolicyError(uploadResult.error)
    const isMime = isStorageMimeError(uploadResult.error)

    const fallbackMessage = isMime
      ? 'Storage rejected this file type. Use JPG, PNG, or WEBP.'
      : isPolicy
        ? adminSupabase
          ? 'Storage policy blocked upload for your account session.'
          : 'Storage policy blocked upload. Set SUPABASE_SERVICE_ROLE_KEY in .env.local and restart the dev server.'
        : 'Unable to upload profile photo.'

    return failBadRequest(fallbackMessage, {
      stage: 'storage-upload',
      error: uploadResult.error?.message,
      code: uploadResult.error?.statusCode,
      hasAdminClient: Boolean(adminSupabase),
      storagePath
    })
  }

  const warning = await persistAvatarPath({
    supabase,
    user,
    avatarPath: storagePath
  })

  if (previousAvatarPath && previousAvatarPath !== storagePath) {
    void uploadClient.storage.from(BUCKET_NAME).remove([previousAvatarPath])
  }

  return API_RESPONSES.ok(request, {
    warning,
    avatarPath: storagePath,
    avatarUrl: buildAvatarUrl(storagePath)
  })
}

export async function PATCH(request) {
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
    scope: 'account-avatar-update',
    identifier: user.id,
    limit: 30,
    windowMs: 5 * 60_000,
    message: 'Too many avatar updates. Please wait before trying again.'
  })

  if (rateLimitError) {
    return rateLimitError
  }

  let payload

  try {
    payload = await request.json()
  } catch {
    return API_RESPONSES.badRequest(request, 'Invalid avatar update payload.')
  }

  const avatarPath = toText(payload?.avatarPath)
  const previousAvatarPath = toText(payload?.previousAvatarPath || '')

  if (!isPathSafe(avatarPath) || !isStoragePathOwnedByUser(avatarPath, user.id)) {
    return API_RESPONSES.badRequest(request, 'Avatar path must belong to your account.')
  }

  const warning = await persistAvatarPath({
    supabase,
    user,
    avatarPath
  })

  if (previousAvatarPath && previousAvatarPath !== avatarPath && isStoragePathOwnedByUser(previousAvatarPath, user.id)) {
    const adminSupabase = createAdminClient()
    const deleteClient = adminSupabase || supabase

    void deleteClient.storage.from(BUCKET_NAME).remove([previousAvatarPath])
  }

  return API_RESPONSES.ok(request, {
    warning,
    avatarPath,
    avatarUrl: buildAvatarUrl(avatarPath)
  })
}
