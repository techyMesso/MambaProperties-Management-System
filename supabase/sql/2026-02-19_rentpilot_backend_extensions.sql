create policy maintenance_assignments_all_policy on public.maintenance_assignments
for all
using (app.is_admin() or owner_id = auth.uid())
with check (app.is_admin() or owner_id = auth.uid());

drop policy if exists subscription_plans_read_policy on public.subscription_plans;
create policy subscription_plans_read_policy on public.subscription_plans
for select
using (active = true or app.is_admin());

drop policy if exists subscription_plans_admin_policy on public.subscription_plans;
create policy subscription_plans_admin_policy on public.subscription_plans
for all
using (app.is_admin())
with check (app.is_admin());

drop policy if exists landlord_subscriptions_all_policy on public.landlord_subscriptions;
create policy landlord_subscriptions_all_policy on public.landlord_subscriptions
for all
using (app.is_admin() or owner_id = auth.uid())
with check (app.is_admin() or owner_id = auth.uid());

drop policy if exists platform_fee_rules_read_policy on public.platform_fee_rules;
create policy platform_fee_rules_read_policy on public.platform_fee_rules
for select
using (active = true or app.is_admin());

drop policy if exists platform_fee_rules_admin_policy on public.platform_fee_rules;
create policy platform_fee_rules_admin_policy on public.platform_fee_rules
for all
using (app.is_admin())
with check (app.is_admin());

drop policy if exists meter_readings_all_policy on public.meter_readings;
create policy meter_readings_all_policy on public.meter_readings
for all
using (app.is_admin() or owner_id = auth.uid())
with check (app.is_admin() or owner_id = auth.uid());

drop policy if exists insurance_policies_all_policy on public.insurance_policies;
create policy insurance_policies_all_policy on public.insurance_policies
for all
using (app.is_admin() or owner_id = auth.uid())
with check (app.is_admin() or owner_id = auth.uid());

drop policy if exists classifieds_listings_all_policy on public.classifieds_listings;
create policy classifieds_listings_all_policy on public.classifieds_listings
for all
using (app.is_admin() or owner_id = auth.uid() or status = 'active')
with check (app.is_admin() or owner_id = auth.uid());

-- Keep rows aligned if plot_ref is still null but textual keys match
update public.units u
set plot_ref = p.id
from public.plots p
where u.plot_ref is null
  and u.owner_id = p.owner_id
  and u.plot_id = p.plot_id;
