import 'server-only'

import { DEFAULT_CURRENCY, PRICING as FALLBACK_TENANT_PRICING } from '@/libs/constants'

const toText = value => String(value || '').trim()

const toNumber = value => {
  const parsed = Number(value)

  return Number.isFinite(parsed) ? parsed : null
}

const FALLBACK_PLAN_CATALOG = Object.freeze([
  {
    planCode: 'tenant_house_search',
    planName: 'Tenant House Search',
    description: 'Monthly marketplace access for tenants searching for a house.',
    audience: 'tenant',
    featureKey: 'house_search',
    billingCycle: 'monthly',
    amount: FALLBACK_TENANT_PRICING?.house_search?.amount ?? 299,
    currency: DEFAULT_CURRENCY,
    durationDays: FALLBACK_TENANT_PRICING?.house_search?.duration_days ?? 30,
    features: FALLBACK_TENANT_PRICING?.house_search?.features || ['Search listed houses', 'Contact landlords'],
    sortOrder: 10,
    active: true
  },
  {
    planCode: 'landlord_marketplace',
    planName: 'Marketplace Only',
    description: 'Annual listing access for landlords and agents who only want advertising.',
    audience: 'landlord_agent',
    featureKey: 'marketplace_listing',
    billingCycle: 'yearly',
    amount: 999,
    currency: DEFAULT_CURRENCY,
    durationDays: 365,
    features: ['List houses on marketplace', 'Receive tenant inquiries', 'Publish vacancy updates'],
    sortOrder: 20,
    active: true
  },
  {
    planCode: 'landlord_management',
    planName: 'Management Module Only',
    description: 'Annual management tools for landlords with existing tenants.',
    audience: 'landlord_agent',
    featureKey: 'management_module',
    billingCycle: 'yearly',
    amount: 1499,
    currency: DEFAULT_CURRENCY,
    durationDays: 365,
    features: ['Manage tenants', 'Record rent payments', 'Track rent balances', 'Send reminders'],
    sortOrder: 30,
    active: true
  },
  {
    planCode: 'landlord_full_access',
    planName: 'Full Subscription',
    description: 'Annual access to both marketplace and property management tools.',
    audience: 'landlord_agent',
    featureKey: 'full_access',
    billingCycle: 'yearly',
    amount: 2199,
    currency: DEFAULT_CURRENCY,
    durationDays: 365,
    features: ['Marketplace listings', 'Tenant inquiries', 'Tenant management', 'Rent tracking'],
    sortOrder: 40,
    active: true
  }
])

const PLAN_LOOKUP_ALIASES = {
  house_search: ['tenant_house_search', 'house_search'],
  marketplace_listing: ['landlord_marketplace', 'marketplace_listing'],
  management_module: ['landlord_management', 'management_module'],
  full_access: ['landlord_full_access', 'full_access']
}

const normalizeFeatures = value => {
  if (Array.isArray(value)) {
    return value.map(item => toText(item)).filter(Boolean)
  }

  if (typeof value === 'string') {
    return value
      .split('\n')
      .flatMap(item => item.split(','))
      .map(item => toText(item))
      .filter(Boolean)
  }

  return []
}

export const normalizeSubscriptionPlanRecord = row => ({
  id: toText(row?.id) || null,
  planCode: toText(row?.plan_code || row?.code || row?.feature_key),
  planName: toText(row?.plan_name || row?.name || row?.plan_code || row?.feature_key || 'Plan'),
  description: toText(row?.description),
  audience: toText(row?.audience || 'tenant'),
  featureKey: toText(row?.feature_key || row?.plan_code || row?.code),
  billingCycle: toText(row?.billing_cycle || 'monthly'),
  amount: toNumber(row?.amount) ?? 0,
  currency: toText(row?.currency || DEFAULT_CURRENCY) || DEFAULT_CURRENCY,
  durationDays: toNumber(row?.duration_days) ?? 30,
  features: normalizeFeatures(row?.features),
  sortOrder: toNumber(row?.sort_order) ?? 0,
  active: row?.active !== false,
  updatedAt: row?.updated_at || row?.created_at || null
})

