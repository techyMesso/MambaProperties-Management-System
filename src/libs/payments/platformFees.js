import 'server-only'

const toText = value => String(value || '').trim()

const toNumber = value => {
  const parsed = Number(value)

  return Number.isFinite(parsed) ? parsed : null
}

const roundMoney = value => Math.round((Number(value) + Number.EPSILON) * 100) / 100

const normalizeScope = value =>
  toText(value)
    .toLowerCase()
    .replace(/[\s-]+/g, '_')

const normalizeFeeRule = row => ({
  id: toText(row?.id) || null,
  ruleName: toText(row?.rule_name || row?.name || row?.code || row?.fee_type || 'Fee rule'),
  scope: normalizeScope(row?.scope || row?.applies_to || 'platform'),
  status: normalizeScope(row?.status || (row?.active === false || row?.is_active === false ? 'inactive' : 'active')),
  active: row?.active !== false && row?.is_active !== false,
  ratePercent: toNumber(row?.rate_percent ?? row?.percentage ?? row?.commission_percent),
  flatAmount: toNumber(row?.flat_amount ?? row?.amount ?? row?.fixed_fee),
  currency: toText(row?.currency || 'KES') || 'KES'
})

const isActiveRule = rule => {
  if (!rule?.active) {
    return false
  }

  return !['inactive', 'disabled', 'archived'].includes(rule.status)
}

const matchesScope = (ruleScope, scopeCandidates) => {
  if (!ruleScope || ruleScope === 'all' || ruleScope === 'platform') {
    return true
  }

  return scopeCandidates.has(ruleScope)
}

export const listActivePlatformFeeRules = async supabase => {
  if (!supabase) {
    return []
  }

  const { data, error } = await supabase.from('platform_fee_rules').select('*')

  if (error || !Array.isArray(data)) {
    return []
  }

  return data.map(normalizeFeeRule).filter(isActiveRule)
}

export const calculatePlatformFees = async ({
  supabase,
  baseAmount,
  currency = 'KES',
  scopeCandidates = []
}) => {
  const normalizedBaseAmount = roundMoney(toNumber(baseAmount) ?? 0)
  const normalizedCurrency = toText(currency || 'KES') || 'KES'

  const normalizedScopes = new Set(
    (scopeCandidates || [])
      .map(value => normalizeScope(value))
      .filter(Boolean)
  )

  const rules = await listActivePlatformFeeRules(supabase)
  const appliedRules = []

  for (const rule of rules) {
    if (rule.currency && normalizedCurrency && rule.currency !== normalizedCurrency) {
      continue
    }

    if (!matchesScope(rule.scope, normalizedScopes)) {
      continue
    }

    const feeAmount = roundMoney((normalizedBaseAmount * ((rule.ratePercent || 0) / 100)) + (rule.flatAmount || 0))

    if (feeAmount <= 0) {
      continue
    }

    appliedRules.push({
      id: rule.id,
      ruleName: rule.ruleName,
      scope: rule.scope,
      ratePercent: rule.ratePercent,
      flatAmount: rule.flatAmount,
      feeAmount,
      currency: normalizedCurrency
    })
  }

  const totalFee = roundMoney(appliedRules.reduce((sum, rule) => sum + rule.feeAmount, 0))
  const totalAmount = roundMoney(normalizedBaseAmount + totalFee)

  return {
    baseAmount: normalizedBaseAmount,
    totalFee,
    totalAmount,
    currency: normalizedCurrency,
    rules: appliedRules
  }
}
