export const USER_ROLES = Object.freeze({
  ADMIN: 'admin',
  LANDLORD: 'landlord',
  AGENT: 'agent',
  TENANT: 'tenant'
})

export const DEFAULT_ROLE = USER_ROLES.TENANT

export const VALID_ROLES = Object.freeze(Object.values(USER_ROLES))

const allRoles = [...VALID_ROLES]
const managementRoles = [USER_ROLES.ADMIN, USER_ROLES.LANDLORD, USER_ROLES.AGENT]
const financeRoles = [...managementRoles, USER_ROLES.TENANT]
const tenantServiceRoles = [...managementRoles, USER_ROLES.TENANT]

const routeRoleRules = [
  { prefix: '/dashboard', roles: allRoles },
  { prefix: '/admin-dashboard', roles: [USER_ROLES.ADMIN] },
  { prefix: '/landlord-verification', roles: [USER_ROLES.ADMIN] },
  { prefix: '/landlord-leads', roles: [USER_ROLES.ADMIN] },
  { prefix: '/onboarding-pipeline', roles: [USER_ROLES.ADMIN] },
  { prefix: '/subscriptions-plans', roles: [USER_ROLES.ADMIN] },
  { prefix: '/fees-commissions', roles: [USER_ROLES.ADMIN] },
  { prefix: '/income-analytics', roles: [USER_ROLES.ADMIN] },
  { prefix: '/user-management', roles: [USER_ROLES.ADMIN] },
  { prefix: '/payments-monitoring', roles: [USER_ROLES.ADMIN] },
  { prefix: '/audit-security', roles: [USER_ROLES.ADMIN] },
  { prefix: '/documents-review', roles: [USER_ROLES.ADMIN] },
  { prefix: '/system-settings', roles: [USER_ROLES.ADMIN] },
  { prefix: '/landlord-dashboard', roles: [USER_ROLES.ADMIN, USER_ROLES.LANDLORD] },
  { prefix: '/agent-dashboard', roles: [USER_ROLES.ADMIN, USER_ROLES.AGENT] },
  { prefix: '/subscription-center', roles: [USER_ROLES.LANDLORD, USER_ROLES.AGENT] },
  { prefix: '/tenant-dashboard', roles: [USER_ROLES.TENANT] },
  { prefix: '/admin', roles: [USER_ROLES.ADMIN] },
  { prefix: '/reports', roles: managementRoles },
  { prefix: '/properties', roles: managementRoles },
  { prefix: '/units', roles: managementRoles },
  { prefix: '/tenants', roles: managementRoles },
  { prefix: '/tenancies', roles: managementRoles },
  { prefix: '/payments', roles: financeRoles },
  { prefix: '/invoices', roles: financeRoles },
  { prefix: '/maintenance', roles: tenantServiceRoles },
  { prefix: '/messaging', roles: tenantServiceRoles },
  { prefix: '/documents', roles: tenantServiceRoles },
  { prefix: '/marketplace', roles: tenantServiceRoles }
]

const defaultRoleHome = {
  [USER_ROLES.ADMIN]: '/admin-dashboard',
  [USER_ROLES.LANDLORD]: '/landlord-dashboard',
  [USER_ROLES.AGENT]: '/agent-dashboard',
  [USER_ROLES.TENANT]: '/tenant-dashboard'
}

export const normalizeRole = role => {
  if (typeof role !== 'string') {
    return ''
  }

  return role.trim().toLowerCase()
}

export const isValidRole = role => VALID_ROLES.includes(normalizeRole(role))

export const getAllowedRolesForPath = pathname => {
  const matchedRule = routeRoleRules.find(rule => pathname === rule.prefix || pathname.startsWith(`${rule.prefix}/`))

  return matchedRule?.roles ?? VALID_ROLES
}

export const canAccessPath = (pathname, role) => {
  const normalizedRole = normalizeRole(role)

  return getAllowedRolesForPath(pathname).includes(normalizedRole)
}

export const getHomeForRole = role => {
  const normalizedRole = normalizeRole(role)

  return defaultRoleHome[normalizedRole] ?? '/dashboard'
}
