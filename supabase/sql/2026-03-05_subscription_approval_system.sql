-- MambaProperties Platform: Subscription & Approval System
-- Migration File: 2026-03-05_subscription_approval_system.sql
--
-- This migration adds support for:
-- 1. Landlord approval & KYC verification
-- 2. Plot approval & verification
-- 3. Tenant subscriptions for house search access
-- 4. Landlord feature access (marketplace, management module)
-- 5. Platform income tracking
--
-- IMPORTANT: Run this in Supabase SQL Editor AFTER backing up your database

-- ============================================================================
-- 1. UPDATE PROFILES TABLE - Add Landlord Approval Fields
-- ============================================================================

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS approval_status TEXT
  DEFAULT 'pending'
  CHECK (approval_status IN ('pending', 'approved', 'rejected', 'suspended'));

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS approval_notes TEXT;

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS kyc_verified BOOLEAN DEFAULT FALSE;

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS kyc_verified_at TIMESTAMPTZ;

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS kyc_verification_notes TEXT;

-- Create indexes for admin queries
CREATE INDEX IF NOT EXISTS idx_profiles_approval_status
ON public.profiles(approval_status);

CREATE INDEX IF NOT EXISTS idx_profiles_kyc_verified
ON public.profiles(kyc_verified);

CREATE INDEX IF NOT EXISTS idx_profiles_role_approval
ON public.profiles(role, approval_status);

-- ============================================================================
-- 2. UPDATE PLOTS TABLE - Add Plot Approval Fields
-- ============================================================================

ALTER TABLE public.plots
ADD COLUMN IF NOT EXISTS approval_status TEXT
  DEFAULT 'pending'
  CHECK (approval_status IN ('pending', 'approved', 'rejected', 'unlisted'));

ALTER TABLE public.plots
ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.plots
ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;

ALTER TABLE public.plots
ADD COLUMN IF NOT EXISTS approval_notes TEXT;

ALTER TABLE public.plots
ADD COLUMN IF NOT EXISTS ownership_verified BOOLEAN DEFAULT FALSE;

ALTER TABLE public.plots
ADD COLUMN IF NOT EXISTS listed_at TIMESTAMPTZ;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_plots_approval_status
ON public.plots(approval_status);

CREATE INDEX IF NOT EXISTS idx_plots_owner_approval
ON public.plots(owner_id, approval_status);

CREATE INDEX IF NOT EXISTS idx_plots_is_listed
ON public.plots(approval_status)
WHERE approval_status = 'approved';

-- ============================================================================
-- 3. CREATE LANDLORD DOCUMENTS TABLE - For KYC Verification
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.landlord_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  landlord_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL
    CHECK (document_type IN (
      'national_id',
      'passport',
      'ownership_certificate',
      'business_license',
      'business_registration'
    )),
  file_path TEXT NOT NULL,
  file_name TEXT,
  file_size INT,
  mime_type TEXT,
  verification_status TEXT DEFAULT 'pending'
    CHECK (verification_status IN ('pending', 'approved', 'rejected', 'resubmit')),
  verified_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  verified_at TIMESTAMPTZ,
  rejection_reason TEXT,
  verification_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

-- Enable RLS
ALTER TABLE public.landlord_documents ENABLE ROW LEVEL SECURITY;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_landlord_documents_landlord
ON public.landlord_documents(landlord_id);

CREATE INDEX IF NOT EXISTS idx_landlord_documents_status
ON public.landlord_documents(verification_status);

CREATE INDEX IF NOT EXISTS idx_landlord_documents_type
ON public.landlord_documents(document_type);

CREATE INDEX IF NOT EXISTS idx_landlord_documents_created
ON public.landlord_documents(created_at DESC);

-- Trigger for updated_at
DROP TRIGGER IF EXISTS landlord_documents_set_updated_at ON public.landlord_documents;
CREATE TRIGGER landlord_documents_set_updated_at
BEFORE UPDATE ON public.landlord_documents
FOR EACH ROW
EXECUTE FUNCTION app.touch_updated_at();

