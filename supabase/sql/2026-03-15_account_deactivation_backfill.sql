-- Backfill deactivated accounts from auth.users metadata into public.profiles
-- Run after 2026-03-15_account_deactivation.sql

UPDATE public.profiles AS p
SET
  account_status = 'deactivated',
  deactivated_at = COALESCE(
    p.deactivated_at,
    NULLIF(auth.users.raw_user_meta_data->>'account_deactivated_at', '')::timestamptz,
    NULLIF(auth.users.raw_app_meta_data->>'account_deactivated_at', '')::timestamptz,
    timezone('utc', now())
  ),
  deactivation_reason = COALESCE(
    p.deactivation_reason,
    NULLIF(auth.users.raw_user_meta_data->>'account_deactivated_reason', ''),
    NULLIF(auth.users.raw_app_meta_data->>'account_deactivated_reason', '')
  )
FROM auth.users
WHERE auth.users.id = p.id
  AND COALESCE(p.account_status, 'active') <> 'deactivated'
  AND (
    LOWER(COALESCE(auth.users.raw_user_meta_data->>'account_deactivated', '')) = 'true'
    OR LOWER(COALESCE(auth.users.raw_app_meta_data->>'account_deactivated', '')) = 'true'
  );

-- Mark orphaned profiles (missing auth.users) as deactivated
UPDATE public.profiles AS p
SET
  account_status = 'deactivated',
  deactivated_at = COALESCE(p.deactivated_at, timezone('utc', now())),
  deactivation_reason = COALESCE(p.deactivation_reason, 'orphaned_profile')
WHERE COALESCE(p.account_status, 'active') <> 'deactivated'
  AND NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = p.id);
