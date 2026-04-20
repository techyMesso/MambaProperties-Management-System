import { API_RESPONSES } from '@/libs/api/apiResponses'
import { safeQuery } from '@/libs/api/safeQuery'
import { requireAdminContext } from '@/app/api/admin/_lib/requireAdminContext'
import { firstColumn, firstValue, listTableColumns } from '@/app/api/admin/_lib/tableColumns'
import { enforceRouteRateLimit } from '@/libs/security/rateLimit'
import { toText } from '@/libs/admin/transforms'

const PLOTS_TABLE = 'plots'
const PROFILES_TABLE = 'profiles'

const toBoolean = value => value === true

const PLOT_COLUMNS = [
  'id',
  'plot_id',
  'plot_number',
  'plot_name',
  'name',
  'location',
  'manager',
  'owner_id',
  'approval_status',
  'ownership_verified',
  'created_at',
  'updated_at'
]

const PLOT_COLUMNS_FALLBACK = [
  'id',
  'plot_id',
  'name',
  'location',
  'manager',
  'owner_id',
  'approval_status',
  'ownership_verified',
  'created_at',
  'updated_at'
]

const PROFILE_COLUMNS = ['id', 'full_name', 'phone', 'email', 'approval_status', 'kyc_verified']

const isSchemaIntrospectionError = error => {
  const message = String(error?.message || '').toLowerCase()

  return message.includes('information_schema') || message.includes('does not exist') || message.includes('permission')
}

const isMissingColumnError = error => {
  const message = String(error?.message || '').toLowerCase()

  return message.includes('column') && message.includes('does not exist')
}

const isMissingRelationError = error => {
  const message = String(error?.message || '').toLowerCase()

  return (message.includes('relation') || message.includes('table')) && message.includes('does not exist')
}

export async function GET(request) {
  const context = await requireAdminContext(request)

  if (context.error) {
    return context.error
  }

  const { adminSupabase, user } = context

  const rateLimitError = await enforceRouteRateLimit(request, {
    scope: 'admin-plots-pending',
    identifier: user.id,
    limit: 60,
    windowMs: 60_000
  })

  if (rateLimitError) {
    return rateLimitError
  }

  let plotTableColumns

  try {
    plotTableColumns = await listTableColumns(adminSupabase, PLOTS_TABLE)
  } catch (error) {
    if (isSchemaIntrospectionError(error)) {
      plotTableColumns = new Set(PLOT_COLUMNS_FALLBACK)
    } else {
      return API_RESPONSES.badRequest(request, error.message || 'Unable to inspect plots schema.')
    }
  }

  if (!plotTableColumns.has('id') || !plotTableColumns.has('approval_status')) {
    return API_RESPONSES.ok(request, {
      count: 0,
      plots: [],
      warning: 'Plots approval schema is not initialized. Run the latest migration.'
    })
  }

  const selectablePlotColumns = PLOT_COLUMNS.filter(column => plotTableColumns.has(column))
  const orderColumn = firstColumn(plotTableColumns, ['created_at', 'updated_at', 'id'])
  const ownerColumn = firstColumn(plotTableColumns, ['owner_id'])

  let plotQuery = adminSupabase
    .from(PLOTS_TABLE)
    .select(selectablePlotColumns.join(','))
    .eq('approval_status', 'pending')

  if (orderColumn) {
    plotQuery = plotQuery.order(orderColumn, { ascending: false })
  }

  let plotsResult = await safeQuery(plotQuery, { fallbackData: [] })

  if (plotsResult.error && isMissingColumnError(plotsResult.error)) {
    const fallbackColumns = PLOT_COLUMNS_FALLBACK.filter(column => plotTableColumns.has(column))

    const fallbackQuery = adminSupabase
      .from(PLOTS_TABLE)
      .select(fallbackColumns.join(','))
      .eq('approval_status', 'pending')

    if (orderColumn) {
      fallbackQuery.order(orderColumn, { ascending: false })
    }

    plotsResult = await safeQuery(fallbackQuery, { fallbackData: [] })
  }

  if (plotsResult.error) {
    if (isMissingColumnError(plotsResult.error) || isMissingRelationError(plotsResult.error)) {
      return API_RESPONSES.ok(request, {
        count: 0,
        plots: [],
        warning: 'Plots approval schema is not initialized. Run the latest migration.'
      })
    }

    return API_RESPONSES.badRequest(request, plotsResult.error.message || 'Unable to load pending plots.')
  }

  const ownerIds = [...new Set((plotsResult.data || []).map(plot => toText(plot?.[ownerColumn])).filter(Boolean))]
  const ownerMap = new Map()

  if (ownerIds.length) {
    try {
      let profileTableColumns = await listTableColumns(adminSupabase, PROFILES_TABLE).catch(error => {
        if (isSchemaIntrospectionError(error)) {
          return new Set(PROFILE_COLUMNS)
        }

        throw error
      })
      const selectableProfileColumns = PROFILE_COLUMNS.filter(column => profileTableColumns.has(column))

      if (selectableProfileColumns.includes('id')) {
        const ownersResult = await safeQuery(
          adminSupabase.from(PROFILES_TABLE).select(selectableProfileColumns.join(',')).in('id', ownerIds),
          { fallbackData: [] }
        )

        if (ownersResult.error) {
          return API_RESPONSES.badRequest(request, ownersResult.error.message || 'Unable to load plot owner profiles.')
        }

        ;(ownersResult.data || []).forEach(owner => {
          ownerMap.set(toText(owner?.id), owner)
        })
      }
    } catch {
      // Owner profile lookup is optional metadata for this queue response.
    }
  }

  const normalizedPlots = (plotsResult.data || []).map(plot => {
    const ownerId = toText(plot?.[ownerColumn])
    const owner = ownerMap.get(ownerId)
    const plotName = toText(firstValue(plot, ['plot_name', 'name', 'plot_number', 'plot_id']))
    const plotCode = toText(firstValue(plot, ['plot_id', 'plot_number']))

    return {
      id: toText(plot?.id),
      plot_name: plotName || plotCode || 'Unnamed Plot',
      plot_id: plotCode,
      location: toText(plot?.location),
      manager: toText(plot?.manager),
      status: toText(plot?.approval_status || 'pending'),
      ownership_verified: toBoolean(plot?.ownership_verified),
      submitted_at: toText(firstValue(plot, ['created_at', 'updated_at'])),
      owner: {
        id: ownerId,
        name: toText(owner?.full_name) || 'Unknown Owner',
        phone: toText(owner?.phone),
        email: toText(owner?.email),
        status: toText(owner?.approval_status),
        kyc_verified: toBoolean(owner?.kyc_verified)
      }
    }
  })

  return API_RESPONSES.ok(request, {
    count: normalizedPlots.length,
    plots: normalizedPlots
  })
}