const withFallbackPlans = rows => {
  if (Array.isArray(rows) && rows.length) {
    return rows.map(normalizeSubscriptionPlanRecord)
  }

  return FALLBACK_PLAN_CATALOG.map(item => ({ ...item }))
}

const getAliases = key => {
  const normalized = toText(key)

  return PLAN_LOOKUP_ALIASES[normalized] || [normalized]
}

const findPlanInCatalog = (catalog, key) => {
  const aliases = getAliases(key)

  return (
    (catalog || []).find(plan => aliases.includes(plan.planCode) || aliases.includes(plan.featureKey)) ||
    null
  )
}

export const getFallbackSubscriptionPlans = () => FALLBACK_PLAN_CATALOG.map(item => ({ ...item }))

export const listActiveSubscriptionPlans = async supabase => {
  if (!supabase) {
    return getFallbackSubscriptionPlans()
  }

  const { data, error } = await supabase
    .from('subscription_plans')
    .select(
      'id,plan_code,plan_name,description,audience,feature_key,billing_cycle,amount,currency,duration_days,features,sort_order,active,updated_at,created_at'
    )
    .eq('active', true)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })

  if (error) {
    return getFallbackSubscriptionPlans()
  }

  return withFallbackPlans(data)
}

export const listAllSubscriptionPlans = async supabase => {
  if (!supabase) {
    return getFallbackSubscriptionPlans()
  }

  const { data, error } = await supabase
    .from('subscription_plans')
    .select(
      'id,plan_code,plan_name,description,audience,feature_key,billing_cycle,amount,currency,duration_days,features,sort_order,active,updated_at,created_at'
    )
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })

  if (error) {
    return getFallbackSubscriptionPlans()
  }

  return withFallbackPlans(data)
}

export const getSubscriptionPlanByKey = async (supabase, key) => {
  const catalog = await listActiveSubscriptionPlans(supabase)

  return findPlanInCatalog(catalog, key) || findPlanInCatalog(getFallbackSubscriptionPlans(), key)
}

export const getTenantSubscriptionPricing = async (supabase, subscriptionType = 'house_search') => {
  const plan = await getSubscriptionPlanByKey(supabase, subscriptionType)

  return {
    planCode: plan?.planCode || 'tenant_house_search',
    name: plan?.planName || 'Tenant House Search',
    amount: plan?.amount ?? (FALLBACK_TENANT_PRICING?.house_search?.amount ?? 299),
    currency: plan?.currency || DEFAULT_CURRENCY,
    duration_days: plan?.durationDays ?? (FALLBACK_TENANT_PRICING?.house_search?.duration_days ?? 30),
    features: plan?.features?.length ? plan.features : FALLBACK_TENANT_PRICING?.house_search?.features || []
  }
}

export const getLandlordFeaturePricing = async (supabase, feature) => {
  const plan = await getSubscriptionPlanByKey(supabase, feature)

  return {
    planCode: plan?.planCode || toText(feature),
    name: plan?.planName || 'Landlord Plan',
    price: plan?.amount ?? 0,
    currency: plan?.currency || DEFAULT_CURRENCY,
    duration_days: plan?.durationDays ?? 365,
    description: plan?.description || '',
    features: plan?.features || []
  }
}

export const getDefaultLandlordPlanId = async supabase => {
  if (!supabase) {
    return null
  }

  const { data, error } = await supabase
    .from('subscription_plans')
    .select('id,plan_code,feature_key,active,sort_order')
    .eq('active', true)
    .in('feature_key', ['full_access', 'marketplace_listing', 'management_module'])
    .order('sort_order', { ascending: true })
    .limit(10)

  if (error || !Array.isArray(data) || !data.length) {
    return null
  }

  const normalized = data.map(item => ({
    id: toText(item?.id),
    planCode: toText(item?.plan_code),
    featureKey: toText(item?.feature_key),
    sortOrder: toNumber(item?.sort_order) ?? 0
  }))

  const preferred =
    normalized.find(item => item.planCode === 'landlord_full_access' || item.featureKey === 'full_access') ||
    normalized[0]

  return preferred?.id || null
}
