const sanitizeCode = value =>
  String(value || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')

const uploadAgreementFile = async file => {
  const formData = new FormData()

  formData.set('file', file)
  formData.set('moduleKey', 'tenancy-agreements')

  const response = await fetch('/api/storage/documents/upload', {
    method: 'POST',
    body: formData
  })

  const body = await response.json().catch(() => ({}))

  if (!response.ok || !body?.path) {
    throw new Error(body?.error || 'Unable to upload agreement file.')
  }

  return body.path
}

const createAgreementDocument = async ({ docId, tenantName, filePath }) => {
  const response = await fetch('/api/modules/documents', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      values: {
        docId,
        type: 'tenancy_agreement',
        owner: tenantName,
        filePath,
        uploaded: new Date().toISOString().slice(0, 10),
        status: 'active'
      }
    })
  })

  const body = await response.json().catch(() => ({}))

  if (!response.ok) {
    throw new Error(body?.error || 'Unable to create agreement document.')
  }
}

export const uploadTenancyAgreement = async ({ agreementId, tenantName, file }) => {
  if (!(file instanceof File) || !file.size) {
    return
  }

  const normalizedAgreementId = sanitizeCode(agreementId) || `AGMT-${Date.now()}`
  const normalizedTenantName = String(tenantName || '').trim() || 'Tenant'
  const filePath = await uploadAgreementFile(file)
  const baseDocId = `AGMT-${normalizedAgreementId}`

  try {
    await createAgreementDocument({
      docId: baseDocId,
      tenantName: normalizedTenantName,
      filePath
    })
  } catch (error) {
    const message = String(error?.message || '').toLowerCase()

    if (message.includes('duplicate key') || message.includes('already exists')) {
      await createAgreementDocument({
        docId: `${baseDocId}-${Date.now()}`,
        tenantName: normalizedTenantName,
        filePath
      })

      return
    }

    throw error
  }
}