-- ============================================================================
-- 4. CREATE TENANT SUBSCRIPTIONS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.tenant_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  subscription_type TEXT NOT NULL
    CHECK (subscription_type IN ('house_search', 'market_premium')),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'trial', 'active', 'expired', 'suspended', 'cancelled')),
  payment_status TEXT DEFAULT 'unpaid'
    CHECK (payment_status IN ('unpaid', 'paid', 'overdue', 'partially_paid')),
  started_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  amount_due NUMERIC(12,2) DEFAULT 0,
  amount_paid NUMERIC(12,2) DEFAULT 0,
  currency TEXT DEFAULT 'KES',
  payment_method TEXT,
  payment_reference TEXT,
  auto_renew BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

ALTER TABLE public.tenant_subscriptions
ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'KES';

ALTER TABLE public.tenant_subscriptions
ALTER COLUMN status SET DEFAULT 'pending';

ALTER TABLE public.tenant_subscriptions
ALTER COLUMN currency SET DEFAULT 'KES';

DO $$
DECLARE
  status_attnum SMALLINT;
  status_constraint RECORD;
BEGIN
  SELECT attnum
  INTO status_attnum
  FROM pg_attribute
  WHERE attrelid = 'public.tenant_subscriptions'::regclass
    AND attname = 'status'
    AND NOT attisdropped;

  FOR status_constraint IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.tenant_subscriptions'::regclass
      AND contype = 'c'
      AND conkey = ARRAY[status_attnum]
  LOOP
    EXECUTE format('ALTER TABLE public.tenant_subscriptions DROP CONSTRAINT IF EXISTS %I', status_constraint.conname);
  END LOOP;

  BEGIN
    ALTER TABLE public.tenant_subscriptions
    ADD CONSTRAINT tenant_subscriptions_status_check
    CHECK (status IN ('pending', 'trial', 'active', 'expired', 'suspended', 'cancelled'));
  EXCEPTION
    WHEN duplicate_object THEN
      NULL;
  END;
END;
$$;

ALTER TABLE public.tenant_subscriptions ENABLE ROW LEVEL SECURITY;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_tenant_subscriptions_user
ON public.tenant_subscriptions(user_id);

CREATE INDEX IF NOT EXISTS idx_tenant_subscriptions_status
ON public.tenant_subscriptions(status);

CREATE INDEX IF NOT EXISTS idx_tenant_subscriptions_type
ON public.tenant_subscriptions(subscription_type);

CREATE INDEX IF NOT EXISTS idx_tenant_subscriptions_expiry
ON public.tenant_subscriptions(expires_at)
WHERE status != 'cancelled';

CREATE INDEX IF NOT EXISTS idx_tenant_subscriptions_payment_status
ON public.tenant_subscriptions(payment_status);

-- Trigger
DROP TRIGGER IF EXISTS tenant_subscriptions_set_updated_at ON public.tenant_subscriptions;
CREATE TRIGGER tenant_subscriptions_set_updated_at
BEFORE UPDATE ON public.tenant_subscriptions
FOR EACH ROW
EXECUTE FUNCTION app.touch_updated_at();

