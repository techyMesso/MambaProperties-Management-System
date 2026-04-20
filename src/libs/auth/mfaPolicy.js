import { USER_ROLES, normalizeRole } from './roles'

export const MFA_REQUIRED_ROLES = new Set([USER_ROLES.ADMIN, USER_ROLES.LANDLORD, USER_ROLES.AGENT])

const toText = value => String(value || '').trim()

export const isMfaRequiredRole = role => MFA_REQUIRED_ROLES.has(normalizeRole(role))

export const getVerifiedMfaFactors = user => {
  const factors = Array.isArray(user?.factors) ? user.factors : []

  return factors.filter(factor => toText(factor?.status).toLowerCase() === 'verified')
}

export const getMfaPolicyState = ({ role, user }) => {
  const normalizedRole = normalizeRole(role)
  const factorsKnown = Array.isArray(user?.factors)
  const verifiedFactors = getVerifiedMfaFactors(user)
  const mfaRequired = isMfaRequiredRole(normalizedRole)
  const hasVerifiedFactor = verifiedFactors.length > 0

  return {
    role: normalizedRole,
    mfaRequired,
    factorsKnown,
    hasVerifiedFactor,
    verifiedFactorCount: verifiedFactors.length,
    verifiedFactors,
    shouldPromptForSetup: mfaRequired && (!factorsKnown || !hasVerifiedFactor),
    canEnforceSetup: mfaRequired && factorsKnown && !hasVerifiedFactor
  }
}

export const buildMfaSetupPath = nextPath => {
  const normalizedNext = toText(nextPath)
  const basePath = '/account-settings?security=mfa-required'

  if (!normalizedNext || normalizedNext.startsWith('/account-settings')) {
    return basePath
  }

  return `${basePath}&next=${encodeURIComponent(normalizedNext)}`
}
