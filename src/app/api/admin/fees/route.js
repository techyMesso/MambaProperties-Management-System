import { API_RESPONSES } from '@/libs/api/apiResponses'
import { safeQuery } from '@/libs/api/safeQuery'
import { requireAdminContext } from '@/app/api/admin/_lib/requireAdminContext'
import { firstColumn, listTableColumns, toBooleanOrNull, toNumberOrNull } from '@/app/api/admin/_lib/tableColumns'
import { toText, normalizeStatus, tryAuditLog } from '@/libs/admin/transforms'
import { DEFAULT_CURRENCY } from '@/libs/constants'

const TABLE_NAME = 'platform_fee_rules'

const NAME_COLUMNS = ['rule_name', 'name', 'code', 'fee_type']
const SCOPE_COLUMNS = ['scope', 'applies_to']
const STATUS_COLUMNS = ['status']
const ACTIVE_COLUMNS = ['active', 'is_active']
const RATE_PERCENT_COLUMNS = ['rate_percent', 'percentage', 'commission_percent']
const FLAT_AMOUNT_COLUMNS = ['flat_amount', 'amount', 'fixed_fee']
const CURRENCY_COLUMNS = ['currency']
const OWNER_COLUMNS = ['owner_id']
const UPDATED_AT_COLUMNS = ['updated_at']

export async function POST(request) {
  const context = await requireAdminContext(request, { enforceMutationOrigin: true })

  if (context.error) {
    return context.error
  }

  const { adminSupabase, user } = context

  let body

  try {
    body = await request.json()
  } catch {
    return API_RESPONSES.badRequest(request, 'Invalid JSON payload.')
  }

  const ruleName = toText(body?.ruleName)
  const scope = toText(body?.scope)
  const status = normalizeStatus(body?.status || 'active')
  const ratePercent = toNumberOrNull(body?.ratePercent)
  const flatAmount = toNumberOrNull(body?.flatAmount)
  const activeInput = toBooleanOrNull(body?.active)
  const note = toText(body?.note)
  const nowIso = new Date().toISOString()

  if (!ruleName) {
    return API_RESPONSES.badRequest(request, 'ruleName is required.')
  }

  if (ratePercent === null && flatAmount === null) {
    return API_RESPONSES.badRequest(request, 'Provide ratePercent or flatAmount.')
  }

  if (ratePercent !== null && (ratePercent < 0 || ratePercent > 100)) {
    return API_RESPONSES.badRequest(request, 'ratePercent must be between 0 and 100.')
  }

  if (flatAmount !== null && flatAmount < 0) {
    return API_RESPONSES.badRequest(request, 'flatAmount must be 0 or greater.')
  }

  let columns

  try {
    columns = await listTableColumns(adminSupabase, TABLE_NAME)
  } catch (error) {
    return API_RESPONSES.badRequest(request, error.message || 'Unable to inspect fee rules schema.')
  }

  const payload = {}

  const nameColumn = firstColumn(columns, NAME_COLUMNS)
  const scopeColumn = firstColumn(columns, SCOPE_COLUMNS)
  const statusColumn = firstColumn(columns, STATUS_COLUMNS)
  const activeColumn = firstColumn(columns, ACTIVE_COLUMNS)
  const ratePercentColumn = firstColumn(columns, RATE_PERCENT_COLUMNS)
  const flatAmountColumn = firstColumn(columns, FLAT_AMOUNT_COLUMNS)
  const currencyColumn = firstColumn(columns, CURRENCY_COLUMNS)
  const ownerColumn = firstColumn(columns, OWNER_COLUMNS)
  const updatedAtColumn = firstColumn(columns, UPDATED_AT_COLUMNS)

  if (nameColumn) {
    payload[nameColumn] = ruleName
  }

  if (scopeColumn && scope) {
    payload[scopeColumn] = scope
  }

  if (statusColumn) {
    payload[statusColumn] = status
  }

  if (activeColumn) {
    payload[activeColumn] = activeInput ?? !['inactive', 'disabled', 'archived'].includes(status)
  }

  if (ratePercentColumn && ratePercent !== null) {
    payload[ratePercentColumn] = ratePercent
  }

  if (flatAmountColumn && flatAmount !== null) {
    payload[flatAmountColumn] = flatAmount
  }

  if (currencyColumn) {
    payload[currencyColumn] = toText(body?.currency) || DEFAULT_CURRENCY
  }

  if (ownerColumn) {
    payload[ownerColumn] = user.id
  }

  if (updatedAtColumn) {
    payload[updatedAtColumn] = nowIso
  }

  if (Object.keys(payload).length === 0) {
    return API_RESPONSES.badRequest(request, 'No writable fields were found for this fee rules schema.')
  }

  const insertResult = await safeQuery(adminSupabase.from(TABLE_NAME).insert(payload).select('*').maybeSingle())

  if (insertResult.error) {
    return API_RESPONSES.badRequest(request, insertResult.error.message || 'Unable to create fee rule.')
  }

  if (!insertResult.data) {
    return API_RESPONSES.badRequest(request, 'Unable to create fee rule.')
  }

  await tryAuditLog({
    supabase: adminSupabase,
    user,
    entity: 'Platform Fee Rule',
    action: 'Fee Rule Created',
    status: 'completed',
    note
  })

  return API_RESPONSES.created(request, {
    id: insertResult.data.id || null,
    ruleName,
    scope: scope || null,
    status
  })
}
