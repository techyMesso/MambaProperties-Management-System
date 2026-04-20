const IMAGE_EXTENSIONS = new Set(['avif', 'heic', 'heif', 'jpeg', 'jpg', 'jfif', 'png', 'webp'])

const getExtension = fileName => {
  const normalized = String(fileName || '').trim().toLowerCase()
  const index = normalized.lastIndexOf('.')

  if (index < 0 || index === normalized.length - 1) {
    return ''
  }

  return normalized.slice(index + 1)
}

const isImageFile = file => {
  const mimeType = String(file?.type || '').toLowerCase()

  if (mimeType.startsWith('image/')) {
    return true
  }

  return IMAGE_EXTENSIONS.has(getExtension(file?.name))
}

const normalizeFiles = files => {
  if (Array.isArray(files)) {
    return files
  }

  if (files && typeof files.length === 'number') {
    return Array.from(files)
  }

  return []
}

const toImageFiles = files => normalizeFiles(files).filter(file => file instanceof File).filter(isImageFile)

const uploadOneFile = async file => {
  const formData = new FormData()

  formData.set('file', file)
  formData.set('moduleKey', 'unit-media')

  const response = await fetch('/api/storage/documents/upload', {
    method: 'POST',
    body: formData
  })

  const body = await response.json().catch(() => ({}))

  if (!response.ok || !body?.path) {
    throw new Error(body?.error || `Unable to upload ${file.name}.`)
  }

  return body.path
}

export const uploadUnitMediaFiles = async ({ files, onProgress }) => {
  const imageFiles = toImageFiles(files)

  if (!imageFiles.length) {
    return []
  }

  const uploadedPaths = []

  for (let index = 0; index < imageFiles.length; index += 1) {
    const path = await uploadOneFile(imageFiles[index])

    uploadedPaths.push(path)

    if (typeof onProgress === 'function') {
      onProgress(Math.round(((index + 1) / imageFiles.length) * 100))
    }
  }

  return uploadedPaths
}

export const attachUnitMedia = async ({ unitId, paths }) => {
  const normalizedPaths = (Array.isArray(paths) ? paths : []).map(path => String(path || '').trim()).filter(Boolean)

  if (!unitId || !normalizedPaths.length) {
    return []
  }

  const mediaPayload = normalizedPaths.map(path => ({
    path,
    isPrimary: false,
    caption: null
  }))

  const response = await fetch(`/api/modules/units/${unitId}/media`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      items: mediaPayload
    })
  })

  const body = await response.json().catch(() => ({}))

  if (!response.ok) {
    throw new Error(body?.error || 'Unable to save uploaded photos.')
  }

  return body?.items || []
}

export const uploadUnitMedia = async ({ unitId, files, onProgress }) => {
  const paths = await uploadUnitMediaFiles({ files, onProgress })

  return attachUnitMedia({
    unitId,
    paths
  })
}
