export const KYC_DOCUMENT_TYPES = Object.freeze([
  'national_id',
  'passport',
  'ownership_certificate',
  'business_license',
  'business_registration'
])

export const KYC_DECISION_STATUSES = Object.freeze(['pending', 'approved', 'rejected', 'resubmit'])

export const KYC_IDENTITY_DOCUMENT_TYPES = new Set(['national_id', 'passport'])

export const KYC_DOCUMENT_LABELS = Object.freeze({
  national_id: 'National ID',
  passport: 'Passport',
  ownership_certificate: 'Ownership Certificate',
  business_license: 'Business License',
  business_registration: 'Business Registration'
})

export const isKycDocumentType = value => KYC_DOCUMENT_TYPES.includes(String(value || '').trim().toLowerCase())

export const isKycDecisionStatus = value => KYC_DECISION_STATUSES.includes(String(value || '').trim().toLowerCase())

export const getKycDocumentLabel = value => {
  const normalized = String(value || '').trim().toLowerCase()

  return KYC_DOCUMENT_LABELS[normalized] || normalized || 'Document'
}

export const mapKycDocumentRow = row => ({
  id: String(row?.id || '').trim(),
  landlordId: String(row?.landlord_id || '').trim(),
  documentType: String(row?.document_type || '').trim().toLowerCase(),
  documentLabel: getKycDocumentLabel(row?.document_type),
  filePath: String(row?.file_path || '').trim(),
  fileName: String(row?.file_name || '').trim(),
  fileSize: Number(row?.file_size || 0) || 0,
  mimeType: String(row?.mime_type || '').trim(),
  verificationStatus: String(row?.verification_status || 'pending').trim().toLowerCase(),
  verifiedBy: String(row?.verified_by || '').trim(),
  verifiedAt: row?.verified_at || null,
  rejectionReason: String(row?.rejection_reason || '').trim(),
  verificationNotes: String(row?.verification_notes || '').trim(),
  createdAt: row?.created_at || null,
  updatedAt: row?.updated_at || null
})

export const syncLandlordKycStatus = async ({ supabase, landlordId }) => {
  if (!supabase || !landlordId) {
    return { kycVerified: false, documents: [] }
  }

  const { data, error } = await supabase
    .from('landlord_documents')
    .select('id,document_type,verification_status')
    .eq('landlord_id', landlordId)

  if (error) {
    throw new Error(error.message || 'Unable to read KYC documents.')
  }

  const documents = Array.isArray(data) ? data : []

  const hasApprovedIdentityDocument = documents.some(
    item =>
      String(item?.verification_status || '').trim().toLowerCase() === 'approved' &&
      KYC_IDENTITY_DOCUMENT_TYPES.has(String(item?.document_type || '').trim().toLowerCase())
  )

  const updatePayload = hasApprovedIdentityDocument
    ? {
        kyc_verified: true,
        kyc_verified_at: new Date().toISOString()
      }
    : {
        kyc_verified: false,
        kyc_verified_at: null
      }

  const { error: updateError } = await supabase.from('profiles').update(updatePayload).eq('id', landlordId)

  if (updateError) {
    throw new Error(updateError.message || 'Unable to sync KYC verification status.')
  }

  return {
    kycVerified: hasApprovedIdentityDocument,
    documents
  }
}
