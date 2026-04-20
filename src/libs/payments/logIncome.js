/**
 * Log platform income for tracking revenue
 * Called when subscriptions are paid, fees collected, etc.
 */
export async function logPlatformIncome(
  supabase,
  {
    incomeType,
    relatedUserId,
    relatedPaymentId,
    relatedSubscriptionId,
    relatedTenantSubscriptionId,
    amount,
    status = 'pending',
    metadata = {}
  }
) {
  try {
    const { data, error } = await supabase
      .from('platform_income')
      .insert({
        income_type: incomeType,
        related_user_id: relatedUserId,
        related_payment_id: relatedPaymentId,
        related_subscription_id: relatedSubscriptionId,
        related_tenant_subscription_id: relatedTenantSubscriptionId,
        amount,
        currency: 'KES',
        status,
        collected_at: new Date().toISOString(),
        metadata: JSON.stringify(metadata),
        created_at: new Date().toISOString()
      })
      .select()
      .maybeSingle()

    if (error) {
      console.error('Failed to log platform income:', error)

      return { error }
    }

    return { data }
  } catch (error) {
    console.error('Error logging income:', error)

    return { error }
  }
}

/**
 * Log when tenant subscription payment is received
 */
export async function logTenantSubscriptionIncome(supabase, tenantSubscription, amount = null) {
  const incomeAmount = amount || tenantSubscription.amount_due

  return logPlatformIncome(supabase, {
    incomeType: 'tenant_subscription',
    relatedUserId: tenantSubscription.user_id,
    relatedTenantSubscriptionId: tenantSubscription.id,
    amount: incomeAmount,
    status: 'confirmed',
    metadata: {
      subscriptionType: tenantSubscription.subscription_type,
      subscriptionStatus: tenantSubscription.status
    }
  })
}

/**
 * Log when landlord marketplace listing payment is received
 */
export async function logMarketplaceListingIncome(supabase, landlordId, amount, metadata = {}) {
  return logPlatformIncome(supabase, {
    incomeType: 'landlord_marketplace_listing',
    relatedUserId: landlordId,
    amount,
    status: 'confirmed',
    metadata: {
      ...metadata,
      type: 'marketplace_listing_fee'
    }
  })
}

/**
 * Log when landlord management module subscription is paid
 */
export async function logManagementModuleIncome(supabase, landlordId, amount, metadata = {}) {
  return logPlatformIncome(supabase, {
    incomeType: 'landlord_management_module',
    relatedUserId: landlordId,
    amount,
    status: 'confirmed',
    metadata: {
      ...metadata,
      type: 'management_module_subscription'
    }
  })
}

/**
 * Get platform income summary for admin dashboard
 */
export async function getPlatformIncomeSummary(supabase, filters = {}) {
  try {
    let query = supabase.from('platform_income').select('*')

    // Apply filters
    if (filters.startDate) {
      query = query.gte('collected_at', filters.startDate)
    }

    if (filters.endDate) {
      query = query.lte('collected_at', filters.endDate)
    }

    if (filters.incomeType) {
      query = query.eq('income_type', filters.incomeType)
    }

    if (filters.status) {
      query = query.eq('status', filters.status)
    }

    const { data, error } = await query.order('collected_at', { ascending: false })

    if (error) {
      console.error('Error fetching income summary:', error)

      return { income: [], error }
    }

    // Calculate totals by type
    const byType = {}
    let totalAmount = 0

    data?.forEach(record => {
      if (!byType[record.income_type]) {
        byType[record.income_type] = { count: 0, amount: 0 }
      }

      byType[record.income_type].count += 1
      byType[record.income_type].amount += record.amount || 0
      totalAmount += record.amount || 0
    })

    return {
      income: data || [],
      summary: {
        totalAmount,
        byType,
        recordCount: data?.length || 0
      }
    }
  } catch (error) {
    console.error('Error calculating income summary:', error)

    return { income: [], summary: {}, error }
  }
}
