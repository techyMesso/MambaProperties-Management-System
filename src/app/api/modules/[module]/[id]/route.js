import { API_RESPONSES } from '@/libs/api/apiResponses'
import { resolveUserRole } from '@/libs/auth/resolveRole'
import { canAccessPath } from '@/libs/auth/roles'
import { enforceSameOriginMutation, isStoragePathOwnedByUser } from '@/libs/security/requestGuards'
import { createClient as createServerSupabaseClient } from '@/libs/supabase/server'
import { canCreateModuleForRole, getModuleDefinition } from '@/libs/property/modules'
import { evaluateModuleAccessGate } from '@/libs/access/moduleGates'

const moduleRouteMap = {
  properties: '/properties',
  units: '/units',
  tenants: '/tenants',
  tenancies: '/tenancies'
}

const editableModules = new Set(['properties', 'units', 'tenants', 'tenancies'])
const resolveRouteParams = async params => (params ? await params : {})

const getModulePath = moduleKey => moduleRouteMap[moduleKey] || `/${moduleKey}`

const resolveModuleContext = moduleKey => {
  if (!editableModules.has(moduleKey)) {
    return null
  }

  const definition = getModuleDefinition(moduleKey)

  if (!definition?.table) {
    return null
  }

  return {
    definition,
    modulePath: getModulePath(moduleKey)
  }
}

const getRequestContext = async (request, moduleKey) => {
  const resolved = resolveModuleContext(moduleKey)

  if (!resolved) {
    return {
      error: API_RESPONSES.notFound(request, 'Unsupported module.')
    }
  }

  const supabase = await createServerSupabaseClient()

  if (!supabase) {
    return {
      error: API_RESPONSES.unavailable(request, 'Supabase is not configured.')
    }
  }

  const {
    data: { user }
  } = await supabase.auth.getUser()

  if (!user?.id) {
    return {
      error: API_RESPONSES.unauthorized(request)
    }
  }

  const role = await resolveUserRole(supabase, user)

  if (!canAccessPath(resolved.modulePath, role)) {
    return {
      error: API_RESPONSES.forbidden(request, 'Forbidden module for current user role.')
    }
  }

  const gate = await evaluateModuleAccessGate({
    supabase,
    role,
    userId: user.id,
    moduleKey
  })

  if (!gate.allowed) {
    return {
      error: API_RESPONSES.forbidden(request, gate.message)
    }
  }

  return {
    supabase,
    user,
    role,
    definition: resolved.definition
  }
}

export async function GET(request, { params }) {
  const routeParams = await resolveRouteParams(params)
  const moduleKey = String(routeParams?.module || '').trim()
  const recordId = String(routeParams?.id || '').trim()
  const context = await getRequestContext(request, moduleKey)

  if (context.error) {
    return context.error
  }

  const { supabase, definition } = context

  const { data, error } = await supabase.from(definition.table).select(definition.select).eq('id', recordId).maybeSingle()

  if (error) {
    return API_RESPONSES.badRequest(request, error.message)
  }

  if (!data) {
    return API_RESPONSES.notFound(request, 'Record not found.')
  }

  return API_RESPONSES.ok(
    request,
    { row: data },
    {
      headers: { 'Cache-Control': 'no-store' }
    }
  )
}

export async function PUT(request, { params }) {
  const originError = enforceSameOriginMutation(request)

  if (originError) {
    return originError
  }

  const routeParams = await resolveRouteParams(params)
  const moduleKey = String(routeParams?.module || '').trim()
  const recordId = String(routeParams?.id || '').trim()
  const context = await getRequestContext(request, moduleKey)

  if (context.error) {
    return context.error
  }

  const { supabase, role, definition, user } = context

  if (!definition.toUpdate || !canCreateModuleForRole(moduleKey, role)) {
    return API_RESPONSES.forbidden(request, 'Update action is disabled for this module and role.')
  }

  let body

  try {
    body = await request.json()
  } catch {
    return API_RESPONSES.badRequest(request, 'Invalid JSON payload.')
  }

  const values = body?.values || {}

  if (moduleKey === 'documents') {
    const filePath = String(values?.filePath || '').trim()

    if (filePath && role !== 'admin' && !isStoragePathOwnedByUser(filePath, user.id)) {
      return API_RESPONSES.badRequest(request, 'Document file path must belong to your account.')
    }
  }

  const updateRecord = definition.toUpdate(values)
  const payload = Object.fromEntries(Object.entries(updateRecord || {}).filter(([, value]) => value !== undefined))

  if (Object.keys(payload).length === 0) {
    return API_RESPONSES.badRequest(request, 'No fields provided for update.')
  }

  const { data, error } = await supabase.from(definition.table).update(payload).eq('id', recordId).select('id').maybeSingle()

  if (error) {
    return API_RESPONSES.badRequest(request, error.message)
  }

  if (!data) {
    return API_RESPONSES.notFound(request, 'Record not found or not writable.')
  }

  return API_RESPONSES.ok(request, { updated: true })
}

export async function DELETE(request, { params }) {
  const originError = enforceSameOriginMutation(request)

  if (originError) {
    return originError
  }

  const routeParams = await resolveRouteParams(params)
  const moduleKey = String(routeParams?.module || '').trim()
  const recordId = String(routeParams?.id || '').trim()
  const context = await getRequestContext(request, moduleKey)

  if (context.error) {
    return context.error
  }

  const { supabase, role } = context

  if (!canCreateModuleForRole(moduleKey, role)) {
    return API_RESPONSES.forbidden(request, 'Delete action is disabled for this module and role.')
  }

  const { data, error } = await supabase.from(context.definition.table).delete().eq('id', recordId).select('id').maybeSingle()

  if (error) {
    return API_RESPONSES.badRequest(request, error.message)
  }

  if (!data) {
    return API_RESPONSES.notFound(request, 'Record not found or not deletable.')
  }

  return API_RESPONSES.ok(request, { deleted: true })
}