-- ============================================================================
-- 5. CREATE LANDLORD FEATURE ACCESS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.landlord_feature_access (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  landlord_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  feature TEXT NOT NULL
    CHECK (feature IN (
      'marketplace_listing',
      'management_module',
      'advanced_analytics',
      'api_access'
    )),
  granted_at TIMESTAMPTZ DEFAULT timezone('utc', now()),
  expires_at TIMESTAMPTZ,
  paid_until TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT FALSE,
  granted_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

ALTER TABLE public.landlord_feature_access
ALTER COLUMN is_active SET DEFAULT FALSE;

ALTER TABLE public.landlord_feature_access ENABLE ROW LEVEL SECURITY;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_landlord_feature_access_landlord
ON public.landlord_feature_access(landlord_id);

CREATE INDEX IF NOT EXISTS idx_landlord_feature_access_feature
ON public.landlord_feature_access(landlord_id, feature);

CREATE INDEX IF NOT EXISTS idx_landlord_feature_access_active
ON public.landlord_feature_access(is_active)
WHERE is_active = TRUE;

-- Trigger
DROP TRIGGER IF EXISTS landlord_feature_access_set_updated_at ON public.landlord_feature_access;
CREATE TRIGGER landlord_feature_access_set_updated_at
BEFORE UPDATE ON public.landlord_feature_access
FOR EACH ROW
EXECUTE FUNCTION app.touch_updated_at();

-- ============================================================================
-- 6. CREATE PLATFORM INCOME TRACKING TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.platform_income (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  income_type TEXT NOT NULL
    CHECK (income_type IN (
      'tenant_subscription',
      'landlord_marketplace_listing',
      'landlord_management_module',
      'landlord_premium_features',
      'commission_from_rent_payment'
    )),
  related_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  related_payment_id UUID REFERENCES public.payments(id) ON DELETE SET NULL,
  related_subscription_id UUID REFERENCES public.landlord_subscriptions(id) ON DELETE SET NULL,
  related_tenant_subscription_id UUID REFERENCES public.tenant_subscriptions(id) ON DELETE SET NULL,
  amount NUMERIC(12,2) NOT NULL,
  currency TEXT DEFAULT 'KES',
  status TEXT DEFAULT 'pending'
    CHECK (status IN ('pending', 'confirmed', 'paid_out', 'refunded', 'disputed')),
  collected_at TIMESTAMPTZ,
  paid_out_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  metadata JSONB DEFAULT '{}'::jsonb
);

ALTER TABLE public.platform_income ENABLE ROW LEVEL SECURITY;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_platform_income_type
ON public.platform_income(income_type);

CREATE INDEX IF NOT EXISTS idx_platform_income_status
ON public.platform_income(status);

CREATE INDEX IF NOT EXISTS idx_platform_income_user
ON public.platform_income(related_user_id);

CREATE INDEX IF NOT EXISTS idx_platform_income_date
ON public.platform_income(collected_at DESC);

CREATE INDEX IF NOT EXISTS idx_platform_income_created
ON public.platform_income(created_at DESC);

-- Trigger
DROP TRIGGER IF EXISTS platform_income_set_updated_at ON public.platform_income;
CREATE TRIGGER platform_income_set_updated_at
BEFORE UPDATE ON public.platform_income
FOR EACH ROW
EXECUTE FUNCTION app.touch_updated_at();

-- ============================================================================
-- 7. RLS POLICIES - Landlord Documents
-- ============================================================================

DROP POLICY IF EXISTS landlord_documents_select ON public.landlord_documents;
CREATE POLICY landlord_documents_select ON public.landlord_documents
FOR SELECT
USING (
  app.is_admin()
  OR landlord_id = auth.uid()
);

DROP POLICY IF EXISTS landlord_documents_insert ON public.landlord_documents;
CREATE POLICY landlord_documents_insert ON public.landlord_documents
FOR INSERT
WITH CHECK (landlord_id = auth.uid());

DROP POLICY IF EXISTS landlord_documents_update_landlord ON public.landlord_documents;
CREATE POLICY landlord_documents_update_landlord ON public.landlord_documents
FOR UPDATE
USING (landlord_id = auth.uid())
WITH CHECK (landlord_id = auth.uid());

DROP POLICY IF EXISTS landlord_documents_update_admin ON public.landlord_documents;
CREATE POLICY landlord_documents_update_admin ON public.landlord_documents
FOR UPDATE
USING (app.is_admin())
WITH CHECK (app.is_admin());

-- ============================================================================
-- 8. RLS POLICIES - Tenant Subscriptions
-- ============================================================================

DROP POLICY IF EXISTS tenant_subscriptions_select ON public.tenant_subscriptions;
CREATE POLICY tenant_subscriptions_select ON public.tenant_subscriptions
FOR SELECT
USING (
  app.is_admin()
  OR user_id = auth.uid()
);

DROP POLICY IF EXISTS tenant_subscriptions_insert ON public.tenant_subscriptions;
CREATE POLICY tenant_subscriptions_insert ON public.tenant_subscriptions
FOR INSERT
WITH CHECK (
  user_id = auth.uid()
  AND status = 'pending'
  AND coalesce(payment_status, 'unpaid') = 'unpaid'
);

DROP POLICY IF EXISTS tenant_subscriptions_update ON public.tenant_subscriptions;
DROP POLICY IF EXISTS tenant_subscriptions_admin_all ON public.tenant_subscriptions;
CREATE POLICY tenant_subscriptions_admin_all ON public.tenant_subscriptions
FOR ALL
USING (app.is_admin())
WITH CHECK (app.is_admin());

-- ============================================================================
-- 9. RLS POLICIES - Landlord Feature Access
-- ============================================================================

DROP POLICY IF EXISTS landlord_feature_access_select ON public.landlord_feature_access;
CREATE POLICY landlord_feature_access_select ON public.landlord_feature_access
FOR SELECT
USING (
  app.is_admin()
  OR landlord_id = auth.uid()
);

DROP POLICY IF EXISTS landlord_feature_access_landlord_insert_request ON public.landlord_feature_access;
CREATE POLICY landlord_feature_access_landlord_insert_request ON public.landlord_feature_access
FOR INSERT
WITH CHECK (
  landlord_id = auth.uid()
  AND coalesce(is_active, FALSE) = FALSE
  AND granted_by IS NULL
);

DROP POLICY IF EXISTS landlord_feature_access_admin ON public.landlord_feature_access;
CREATE POLICY landlord_feature_access_admin ON public.landlord_feature_access
FOR ALL
USING (app.is_admin())
WITH CHECK (app.is_admin());

-- ============================================================================
-- 10. RLS POLICIES - Platform Income (Admin Only)
-- ============================================================================

DROP POLICY IF EXISTS platform_income_admin_select ON public.platform_income;
CREATE POLICY platform_income_admin_select ON public.platform_income
FOR SELECT
USING (app.is_admin());

DROP POLICY IF EXISTS platform_income_admin_all ON public.platform_income;
CREATE POLICY platform_income_admin_all ON public.platform_income
FOR ALL
USING (app.is_admin())
WITH CHECK (app.is_admin());

-- ============================================================================
-- 11. UPDATE PROFILES RLS - Ensure approval fields are protected
-- ============================================================================

-- Users can update their own profile except protected approval fields.
DROP POLICY IF EXISTS profiles_self_update ON public.profiles;
DROP POLICY IF EXISTS profiles_update_policy ON public.profiles;
CREATE POLICY profiles_self_update ON public.profiles
FOR UPDATE
USING (
  id = auth.uid()
)
WITH CHECK (
  id = auth.uid()
  AND role IS NOT DISTINCT FROM (
    SELECT role FROM public.profiles WHERE id = auth.uid()
  )
  AND approval_status IS NOT DISTINCT FROM (
    SELECT approval_status FROM public.profiles WHERE id = auth.uid()
  )
  AND approved_by IS NOT DISTINCT FROM (
    SELECT approved_by FROM public.profiles WHERE id = auth.uid()
  )
  AND approved_at IS NOT DISTINCT FROM (
    SELECT approved_at FROM public.profiles WHERE id = auth.uid()
  )
  AND approval_notes IS NOT DISTINCT FROM (
    SELECT approval_notes FROM public.profiles WHERE id = auth.uid()
  )
  AND kyc_verified IS NOT DISTINCT FROM (
    SELECT kyc_verified FROM public.profiles WHERE id = auth.uid()
  )
  AND kyc_verified_at IS NOT DISTINCT FROM (
    SELECT kyc_verified_at FROM public.profiles WHERE id = auth.uid()
  )
  AND kyc_verification_notes IS NOT DISTINCT FROM (
    SELECT kyc_verification_notes FROM public.profiles WHERE id = auth.uid()
  )
);

-- Admin can update approval fields
DROP POLICY IF EXISTS profiles_admin_update ON public.profiles;
CREATE POLICY profiles_admin_update ON public.profiles
FOR UPDATE
USING (app.is_admin())
WITH CHECK (app.is_admin());

-- ============================================================================
-- 12. UPDATE PLOTS RLS - Ensure approval fields are protected
-- ============================================================================

DROP POLICY IF EXISTS plots_admin_update ON public.plots;
DROP POLICY IF EXISTS plots_all_policy ON public.plots;

DROP POLICY IF EXISTS plots_admin_all ON public.plots;
CREATE POLICY plots_admin_all ON public.plots
FOR ALL
USING (app.is_admin())
WITH CHECK (app.is_admin());

DROP POLICY IF EXISTS plots_owner_select ON public.plots;
CREATE POLICY plots_owner_select ON public.plots
FOR SELECT
USING (owner_id = auth.uid());

DROP POLICY IF EXISTS plots_owner_insert ON public.plots;
CREATE POLICY plots_owner_insert ON public.plots
FOR INSERT
WITH CHECK (
  owner_id = auth.uid()
  AND coalesce(approval_status, 'pending') = 'pending'
  AND approved_by IS NULL
  AND approved_at IS NULL
  AND coalesce(ownership_verified, FALSE) = FALSE
  AND listed_at IS NULL
);

DROP POLICY IF EXISTS plots_owner_update ON public.plots;
CREATE POLICY plots_owner_update ON public.plots
FOR UPDATE
USING (owner_id = auth.uid())
WITH CHECK (
  owner_id = auth.uid()
  AND approval_status IS NOT DISTINCT FROM (
    SELECT approval_status FROM public.plots WHERE id = plots.id
  )
  AND approved_by IS NOT DISTINCT FROM (
    SELECT approved_by FROM public.plots WHERE id = plots.id
  )
  AND approved_at IS NOT DISTINCT FROM (
    SELECT approved_at FROM public.plots WHERE id = plots.id
  )
  AND approval_notes IS NOT DISTINCT FROM (
    SELECT approval_notes FROM public.plots WHERE id = plots.id
  )
  AND ownership_verified IS NOT DISTINCT FROM (
    SELECT ownership_verified FROM public.plots WHERE id = plots.id
  )
  AND listed_at IS NOT DISTINCT FROM (
    SELECT listed_at FROM public.plots WHERE id = plots.id
  )
);

DROP POLICY IF EXISTS plots_owner_delete ON public.plots;
CREATE POLICY plots_owner_delete ON public.plots
FOR DELETE
USING (owner_id = auth.uid());

-- ============================================================================
-- 13. CREATE HELPER FUNCTIONS
-- ============================================================================

-- Function to check if tenant has active house search subscription
CREATE OR REPLACE FUNCTION public.has_active_house_search_subscription(user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.tenant_subscriptions
    WHERE
      user_id = $1
      AND subscription_type = 'house_search'
      AND status = 'active'
      AND payment_status = 'paid'
      AND (expires_at IS NULL OR expires_at > NOW())
  );
END;
$$ LANGUAGE plpgsql STABLE;

-- Function to check if landlord has marketplace access
CREATE OR REPLACE FUNCTION public.has_marketplace_access(landlord_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.landlord_feature_access
    WHERE
      landlord_id = $1
      AND feature = 'marketplace_listing'
      AND is_active = TRUE
      AND (expires_at IS NULL OR expires_at > NOW())
  )
  AND EXISTS (
    SELECT 1 FROM public.profiles
    WHERE
      id = $1
      AND role = 'landlord'
      AND approval_status = 'approved'
      AND coalesce(kyc_verified, FALSE) = TRUE
  );
END;
$$ LANGUAGE plpgsql STABLE;

-- Function to get approved landlord status
CREATE OR REPLACE FUNCTION public.is_landlord_approved(user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE
      id = $1
      AND role = 'landlord'
      AND approval_status = 'approved'
      AND coalesce(kyc_verified, FALSE) = TRUE
  );
END;
$$ LANGUAGE plpgsql STABLE;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.has_active_house_search_subscription(UUID)
TO anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.has_marketplace_access(UUID)
TO anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.is_landlord_approved(UUID)
TO anon, authenticated, service_role;

-- ============================================================================
-- 14. MARKETPLACE RLS HARDENING - enforce subscriptions + approval + listing fee
-- ============================================================================

DO $$
DECLARE
  has_is_listed BOOLEAN;
  has_viewing_appointments BOOLEAN;
  has_bookings BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'units'
      AND column_name = 'is_listed'
  ) INTO has_is_listed;

  SELECT to_regclass('public.viewing_appointments') IS NOT NULL INTO has_viewing_appointments;
  SELECT to_regclass('public.bookings') IS NOT NULL INTO has_bookings;

  EXECUTE 'drop policy if exists units_marketplace_tenant_select on public.units';

  IF has_is_listed THEN
    EXECUTE $policy$
      create policy units_marketplace_tenant_select on public.units
      for select
      to authenticated
      using (
        app.current_role() = 'tenant'
        and status = 'vacant'
        and coalesce(is_listed, true)
        and exists (
          select 1
          from public.tenant_subscriptions ts
          where ts.user_id = auth.uid()
            and ts.subscription_type = 'house_search'
            and ts.status = 'active'
            and ts.payment_status = 'paid'
            and (ts.expires_at is null or ts.expires_at > now())
        )
        and exists (
          select 1
          from public.profiles p
          where p.id = units.owner_id
            and p.role = 'landlord'
            and p.approval_status = 'approved'
            and coalesce(p.kyc_verified, false) = true
        )
        and exists (
          select 1
          from public.landlord_feature_access lfa
          where lfa.landlord_id = units.owner_id
            and lfa.feature = 'marketplace_listing'
            and lfa.is_active = true
            and (lfa.expires_at is null or lfa.expires_at > now())
        )
        and exists (
          select 1
          from public.plots pl
          where pl.owner_id = units.owner_id
            and pl.plot_id = units.plot_id
            and pl.approval_status = 'approved'
            and coalesce(pl.ownership_verified, false) = true
        )
      )
    $policy$;
  ELSE
    EXECUTE $policy$
      create policy units_marketplace_tenant_select on public.units
      for select
      to authenticated
      using (
        app.current_role() = 'tenant'
        and status = 'vacant'
        and exists (
          select 1
          from public.tenant_subscriptions ts
          where ts.user_id = auth.uid()
            and ts.subscription_type = 'house_search'
            and ts.status = 'active'
            and ts.payment_status = 'paid'
            and (ts.expires_at is null or ts.expires_at > now())
        )
        and exists (
          select 1
          from public.profiles p
          where p.id = units.owner_id
            and p.role = 'landlord'
            and p.approval_status = 'approved'
            and coalesce(p.kyc_verified, false) = true
        )
        and exists (
          select 1
          from public.landlord_feature_access lfa
          where lfa.landlord_id = units.owner_id
            and lfa.feature = 'marketplace_listing'
            and lfa.is_active = true
            and (lfa.expires_at is null or lfa.expires_at > now())
        )
        and exists (
          select 1
          from public.plots pl
          where pl.owner_id = units.owner_id
            and pl.plot_id = units.plot_id
            and pl.approval_status = 'approved'
            and coalesce(pl.ownership_verified, false) = true
        )
      )
    $policy$;
  END IF;

  IF has_viewing_appointments THEN
    EXECUTE 'drop policy if exists viewing_appointments_tenant_insert_policy on public.viewing_appointments';

    IF has_is_listed THEN
      EXECUTE $policy$
        create policy viewing_appointments_tenant_insert_policy on public.viewing_appointments
        for insert
        to authenticated
        with check (
          app.current_role() = 'tenant'
          and tenant_profile_id = auth.uid()
          and exists (
            select 1
            from public.tenant_subscriptions ts
            where ts.user_id = auth.uid()
              and ts.subscription_type = 'house_search'
              and ts.status = 'active'
              and ts.payment_status = 'paid'
              and (ts.expires_at is null or ts.expires_at > now())
          )
          and exists (
            select 1
            from public.units u
            where u.id = viewing_appointments.unit_id
              and u.owner_id = viewing_appointments.owner_id
              and u.status = 'vacant'
              and coalesce(u.is_listed, true)
              and exists (
                select 1
                from public.profiles p
                where p.id = u.owner_id
                  and p.role = 'landlord'
                  and p.approval_status = 'approved'
                  and coalesce(p.kyc_verified, false) = true
              )
              and exists (
                select 1
                from public.landlord_feature_access lfa
                where lfa.landlord_id = u.owner_id
                  and lfa.feature = 'marketplace_listing'
                  and lfa.is_active = true
                  and (lfa.expires_at is null or lfa.expires_at > now())
              )
              and exists (
                select 1
                from public.plots pl
                where pl.owner_id = u.owner_id
                  and pl.plot_id = u.plot_id
                  and pl.approval_status = 'approved'
                  and coalesce(pl.ownership_verified, false) = true
              )
          )
        )
      $policy$;
    ELSE
      EXECUTE $policy$
        create policy viewing_appointments_tenant_insert_policy on public.viewing_appointments
        for insert
        to authenticated
        with check (
          app.current_role() = 'tenant'
          and tenant_profile_id = auth.uid()
          and exists (
            select 1
            from public.tenant_subscriptions ts
            where ts.user_id = auth.uid()
              and ts.subscription_type = 'house_search'
              and ts.status = 'active'
              and ts.payment_status = 'paid'
              and (ts.expires_at is null or ts.expires_at > now())
          )
          and exists (
            select 1
            from public.units u
            where u.id = viewing_appointments.unit_id
              and u.owner_id = viewing_appointments.owner_id
              and u.status = 'vacant'
              and exists (
                select 1
                from public.profiles p
                where p.id = u.owner_id
                  and p.role = 'landlord'
                  and p.approval_status = 'approved'
                  and coalesce(p.kyc_verified, false) = true
              )
              and exists (
                select 1
                from public.landlord_feature_access lfa
                where lfa.landlord_id = u.owner_id
                  and lfa.feature = 'marketplace_listing'
                  and lfa.is_active = true
                  and (lfa.expires_at is null or lfa.expires_at > now())
              )
              and exists (
                select 1
                from public.plots pl
                where pl.owner_id = u.owner_id
                  and pl.plot_id = u.plot_id
                  and pl.approval_status = 'approved'
                  and coalesce(pl.ownership_verified, false) = true
              )
          )
        )
      $policy$;
    END IF;
  END IF;

  IF has_bookings THEN
    EXECUTE 'drop policy if exists bookings_tenant_insert_policy on public.bookings';

    IF has_is_listed THEN
      EXECUTE $policy$
        create policy bookings_tenant_insert_policy on public.bookings
        for insert
        to authenticated
        with check (
          app.current_role() = 'tenant'
          and tenant_profile_id = auth.uid()
          and exists (
            select 1
            from public.tenant_subscriptions ts
            where ts.user_id = auth.uid()
              and ts.subscription_type = 'house_search'
              and ts.status = 'active'
              and ts.payment_status = 'paid'
              and (ts.expires_at is null or ts.expires_at > now())
          )
          and exists (
            select 1
            from public.units u
            where u.id = bookings.unit_id
              and u.owner_id = bookings.owner_id
              and u.status = 'vacant'
              and coalesce(u.is_listed, true)
              and exists (
                select 1
                from public.profiles p
                where p.id = u.owner_id
                  and p.role = 'landlord'
                  and p.approval_status = 'approved'
                  and coalesce(p.kyc_verified, false) = true
              )
              and exists (
                select 1
                from public.landlord_feature_access lfa
                where lfa.landlord_id = u.owner_id
                  and lfa.feature = 'marketplace_listing'
                  and lfa.is_active = true
                  and (lfa.expires_at is null or lfa.expires_at > now())
              )
              and exists (
                select 1
                from public.plots pl
                where pl.owner_id = u.owner_id
                  and pl.plot_id = u.plot_id
                  and pl.approval_status = 'approved'
                  and coalesce(pl.ownership_verified, false) = true
              )
          )
        )
      $policy$;
    ELSE
      EXECUTE $policy$
        create policy bookings_tenant_insert_policy on public.bookings
        for insert
        to authenticated
        with check (
          app.current_role() = 'tenant'
          and tenant_profile_id = auth.uid()
          and exists (
            select 1
            from public.tenant_subscriptions ts
            where ts.user_id = auth.uid()
              and ts.subscription_type = 'house_search'
              and ts.status = 'active'
              and ts.payment_status = 'paid'
              and (ts.expires_at is null or ts.expires_at > now())
          )
          and exists (
            select 1
            from public.units u
            where u.id = bookings.unit_id
              and u.owner_id = bookings.owner_id
              and u.status = 'vacant'
              and exists (
                select 1
                from public.profiles p
                where p.id = u.owner_id
                  and p.role = 'landlord'
                  and p.approval_status = 'approved'
                  and coalesce(p.kyc_verified, false) = true
              )
              and exists (
                select 1
                from public.landlord_feature_access lfa
                where lfa.landlord_id = u.owner_id
                  and lfa.feature = 'marketplace_listing'
                  and lfa.is_active = true
                  and (lfa.expires_at is null or lfa.expires_at > now())
              )
              and exists (
                select 1
                from public.plots pl
                where pl.owner_id = u.owner_id
                  and pl.plot_id = u.plot_id
                  and pl.approval_status = 'approved'
                  and coalesce(pl.ownership_verified, false) = true
              )
          )
        )
      $policy$;
    END IF;
  END IF;
