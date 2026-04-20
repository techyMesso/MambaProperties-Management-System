-- Quick approval schema patch (idempotent)
-- Ensures landlord + plot approval fields exist.

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS approval_status TEXT
  DEFAULT 'pending'
  CHECK (approval_status IN ('pending', 'approved', 'rejected', 'suspended'));

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS kyc_verified BOOLEAN DEFAULT FALSE;

ALTER TABLE public.plots
ADD COLUMN IF NOT EXISTS approval_status TEXT
  DEFAULT 'pending'
  CHECK (approval_status IN ('pending', 'approved', 'rejected', 'unlisted'));

ALTER TABLE public.plots
ADD COLUMN IF NOT EXISTS ownership_verified BOOLEAN DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_profiles_approval_status
ON public.profiles(approval_status);

CREATE INDEX IF NOT EXISTS idx_profiles_kyc_verified
ON public.profiles(kyc_verified);

CREATE INDEX IF NOT EXISTS idx_plots_approval_status
ON public.plots(approval_status);

CREATE INDEX IF NOT EXISTS idx_plots_owner_approval
ON public.plots(owner_id, approval_status);
