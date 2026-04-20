import { randomUUID } from 'crypto'

import { API_RESPONSES } from '@/libs/api/apiResponses'
import { enforceRequestSizeLimit, enforceSameOriginMutation } from '@/libs/security/requestGuards'
import { createClient as createServerSupabaseClient } from '@/libs/supabase/server'
import { BUCKET_NAME, MAX_FILE_SIZE_BYTES, MAX_UPLOAD_BYTES } from '@/libs/constants'

const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/avif',
  'image/heic',
  'image/heif',
  'image/jpeg',
  'image/png',
  'image/webp'
])

const ALLOWED_EXTENSIONS_BY_MIME = {
  'application/pdf': new Set(['pdf']),
  'application/msword': new Set(['doc']),
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': new Set(['docx']),
  'image/avif': new Set(['avif']),
  'image/heic': new Set(['heic']),
  'image/heif': new Set(['heif']),
  'image/jpeg': new Set(['jpg', 'jpeg', 'jfif']),
  'image/png': new Set(['png']),
  'image/webp': new Set(['webp'])
}

const EXTENSION_TO_MIME = {
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  avif: 'image/avif',
  heic: 'image/heic',
  heif: 'image/heif',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  jfif: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp'
}

const MIME_ALIASES = {
  'image/jpg': 'image/jpeg',
  'image/pjpeg': 'image/jpeg',
  'image/x-png': 'image/png'
}

const HEIF_BRANDS = new Set(['heic', 'heix', 'hevc', 'hevx', 'heif', 'heim', 'heis', 'hevm', 'hevs', 'mif1', 'msf1'])
const AVIF_BRANDS = new Set(['avif', 'avis', 'mif1', 'msf1'])
const UPLOAD_DEBUG = process.env.NODE_ENV !== 'production'

const debugUpload = (message, payload) => {
  if (!UPLOAD_DEBUG) {
    return
  }

  if (payload === undefined) {
    console.log(message)

    return
  }

  console.log(message, payload)
}

const sanitizeSegment = value => {
  const normalized = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')

  return normalized || 'documents'
}

const sanitizeFileName = value => {
  const normalized = String(value || 'upload.bin')
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')

  return normalized || 'upload.bin'
}

const getFileExtension = fileName => {
  const normalized = String(fileName || '')
    .trim()
    .toLowerCase()

  const lastDotIndex = normalized.lastIndexOf('.')

  if (lastDotIndex < 0 || lastDotIndex === normalized.length - 1) {
    return ''
  }

  return normalized.slice(lastDotIndex + 1)
}

const matchesPrefix = (bytes, prefix) => {
  if (bytes.length < prefix.length) {
    return false
  }

  return prefix.every((value, index) => bytes[index] === value)
}

const matchesTextAt = (bytes, offset, text) => {
  if (offset < 0 || bytes.length < offset + text.length) {
    return false
  }

  for (let index = 0; index < text.length; index += 1) {
    if (bytes[offset + index] !== text.charCodeAt(index)) {
      return false
    }
  }

  return true
}

const extractFtypBrands = bytes => {
  if (bytes.length < 16 || !matchesTextAt(bytes, 4, 'ftyp')) {
    return []
  }

  const brands = []

  for (let index = 8; index + 4 <= bytes.length; index += 4) {
    const brand = String.fromCharCode(bytes[index], bytes[index + 1], bytes[index + 2], bytes[index + 3]).toLowerCase()

    if (!/^[a-z0-9]{4}$/.test(brand)) {
      continue
    }

    brands.push(brand)
  }

  return brands
}

const matchesFileSignature = async (file, mimeType) => {
  const headerBytes = new Uint8Array(await file.slice(0, 8192).arrayBuffer())

  if (mimeType === 'application/pdf') {
    return matchesTextAt(headerBytes, 0, '%PDF-')
  }

  if (mimeType === 'application/msword') {
    return matchesPrefix(headerBytes, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])
  }

  if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    if (!matchesPrefix(headerBytes, [0x50, 0x4b, 0x03, 0x04])) {
      return false
    }

    const headerText = new TextDecoder().decode(headerBytes)

    return headerText.includes('[Content_Types].xml') || headerText.includes('word/')
  }

  if (mimeType === 'image/jpeg') {
    return matchesPrefix(headerBytes, [0xff, 0xd8, 0xff])
  }

  if (mimeType === 'image/png') {
    return matchesPrefix(headerBytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  }

  if (mimeType === 'image/webp') {
    return matchesTextAt(headerBytes, 0, 'RIFF') && matchesTextAt(headerBytes, 8, 'WEBP')
  }

  if (mimeType === 'image/heic' || mimeType === 'image/heif' || mimeType === 'image/avif') {
    const brands = extractFtypBrands(headerBytes)

    if (!brands.length) {
      return false
    }

    if (mimeType === 'image/avif') {
      return brands.some(brand => AVIF_BRANDS.has(brand))
    }

    return brands.some(brand => HEIF_BRANDS.has(brand))
  }

  return false
}

