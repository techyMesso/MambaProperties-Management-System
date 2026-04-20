import { API_RESPONSES } from '@/libs/api/apiResponses'
import { safeQuery } from '@/libs/api/safeQuery'
import { requireAdminContext } from '@/app/api/admin/_lib/requireAdminContext'
import {
  UUID_REGEX,
  firstColumn,
  listTableColumns,
  toBooleanOrNull,
  toNumberOrNull
} from '@/app/api/admin/_lib/tableColumns'
import { toText, normalizeStatus, tryAuditLog } from '@/libs/admin/transforms'

const TABLE_NAME = 'platform_fee_rules'

const NAME_COLUMNS = ['rule_name', 'name', 'code', 'fee_type']
const SCOPE_COLUMNS = ['scope', 'applies_to']
const STATUS_COLUMNS = ['status']
const ACTIVE_COLUMNS = ['active', 'is_active']
const RATE_PERCENT_COLUMNS = ['rate_percent', 'percentage', 'commission_percent']
const FLAT_AMOUNT_COLUMNS = ['flat_amount', 'amount', 'fixed_fee']
const CURRENCY_COLUMNS = ['currency']
const UPDATED_AT_COLUMNS = ['updated_at']

const findFeeRule = async ({ supabase, columns, feeId }) => {
  const hasIdColumn = columns.has('id')
  const idIsUuid = UUID_REGEX.test(feeId)

  if (hasIdColumn && idIsUuid) {
    const byId = await supabase.from(TABLE_NAME).select('*').eq('id', feeId).maybeSingle()

    if (byId.error) {
      throw new Error(byId.error.message || 'Unable to load fee rule.')
    }

    if (byId.data) {
      return {
        row: byId.data,
        match: { id: feeId }
      }
    }
  }

  const codeColumn = firstColumn(columns, ['code', 'rule_name', 'name'])

  if (codeColumn) {
    const byCode = await supabase.from(TABLE_NAME).select('*').eq(codeColumn, feeId).maybeSingle()

    if (byCode.error) {
      throw new Error(byCode.error.message || 'Unable to load fee rule.')
    }

    if (byCode.data) {
      return {
        row: byCode.data,
        match: { [codeColumn]: feeId }
      }
    }
  }

  if (hasIdColumn) {
    const byIdFallback = await supabase.from(TABLE_NAME).select('*').eq('id', feeId).maybeSingle()

    if (byIdFallback.error) {
      throw new Error(byIdFallback.error.message || 'Unable to load fee rule.')
    }

    if (byIdFallback.data) {
      return {
        row: byIdFallback.data,
        match: { id: feeId }
      }
    }
  }

  return {
    row: null,
    match: null
  }
}

export async function PUT(request, { params }) {
  const context = await requireAdminContext(request, { enforceMutationOrigin: true })

  if (context.error) {
    return context.error
  }

  const { adminSupabase, user } = context
  const feeId = toText((await params).feeId)

  if (!feeId) {
    return API_RESPONSES.badRequest(request, 'Fee rule id is required.')
  }

  let body

  try {
    body = await request.json()
  } catch {
    return API_RESPONSES.badRequest(request, 'Invalid JSON payload.')
  }

  let columns

  try {
    columns = await listTableColumns(adminSupabase, TABLE_NAME)
  } catch (error) {
    return API_RESPONSES.badRequest(request, error.message || 'Unable to inspect fee rules schema.')
  }

  let target
  let match

  try {
    const resolved = await findFeeRule({
      supabase: adminSupabase,
      columns,
      feeId
    })

    target = resolved.row
    match = resolved.match
  } catch (error) {
    return API_RESPONSES.badRequest(request, error.message || 'Unable to load fee rule.')
  }

  if (!target || !match) {
    return API_RESPONSES.notFound(request, 'Fee rule not found.')
  }

  const payload = {}
  const nowIso = new Date().toISOString()
  const note = toText(body?.note)

  const nameColumn = firstColumn(columns, NAME_COLUMNS)
  const scopeColumn = firstColumn(columns, SCOPE_COLUMNS)
  const statusColumn = firstColumn(columns, STATUS_COLUMNS)
  const activeColumn = firstColumn(columns, ACTIVE_COLUMNS)
  const ratePercentColumn = firstColumn(columns, RATE_PERCENT_COLUMNS)
  const flatAmountColumn = firstColumn(columns, FLAT_AMOUNT_COLUMNS)
  const currencyColumn = firstColumn(columns, CURRENCY_COLUMNS)
  const updatedAtColumn = firstColumn(columns, UPDATED_AT_COLUMNS)

  const ruleName = toText(body?.ruleName)
  const scope = toText(body?.scope)
  const status = normalizeStatus(body?.status)
  const ratePercent = toNumberOrNull(body?.ratePercent)
  const flatAmount = toNumberOrNull(body?.flatAmount)
  const active = toBooleanOrNull(body?.active)
  const clearFlatAmount = body?.clearFlatAmount === true
  const clearRatePercent = body?.clearRatePercent === true
  const currency = toText(body?.currency)

  if (ratePercent !== null && (ratePercent < 0 || ratePercent > 100)) {
    return API_RESPONSES.badRequest(request, 'ratePercent must be between 0 and 100.')
  }

  if (flatAmount !== null && flatAmount < 0) {
    return API_RESPONSES.badRequest(request, 'flatAmount must be 0 or greater.')
  }

  if (nameColumn && ruleName) {
    payload[nameColumn] = ruleName
  }

  if (scopeColumn && scope) {
    payload[scopeColumn] = scope
  }

  if (statusColumn && status) {
    payload[statusColumn] = status
  }

  if (activeColumn && active !== null) {
    payload[activeColumn] = active
  }

  if (ratePercentColumn) {
    if (ratePercent !== null) {
      payload[ratePercentColumn] = ratePercent
    } else if (clearRatePercent) {
      payload[ratePercentColumn] = null
    }
  }

  if (flatAmountColumn) {
    if (flatAmount !== null) {
      payload[flatAmountColumn] = flatAmount
    } else if (clearFlatAmount) {
      payload[flatAmountColumn] = null
    }
  }

  if (currencyColumn && currency) {
    payload[currencyColumn] = currency
  }

  if (updatedAtColumn) {
    payload[updatedAtColumn] = nowIso
  }

  if (Object.keys(payload).length === 0) {
    return API_RESPONSES.badRequest(request, 'No editable fields were provided.')
  }

  const updateResult = await safeQuery(
    adminSupabase.from(TABLE_NAME).update(payload).match(match).select('*').maybeSingle()
  )

  if (updateResult.error) {
    return API_RESPONSES.badRequest(request, updateResult.error.message || 'Unable to update fee rule.')
  }

  if (!updateResult.data) {
    return API_RESPONSES.notFound(request, 'Fee rule not found or not writable.')
  }

  await tryAuditLog({
    supabase: adminSupabase,
    user,
    entity: 'Platform Fee Rule',
    action: 'Fee Rule Updated',
    status: 'completed',
    note
  })

  return API_RESPONSES.ok(request, {
    id: updateResult.data.id || target.id || null,
    status: toText(updateResult.data.status || payload.status || ''),
    updated: true
  })
}
