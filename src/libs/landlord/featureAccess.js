/**
 * Check if landlord has active marketplace listing access
 */
export async function checkMarketplaceListingAccess(supabase, landlordId) {
  try {
    const { data: feature, error } = await supabase
      .from('landlord_feature_access')
      .select('id, expires_at, is_active')
      .eq('landlord_id', landlordId)
      .eq('feature', 'marketplace_listing')
      .eq('is_active', true)
      .maybeSingle()

    if (error) {
      console.error('Error checking marketplace access:', error)

      return { hasAccess: false, reason: 'error' }
    }

    if (!feature) {
      return {
        hasAccess: false,
        reason: 'no_active_marketplace',
        message: 'Upgrade to Marketplace plan to list properties',
        action: 'show_upgrade_modal'
      }
    }

    // Check if access has expired
    if (feature.expires_at && new Date(feature.expires_at) < new Date()) {
      // Mark as inactive
      await supabase
        .from('landlord_feature_access')
        .update({ is_active: false })
        .eq('id', feature.id)
        .catch(() => {})

      return {
        hasAccess: false,
        reason: 'access_expired',
        message: 'Your Marketplace access has expired',
        action: 'show_renewal_modal'
      }
    }

    return {
      hasAccess: true,
      expiresAt: feature.expires_at,
      daysRemaining: feature.expires_at
        ? Math.ceil((new Date(feature.expires_at) - new Date()) / (1000 * 60 * 60 * 24))
        : null
    }
  } catch (error) {
    console.error('Error checking marketplace listing access:', error)

    return { hasAccess: false, reason: 'error' }
  }
}

/**
 * Check if landlord has active management module access
 */
export async function checkManagementModuleAccess(supabase, landlordId) {
  try {
    const { data: feature, error } = await supabase
      .from('landlord_feature_access')
      .select('id, expires_at, is_active')
      .eq('landlord_id', landlordId)
      .eq('feature', 'management_module')
      .eq('is_active', true)
      .maybeSingle()

    if (error) {
      console.error('Error checking management module access:', error)

      return { hasAccess: false, reason: 'error' }
    }

    if (!feature) {
      return {
        hasAccess: false,
        reason: 'no_active_management',
        message: 'Upgrade to access management module',
        action: 'show_upgrade_modal'
      }
    }

    // Check if access has expired
    if (feature.expires_at && new Date(feature.expires_at) < new Date()) {
      // Mark as inactive
      await supabase
        .from('landlord_feature_access')
        .update({ is_active: false })
        .eq('id', feature.id)
        .catch(() => {})

      return {
        hasAccess: false,
        reason: 'access_expired',
        message: 'Your Management Module access has expired',
        action: 'show_renewal_modal'
      }
    }

    return {
      hasAccess: true,
      expiresAt: feature.expires_at,
      daysRemaining: feature.expires_at
        ? Math.ceil((new Date(feature.expires_at) - new Date()) / (1000 * 60 * 60 * 24))
        : null
    }
  } catch (error) {
    console.error('Error checking management module access:', error)

    return { hasAccess: false, reason: 'error' }
  }
}

/**
 * Check if landlord is approved and can access platform
 */
export async function checkLandlordApprovalStatus(supabase, landlordId) {
  try {
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('id, approval_status, kyc_verified')
      .eq('id', landlordId)
      .in('role', ['landlord', 'agent'])
      .maybeSingle()

    if (error) {
      console.error('Error checking landlord approval:', error)

      return { isApproved: false, reason: 'error' }
    }

    if (!profile) {
      return { isApproved: false, reason: 'management_account_not_found' }
    }

    if (profile.approval_status === 'rejected') {
      return {
        isApproved: false,
        reason: 'landlord_rejected',
        message: 'Your management account has been rejected. Contact support.'
      }
    }

    if (profile.approval_status === 'suspended') {
      return {
        isApproved: false,
        reason: 'landlord_suspended',
        message: 'Your management account has been suspended. Contact support.'
      }
    }

    if (profile.approval_status !== 'approved') {
      return {
        isApproved: false,
        reason: 'landlord_pending_approval',
        message: 'Your account is pending admin approval',
        action: 'show_pending_message'
      }
    }

    if (profile.kyc_verified !== true && profile.kyc_verified !== 1) {
      return {
        isApproved: false,
        reason: 'kyc_pending_verification',
        message: 'Your KYC documents must be verified before activation.',
        action: 'show_pending_message'
      }
    }

    return {
      isApproved: true,
      kycVerified: profile.kyc_verified,
      status: profile.approval_status
    }
  } catch (error) {
    console.error('Error checking landlord approval status:', error)

    return { isApproved: false, reason: 'error' }
  }
}

/**
 * Get all feature access for a landlord
 */
export async function getLandlordFeatureAccess(supabase, landlordId) {
  try {
    const { data: features, error } = await supabase
      .from('landlord_feature_access')
      .select('*')
      .eq('landlord_id', landlordId)
      .order('granted_at', { ascending: false })

    if (error) {
      console.error('Error fetching feature access:', error)

      return { features: [], error }
    }

    // Get active and expired features
    const active = features?.filter(f => f.is_active && (!f.expires_at || new Date(f.expires_at) > new Date())) || []

    const expired = features?.filter(f => !f.is_active || (f.expires_at && new Date(f.expires_at) <= new Date())) || []

    return { features, active, expired }
  } catch (error) {
    console.error('Error fetching feature access:', error)

    return { features: [], active: [], expired: [], error }
  }
}