const resolveMimeType = (file, extension) => {
  const declaredRaw = String(file?.type || '')
    .trim()
    .toLowerCase()

  const declared = MIME_ALIASES[declaredRaw] || declaredRaw
  const inferred = String(EXTENSION_TO_MIME[extension] || '').toLowerCase()

  if (ALLOWED_MIME_TYPES.has(declared)) {
    return declared
  }

  if (ALLOWED_MIME_TYPES.has(inferred)) {
    return inferred
  }

  if (!declared || declared === 'application/octet-stream') {
    return inferred
  }

  return declared
}

export async function POST(request) {
  const originError = enforceSameOriginMutation(request)

  if (originError) {
    return originError
  }

  const sizeError = enforceRequestSizeLimit(request, {
    maxBytes: MAX_UPLOAD_BYTES,
    message: `Upload is too large. Maximum size is ${Math.floor(MAX_FILE_SIZE_BYTES / (1024 * 1024))} MB.`
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

  const formData = await request.formData()
  const file = formData.get('file')

  // Debug logging for upload issues
  const debugInfo = {
    hasFile: file instanceof File,
    fileName: file instanceof File ? file.name : null,
    fileSize: file instanceof File ? file.size : null,
    fileType: file instanceof File ? file.type : null
  }

  debugUpload('[Upload Debug] Received upload request:', debugInfo)

  if (!(file instanceof File)) {
    debugUpload('[Upload Debug] No file provided')

    return API_RESPONSES.badRequest(request, 'A file is required.')
  }

  const fileExtension = getFileExtension(file.name)
  const mimeType = resolveMimeType(file, fileExtension)

  debugUpload('[Upload Debug] File validation:', { fileExtension, resolvedMimeType: mimeType })

  if (!ALLOWED_MIME_TYPES.has(mimeType)) {
    debugUpload('[Upload Debug] Unsupported MIME type:', {
      mimeType,
      allowed: Array.from(ALLOWED_MIME_TYPES)
    })

    return API_RESPONSES.badRequest(
      request,
      `Unsupported file type: ${mimeType || 'unknown'}. Allowed: ${Array.from(ALLOWED_MIME_TYPES).join(', ')}`
    )
  }

  const allowedExtensions = ALLOWED_EXTENSIONS_BY_MIME[mimeType]
  const hasExtension = Boolean(fileExtension)

  if (hasExtension && !allowedExtensions?.has(fileExtension)) {
    debugUpload('[Upload Debug] Extension mismatch:', {
      fileExtension,
      allowedForMime: Array.from(allowedExtensions || [])
    })

    return API_RESPONSES.badRequest(
      request,
      `File extension "${fileExtension}" does not match content type "${mimeType}". Allowed extensions: ${Array.from(allowedExtensions || []).join(', ')}`
    )
  }

  const hasValidSignature = await matchesFileSignature(file, mimeType)

  if (!hasValidSignature) {
    debugUpload('[Upload Debug] Invalid file signature for MIME type:', mimeType)

    return API_RESPONSES.badRequest(
      request,
      `File content does not match declared file type (${mimeType}). The file may be corrupted or have an incorrect extension.`
    )
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    debugUpload('[Upload Debug] File too large:', { fileSize: file.size, maxSize: MAX_FILE_SIZE_BYTES })

    return API_RESPONSES.payloadTooLarge(
      request,
      `File is too large (${(file.size / (1024 * 1024)).toFixed(2)} MB). Maximum size is ${Math.floor(MAX_FILE_SIZE_BYTES / (1024 * 1024))} MB.`
    )
  }

  const moduleKey = sanitizeSegment(formData.get('moduleKey'))
  const fileName = sanitizeFileName(file.name)
  const storagePath = `${user.id}/${moduleKey}/${Date.now()}-${randomUUID()}-${fileName}`

  if (moduleKey === 'unit-media' && !mimeType.startsWith('image/')) {
    debugUpload('[Upload Debug] Unit media non-image file:', { moduleKey, mimeType })

    return API_RESPONSES.badRequest(request, `Module "${moduleKey}" accepts image files only. Received: ${mimeType}`)
  }

  debugUpload('[Upload Debug] Uploading to Supabase storage:', { bucket: BUCKET_NAME, storagePath, mimeType })

  const { error } = await supabase.storage.from(BUCKET_NAME).upload(storagePath, file, {
    contentType: mimeType || 'application/octet-stream',
    cacheControl: '3600',
    upsert: false
  })

  if (error) {
    debugUpload('[Upload Debug] Supabase storage error:', error)

    return API_RESPONSES.badRequest(
      request,
      `Storage upload failed: ${error.message}. Please try again or use a different file.`
    )
  }

  return API_RESPONSES.ok(request, {
    bucket: BUCKET_NAME,
    path: storagePath,
    size: file.size,
    mimeType,
    fileName
  })
}
