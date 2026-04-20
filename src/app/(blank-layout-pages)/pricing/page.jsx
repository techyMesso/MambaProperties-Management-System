// Component Imports
import Pricing from '@views/Pricing'
import { calculatePlatformFees } from '@/libs/payments/platformFees'
import { listActiveSubscriptionPlans } from '@/libs/pricing/subscriptionPlans'
import { createClient as createServerSupabaseClient } from '@/libs/supabase/server'

const PricingPage = async () => {
  const supabase = await createServerSupabaseClient()
  const pricingCatalog = await listActiveSubscriptionPlans(supabase)

  const pricingCatalogWithFees = await Promise.all(
    pricingCatalog.map(async plan => {
      const feeSummary = await calculatePlatformFees({
        supabase,
        baseAmount: plan.amount,
        currency: plan.currency,
        scopeCandidates:
          plan.audience === 'tenant'
            ? ['subscription', 'tenant_subscription', plan.featureKey, plan.planCode]
            : ['subscription', 'landlord_subscription', 'landlord_plan_subscription', plan.featureKey, plan.planCode]
      })

      return {
        ...plan,
        baseAmount: feeSummary.baseAmount,
        feeAmount: feeSummary.totalFee,
        amount: feeSummary.totalAmount,
        feeBreakdown: feeSummary.rules
      }
    })
  )

  let viewerProfile = null

  if (supabase) {
    const {
      data: { user }
    } = await supabase.auth.getUser()

    if (user?.id) {
      const { data } = await supabase
        .from('profiles')
        .select('id,full_name,phone,role,requested_role,approval_status,kyc_verified')
        .eq('id', user.id)
        .maybeSingle()

      viewerProfile = data || null
    }
  }

  return <Pricing pricingCatalog={pricingCatalogWithFees} viewerProfile={viewerProfile} />
}

export const dynamic = 'force-dynamic'

export default PricingPage
