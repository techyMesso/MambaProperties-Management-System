/**
 * Check if user has active house search subscription
 * Used to gate access to property search features
 */
export async function checkHouseSearchAccess(supabase, userId) {
  try {
    const { data: subscription, error } = await supabase
      .from('tenant_subscriptions')
      .select('id, status, payment_status, expires_at, subscription_type')
      .eq('user_id', userId)
      .eq('subscription_type', 'house_search')
      .eq('status', 'active')
      .eq('payment_status', 'paid')
      .maybeSingle()

    if (error) {
      console.error('Error checking house search access:', error)

      return {
        hasAccess: false,
        reason: 'error',
        message: 'Unable to verify subscription status'
      }
    }

    if (!subscription) {
      return {
        hasAccess: false,
        reason: 'no_active_subscription',
        message: 'Subscribe to search houses',
        action: 'show_subscription_modal',
        required_subscription: 'house_search'
      }
    }

    // Check if subscription has expired
    if (subscription.expires_at && new Date(subscription.expires_at) < new Date()) {
      // Update status to expired
      await supabase
        .from('tenant_subscriptions')
        .update({ status: 'expired' })
        .eq('id', subscription.id)
        .catch(() => {})

      return {
        hasAccess: false,
        reason: 'subscription_expired',
        message: 'Your subscription has expired',
        action: 'show_renewal_modal'
      }
    }

    return {
      hasAccess: true,
      expiresAt: subscription.expires_at,
      daysRemaining: subscription.expires_at ? Math.ceil((new Date(subscription.expires_at) - new Date()) / (1000 * 60 * 60 * 24)) : null
    }
  } catch (error) {
    console.error('Error checking house search access:', error)

    return {
      hasAccess: false,
      reason: 'error',
      message: 'Unable to verify subscription status'
    }
  }
}

/**
 * Check if user has market premium subscription
 * Used to gate premium features
 */
export async function checkMarketPremiumAccess(supabase, userId) {
  try {
    const { data: subscription, error } = await supabase
      .from('tenant_subscriptions')
      .select('id, status, expires_at')
      .eq('user_id', userId)
      .eq('subscription_type', 'market_premium')
      .eq('status', 'active')
      .maybeSingle()

    if (error) {
      console.error('Error checking market premium access:', error)

      return { hasAccess: false, reason: 'error' }
    }

    if (!subscription) {
      return {
        hasAccess: false,
        reason: 'no_subscription',
        message: 'Upgrade to Market Premium for analytics'
      }
    }

    if (subscription.expires_at && new Date(subscription.expires_at) < new Date()) {
      return {
        hasAccess: false,
        reason: 'expired',
        message: 'Your Market Premium subscription has expired'
      }
    }

    return { hasAccess: true, expiresAt: subscription.expires_at }
  } catch (error) {
    console.error('Error checking market premium access:', error)

    return { hasAccess: false, reason: 'error' }
  }
}

/**
 * Get all active subscriptions for a user
 */
export async function getUserSubscriptions(supabase, userId) {
  try {
    const { data: subscriptions, error } = await supabase
      .from('tenant_subscriptions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching subscriptions:', error)

      return { subscriptions: [], error }
    }

    // Filter out expired ones (but keep them in history)
    const active = subscriptions.filter(
      s => s.status === 'active' && (!s.expires_at || new Date(s.expires_at) > new Date())
    )

    return { subscriptions, active }
  } catch (error) {
    console.error('Error fetching subscriptions:', error)

    return { subscriptions: [], active: [], error }
  }
}
