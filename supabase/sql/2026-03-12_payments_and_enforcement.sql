-- MambaProperties: Payments + Marketplace Enforcement Alignment
-- Migration File: 2026-03-12_payments_and_enforcement.sql
--
-- This migration aligns payment records with live API usage and ensures
-- marketplace listing flags exist for enforcement.
-- Safe to run multiple times.

-- ============================================================================
-- 1. PAYMENTS TABLE ALIGNMENT
-- ============================================================================

ALTER TABLE public.payments
ADD COLUMN IF NOT EXISTS invoice_id UUID REFERENCES public.invoices(id) ON DELETE SET NULL;

ALTER TABLE public.payments
ADD COLUMN IF NOT EXISTS channel_reference TEXT;

ALTER TABLE public.payments
ADD COLUMN IF NOT EXISTS transaction_ref TEXT;

ALTER TABLE public.payments
ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;

ALTER TABLE public.payments
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

ALTER TABLE public.payments
ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'KES';

ALTER TABLE public.payments
ADD COLUMN IF NOT EXISTS payment_purpose TEXT;

ALTER TABLE public.payments
ADD COLUMN IF NOT EXISTS related_tenant_subscription_id UUID REFERENCES public.tenant_subscriptions(id) ON DELETE SET NULL;

ALTER TABLE public.payments
ADD COLUMN IF NOT EXISTS related_feature_access_id UUID REFERENCES public.landlord_feature_access(id) ON DELETE SET NULL;

-- Indexes for callback lookup and reporting
CREATE INDEX IF NOT EXISTS idx_payments_channel_reference
ON public.payments(channel_reference);

CREATE INDEX IF NOT EXISTS idx_payments_transaction_ref
ON public.payments(transaction_ref);

CREATE INDEX IF NOT EXISTS idx_payments_invoice_id
ON public.payments(invoice_id);

CREATE INDEX IF NOT EXISTS idx_payments_paid_at
ON public.payments(paid_at);

CREATE INDEX IF NOT EXISTS idx_payments_tenant_subscription
ON public.payments(related_tenant_subscription_id);

CREATE INDEX IF NOT EXISTS idx_payments_feature_access
ON public.payments(related_feature_access_id);

-- ============================================================================
-- 2. UNITS TABLE ALIGNMENT (MARKETPLACE LISTING FLAG)
-- ============================================================================

ALTER TABLE public.units
ADD COLUMN IF NOT EXISTS is_listed BOOLEAN DEFAULT TRUE;