END;
$$;

-- ============================================================================
-- 15. VERIFICATION - Check that migrations completed successfully
-- ============================================================================

-- Verify profiles table changes
SELECT COUNT(*) as profiles_with_approval_status
FROM information_schema.columns
WHERE table_name = 'profiles'
  AND column_name IN ('approval_status', 'kyc_verified', 'approved_by');

-- Verify new tables exist
SELECT
  'landlord_documents' as table_name,
  COUNT(*) as column_count
FROM information_schema.columns
WHERE table_name = 'landlord_documents'

UNION ALL

SELECT
  'tenant_subscriptions',
  COUNT(*)
FROM information_schema.columns
WHERE table_name = 'tenant_subscriptions'

UNION ALL

SELECT
  'landlord_feature_access',
  COUNT(*)
FROM information_schema.columns
WHERE table_name = 'landlord_feature_access'

UNION ALL

SELECT
  'platform_income',
  COUNT(*)
FROM information_schema.columns
WHERE table_name = 'platform_income';

-- ============================================================================
-- End of Migration
-- ============================================================================
--
-- SUCCESS CRITERIA:
-- - No errors during execution
-- - All new columns added to profiles and plots
-- - All new tables created
-- - All indexes created
-- - All RLS policies created
-- - All helper functions created and granted
--
-- NEXT STEPS:
-- 1. Test in staging environment
-- 2. Verify no performance regressions
-- 3. Back up production database
-- 4. Run in production
-- 5. Deploy API endpoints and UI components
-- 6. Test approval workflows end-to-end
