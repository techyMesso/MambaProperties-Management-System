import { USER_ROLES } from '@/libs/auth/roles'
import { checkLandlordApprovalStatus, checkManagementModuleAccess, checkMarketplaceListingAccess } from '@/libs/landlord/featureAccess'
import { checkHouseSearchAccess } from '@/libs/tenant/subscriptionAccess'

const LANDLORD_MANAGEMENT_MODULES = new Set([
  'properties',
  'units',
  'tenants',
  'tenancies',
  'payments',
  'invoices',
  'maintenance',
  'messaging',
  'documents',
  'reports'
])

const LANDLORD_MARKETING_MODULES = new Set(['marketplace'])

const toText = value => String(value || '').trim()

const toDenied = (message, reason, status = 403) => ({
  allowed: false,
  status,
  reason: toText(reason) || 'access_denied',
  message: toText(message) || 'Access denied.'
})

const toAllowed = () => ({
  allowed: true
})

export const getLandlordManagementModules = () => LANDLORD_MANAGEMENT_MODULES

export const evaluateModuleAccessGate = async ({ supabase, role, userId, moduleKey }) => {
  const normalizedRole = toText(role).toLowerCase()
  const normalizedModule = toText(moduleKey)
  const isManagedLandlordRole = normalizedRole === USER_ROLES.LANDLORD || normalizedRole === USER_ROLES.AGENT

  if (!supabase || !userId || !normalizedModule) {
    return toAllowed()
  }

  if (normalizedRole === USER_ROLES.TENANT && normalizedModule === 'marketplace') {
    const access = await checkHouseSearchAccess(supabase, userId)

    if (!access?.hasAccess) {
      return toDenied(access?.message || 'You need an active house-search subscription.', access?.reason || 'subscription_required', 403)
    }
  }

  if (isManagedLandlordRole) {
    const needsManagement = LANDLORD_MANAGEMENT_MODULES.has(normalizedModule)
    const needsMarketing = LANDLORD_MARKETING_MODULES.has(normalizedModule)

    if (needsManagement || needsMarketing) {
      const approval = await checkLandlordApprovalStatus(supabase, userId)

      if (!approval?.isApproved) {
        return toDenied(approval?.message || 'Landlord account must be approved first.', approval?.reason || 'landlord_not_approved', 403)
      }
    }

    if (needsManagement) {
      const management = await checkManagementModuleAccess(supabase, userId)

      if (!management?.hasAccess) {
        return toDenied(management?.message || 'Management module subscription is required.', management?.reason || 'management_subscription_required', 403)
      }
    }

    if (needsMarketing) {
      const marketing = await checkMarketplaceListingAccess(supabase, userId)

      if (!marketing?.hasAccess) {
        return toDenied(marketing?.message || 'Marketplace listing subscription is required.', marketing?.reason || 'marketplace_subscription_required', 403)
      }
    }
  }

  return toAllowed()
}
