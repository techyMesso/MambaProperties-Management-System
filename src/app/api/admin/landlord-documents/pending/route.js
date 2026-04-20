import { API_RESPONSES } from '@/libs/api/apiResponses'
import { safeQuery } from '@/libs/api/safeQuery'
import { requireAdminContext } from '@/app/api/admin/_lib/requireAdminContext'
import { listTableColumns } from '@/app/api/admin/_lib/tableColumns'
import { enforceRouteRateLimit } from '@/libs/security/rateLimit'
import { mapKycDocumentRow } from '@/libs/landlord/kyc'

const toText = value => String(value || '').trim()
const MANAGEMENT_ROLES = new Set(['landlord', 'agent'])

const DOCUMENT_COLUMNS = [
  'id',
  'landlord_id',
  'document_type',
  'file_path',
  'file_name',
  'file_size',
  'mime_type',
  'verification_status',
  'verified_by',
  'verified_at',
  'rejection_reason',
  'verification_notes',
  'created_at',
  'updated_at'
]

const DOCUMENT_FALLBACK_COLUMNS = ['id', 'landlord_id', 'document_type', 'file_path', 'verification_status', 'created_at']
const PROFILE_COLUMNS = ['id', 'full_name', 'phone', 'email', 'role', 'requested_role', 'approval_status', 'kyc_verified']

const PROFILE_FALLBACK_COLUMNS = ['id', 'full_name', 'phone', 'role', 'requested_role', 'approval_status', 'kyc_verified']

const isMissingColumnError = error => {
  const message = toText(error?.message).toLowerCase()

  return message.includes('column') && message.includes('does not exist')
}

const isMissingRelationError = error => {
  const message = toText(error?.message).toLowerCase()

  return (message.includes('relation') || message.includes('table')) && message.includes('does not exist')
}

const isSchemaIntrospectionError = error => {
  const message = toText(error?.message).toLowerCase()

  return message.includes('information_schema') || message.includes('permission') || message.includes('does not exist')
}

const resolveManagementRole = profile => {
  const requestedRole = toText(profile?.requested_role).toLowerCase()
  const role = toText(profile?.role).toLowerCase()

  if (MANAGEMENT_ROLES.has(requestedRole)) {
    return requestedRole
  }

  if (MANAGEMENT_ROLES.has(role)) {
    return role
  }

  return requestedRole || role
}

export async function GET(request) {
  const context = await requireAdminContext(request)

  if (context.error) {
    return context.error
  }

  const { adminSupabase, user } = context
  const statusFilter = toText(request.nextUrl.searchParams.get('status') || 'pending').toLowerCase()

  const rateLimitError = await enforceRouteRateLimit(request, {
    scope: 'admin-landlord-documents-pending',
    identifier: user.id,
    limit: 60,
    windowMs: 60_000
  })

  if (rateLimitError) {
    return rateLimitError
  }

  try {
    let documentColumns
    let profileColumns

    try {
      ;[documentColumns, profileColumns] = await Promise.all([
        listTableColumns(adminSupabase, 'landlord_documents'),
        listTableColumns(adminSupabase, 'profiles')
      ])
    } catch (error) {
      if (isSchemaIntrospectionError(error)) {
        documentColumns = new Set(DOCUMENT_FALLBACK_COLUMNS)
        profileColumns = new Set(PROFILE_FALLBACK_COLUMNS)
      } else {
        throw error
      }
    }

    const selectableDocumentColumns = DOCUMENT_COLUMNS.filter(column => documentColumns.has(column))
    const documentSelect = (selectableDocumentColumns.length ? selectableDocumentColumns : DOCUMENT_FALLBACK_COLUMNS).join(',')

    const buildDocsQuery = selectClause =>
      adminSupabase.from('landlord_documents').select(selectClause).order('created_at', { ascending: false })

    let docsResult = await safeQuery(
      statusFilter === 'all' ? buildDocsQuery(documentSelect) : buildDocsQuery(documentSelect).eq('verification_status', statusFilter)
    )

    if (docsResult.error && isMissingColumnError(docsResult.error)) {
      docsResult = await safeQuery(
        statusFilter === 'all'
          ? buildDocsQuery(DOCUMENT_FALLBACK_COLUMNS.join(','))
          : buildDocsQuery(DOCUMENT_FALLBACK_COLUMNS.join(',')).eq('verification_status', statusFilter),
        { fallbackData: [] }
      )
    }

    if (docsResult.error) {
      if (isMissingColumnError(docsResult.error) || isMissingRelationError(docsResult.error)) {
        return API_RESPONSES.ok(request, {
          documents: [],
          summary: { pending: 0, approved: 0, rejected: 0 },
          warning: 'KYC document approval schema is not initialized. Run the latest migration.'
        })
      }

      return API_RESPONSES.badRequest(request, docsResult.error.message || 'Unable to load KYC documents.')
    }

    const docs = Array.isArray(docsResult.data) ? docsResult.data : []
    const landlordIds = [...new Set(docs.map(item => toText(item.landlord_id)).filter(Boolean))]
    const selectableProfileColumns = PROFILE_COLUMNS.filter(column => profileColumns.has(column))
    const profileSelect = (selectableProfileColumns.length ? selectableProfileColumns : PROFILE_FALLBACK_COLUMNS).join(',')

    let profileResult = landlordIds.length
      ? await safeQuery(adminSupabase.from('profiles').select(profileSelect).in('id', landlordIds))
      : { data: [], error: null }

    if (profileResult.error && isMissingColumnError(profileResult.error)) {
      const fallbackProfileSelect = PROFILE_FALLBACK_COLUMNS.filter(column => profileColumns.has(column)).join(',')

      profileResult = landlordIds.length
        ? await safeQuery(adminSupabase.from('profiles').select(fallbackProfileSelect || 'id,full_name,phone,role,requested_role,approval_status,kyc_verified').in('id', landlordIds))
        : { data: [], error: null }
    }

    if (profileResult.error) {
      if (isMissingColumnError(profileResult.error) || isMissingRelationError(profileResult.error)) {
        return API_RESPONSES.ok(request, {
          documents: [],
          summary: { pending: 0, approved: 0, rejected: 0 },
          warning: 'Profile approval schema is not fully initialized. Run the latest migration.'
        })
      }

      return API_RESPONSES.badRequest(request, profileResult.error.message || 'Unable to load account profiles.')
    }

    const profileMap = new Map((profileResult.data || []).map(item => [toText(item.id), item]))

    const summary = {
      pending: docs.filter(item => toText(item.verification_status).toLowerCase() === 'pending').length,
      approved: docs.filter(item => toText(item.verification_status).toLowerCase() === 'approved').length,
      rejected: docs.filter(item => ['rejected', 'resubmit'].includes(toText(item.verification_status).toLowerCase())).length
    }

    return API_RESPONSES.ok(request, {
      documents: docs.map(item => {
        const mapped = mapKycDocumentRow(item)
        const profile = profileMap.get(mapped.landlordId)

        return {
          ...mapped,
          landlord: profile
            ? {
                id: toText(profile.id),
                name: toText(profile.full_name),
                phone: toText(profile.phone),
                email: toText(profile.email),
                role: resolveManagementRole(profile),
                approvalStatus: toText(profile.approval_status),
                kycVerified: profile.kyc_verified === true
              }
            : null
        }
      }),
      summary
    })
  } catch (error) {
    return API_RESPONSES.internal(request, error.message || 'Unable to load pending KYC documents.')
  }
}
