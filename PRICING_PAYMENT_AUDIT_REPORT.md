# Pricing & Payment System Technical Audit Report

**Date:** March 22, 2026
**Auditor:** Automated Code Audit
**System:** MambaProperties Property Management System

---

## Executive Summary

This audit examines the pricing routing and payment infrastructure of the MambaProperties platform. The system supports:

- M-Pesa STK Push payments for rent collection
- Tenant subscriptions (House Search, Market Premium)
- Landlord feature subscriptions (Marketplace, Management Module)
- Platform fee rules configuration
- Manual payment recording for tenants

**Overall Assessment:** The system is well-architected with proper separation of concerns, rate limiting, and security controls. However, several areas require attention.

---

## 1. Pricing Architecture

### 1.1 Pricing Configuration Locations

| Location                                                                                                         | Purpose                                          |
| ---------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| [`src/libs/constants.js`](src/libs/constants.js)                                                                 | Hardcoded fallback pricing (KES 299/999)         |
| [`src/libs/pricing/subscriptionPlans.js`](src/libs/pricing/subscriptionPlans.js)                                 | Database-backed plan catalog with fallback logic |
| [`supabase/sql/2026-03-19_subscription_plan_catalog.sql`](supabase/sql/2026-03-19_subscription_plan_catalog.sql) | Database schema and seed data                    |
| [`src/app/api/admin/subscription-plans/`](src/app/api/admin/subscription-plans/)                                 | Admin CRUD for subscription plans                |

### 1.2 Current Pricing Tiers

| Plan                | Code                   | Amount (KES) | Duration | Audience       |
| ------------------- | ---------------------- | ------------ | -------- | -------------- |
| Tenant House Search | `tenant_house_search`  | 299          | 30 days  | tenant         |
| Marketplace Only    | `landlord_marketplace` | 999          | 365 days | landlord/agent |
| Management Module   | `landlord_management`  | 1,499        | 365 days | landlord/agent |
| Full Subscription   | `landlord_full_access` | 2,199        | 365 days | landlord/agent |

### 1.3 Issues Identified

**Issue #1.1: Dual Pricing Configuration**

- Pricing exists in both constants.js and database
- Fallback logic in [`subscriptionPlans.js:112-118`](src/libs/pricing/subscriptionPlans.js:112) returns hardcoded values if DB is empty
- Risk: Inconsistency between configured and actual pricing

**Issue #1.2: No Price Validation on Subscription Creation**

- Subscription plans can be created with any amount via admin API
- No validation for negative, zero, or unreasonably high amounts
- See [`admin/subscription-plans/route.js:77-78`](src/app/api/admin/subscription-plans/route.js:77)

---

## 2. Payment Processing Flow

### 2.1 M-Pesa STK Push Integration

**Endpoints:**

- Initiate: [`/api/payments/mpesa/stk-push`](src/app/api/payments/mpesa/stk-push/route.js)
- Callback: [`/api/payments/mpesa/callback`](src/app/api/payments/mpesa/callback/route.js)

**Flow:**

1. Tenant/Landlord initiates payment via STK Push
2. Payment record created with status `pending`
3. M-Pesa processes payment and sends callback
4. Callback updates payment status to `paid` or `failed`
5. Related subscriptions/features are activated

### 2.2 Payment Security Features

**Implemented:**

- Rate limiting: 8 requests per 5 minutes for STK push
- IP allowlisting for callbacks (configurable)
- Callback signature verification with SHA256
- Timestamp validation (max 10 minutes default)
- Phone number normalization

**Configuration (Environment Variables):**

```
MPESA_ENV=sandbox|production
MPESA_CONSUMER_KEY=***
MPESA_CONSUMER_SECRET=***
MPESA_SHORTCODE=***
MPESA_PASSKEY=***
MPESA_CALLBACK_URL=***
MPESA_CALLBACK_SECRET=***
MPESA_CALLBACK_IP_ALLOWLIST=***
```

### 2.3 Issues Identified

**Issue #2.1: Amount Not Validated Against Callback**

- In [`callback/route.js:487-492`](src/app/api/payments/mpesa/callback/route.js), the payment amount is NOT validated
- The callback amount is read but the original payment amount is used
- Risk: Attacker could manipulate callback to overcharge

**Issue #2.2: No Idempotency Key**

- Payment updates use `checkoutRequestId` but don't prevent race conditions
- Multiple simultaneous callbacks could cause duplicate processing
- See [`callback/route.js:159-167`](src/app/api/payments/mpesa/callback/route.js:159)

**Issue #2.3: Allow Unsigned Callbacks**

- `MPESA_ALLOW_UNSIGNED_CALLBACKS` defaults to accepting unsigned callbacks if not configured
- This is a potential security risk in production

---

## 3. Subscription Management

### 3.1 Tenant Subscriptions

**Endpoint:** [`/api/tenant/subscriptions/initiate`](src/app/api/tenant/subscriptions/initiate/route.js)

**Flow:**
d
1. Tenant selects subscription type (house_search)
2. System fetches pricing from database
3. Creates pending subscription record
4. Initiates M-Pesa STK Push
5. User completes payment
6. Callback activates subscription

### 3.2 Landlord Feature Subscriptions

**Endpoint:** [`/api/landlord/features/request`](src/app/api/landlord/features/request/route.js)

**Features:**

- `marketplace_listing`: List properties on marketplace
- `management_module`: Access tenant management tools
- `full_access`: Both features combined

### 3.3 Access Control Logic

**Tenant Access:** [`src/libs/tenant/subscriptionAccess.js`](src/libs/tenant/subscriptionAccess.js)

- Checks `tenant_subscriptions` table for active, paid status
- Validates `expires_at` date

**Landlord Access:** [`src/libs/landlord/featureAccess.js`](src/libs/landlord/featureAccess.js)

- Checks `landlord_feature_access` table
- Validates `is_active` flag and `expires_at`

### 3.4 Issues Identified

**Issue #3.1: Subscription Activation Race Condition**

- In [`tenant/subscriptions/initiate/route.js:131-195`](src/app/api/tenant/subscriptions/initiate/route.js), existing pending subscriptions trigger auto-STK without creating new subscription
- Could lead to duplicate payments for same subscription

**Issue #3.2: No Amount Validation in Subscription Creation**

- Subscription `amount_due` comes from pricing but is not validated
- Database allows null amounts with default

---

## 4. Manual Payment Recording

### 4.1 Tenant Manual Payments

**Endpoint:** [`/api/tenant/payments/manual`](src/app/api/tenant/payments/manual/route.js)

**Supported Methods:**

- bank_transfer
- card
- cash
- other

**Flow:**

1. Tenant selects invoice
2. Records payment method, amount, proof
3. Creates pending payment record
4. Landlord must verify before status changes

### 4.2 Issues Identified

**Issue #4.1: Manual Payments Default to Pending**

- All manual payments are created with `status: pending`
- No automatic verification mechanism
- Requires landlord/admin manual approval

---

## 5. Fee Rules Configuration

### 5.1 Platform Fee Rules

**Admin Endpoints:**

- Create: [`/api/admin/fees`](src/app/api/admin/fees/route.js)
- Update: [`/api/admin/fees/[feeId]`](src/app/api/admin/fees/[feeId]/route.js)

**Fee Types:**

- Percentage-based (e.g., 10% commission)
- Flat amount (e.g., KES 500 processing fee)

### 5.2 Issues Identified

**Issue #5.1: Fee Rules Not Enforced**

- Fee rules can be created but are NOT used in payment processing
- No code references `platform_fee_rules` table in payment flows
- Risk: Configured fees have no effect on system

**Issue #5.2: Dynamic Column Mapping**

- Fee routes use flexible column detection (see [`tableColumns.js`](src/app/api/admin/_lib/tableColumns.js))
- Creates potential for schema confusion
- Makes it hard to track actual fee calculation logic

---

## 6. Database Schema

### 6.1 Key Tables

| Table                     | Purpose                       |
| ------------------------- | ----------------------------- |
| `subscription_plans`      | Pricing catalog               |
| `tenant_subscriptions`    | Tenant subscription records   |
| `landlord_subscriptions`  | Landlord subscription records |
| `landlord_feature_access` | Feature toggle tracking       |
| `payments`                | All payment transactions      |
| `payment_provider_events` | M-Pesa callback logs          |
| `platform_fee_rules`      | Fee configuration             |
| `invoices`                | Tenant invoices               |

### 6.2 Payments Table Schema

```sql
payments (
  id UUID PRIMARY KEY,
  owner_id UUID,           -- Landlord/agent ID
  tenant_name TEXT,
  channel TEXT,            -- "M-Pesa STK", "Bank Transfer"
  amount NUMERIC,
  status TEXT,             -- pending, paid, failed
  receipt_no TEXT,
  invoice_id UUID,
  channel_reference TEXT, -- M-Pesa CheckoutRequestID
  transaction_ref TEXT,    -- M-Pesa Receipt Number
  paid_at TIMESTAMPTZ,
  metadata JSONB,
  currency TEXT DEFAULT 'KES',
  payment_purpose TEXT,
  related_tenant_subscription_id UUID,
  related_feature_access_id UUID
)
```

### 6.3 Issues Identified

**Issue #6.1: Missing Payment Amount Constraints**

- No CHECK constraint on positive amounts
- Database allows negative payment amounts

---

## 7. Security Assessment

### 7.1 Strengths

✅ Rate limiting on all payment endpoints
✅ CSRF protection via `enforceSameOriginMutation`
✅ Admin authorization required for pricing changes
✅ Callback IP allowlisting option
✅ Signature verification for callbacks
✅ Phone number input normalization
✅ Audit logging for admin actions

### 7.2 Vulnerabilities

❌ **Critical:** No callback amount validation (Issue #2.1)
❌ **High:** Fee rules not enforced (Issue #5.1)
⚠️ **Medium:** Allow unsigned callbacks by default (Issue #2.3)
⚠️ **Medium:** Subscription race conditions (Issue #3.1)
⚠️ **Low:** No idempotency keys (Issue #2.2)

---

## 8. Frontend Components

### 8.1 Key Components

| Component       | Location                                                                                           |
| --------------- | -------------------------------------------------------------------------------------------------- |
| Pricing Page    | [`src/app/(blank-layout-pages)/pricing/page.jsx`](<src/app/(blank-layout-pages)/pricing/page.jsx>) |
| Fees Admin View | [`src/views/admin/FeesCommissionsAdminView.jsx`](src/views/admin/FeesCommissionsAdminView.jsx)     |

### 8.2 Issues Identified

**Issue #8.1: Pricing Displayed from Client-Side Fetch**

- Pricing page fetches from server component but could be cached
- No refresh mechanism when admin updates prices

---

## 9. Recommendations

### 9.1 Immediate Actions (Critical)

1. **Validate Callback Amount**

   ```javascript
   // In callback/route.js, add:
   if (callbackAmount !== paymentRow.amount) {
     return API_RESPONSES.badRequest(request, 'Amount mismatch.')
   }
   ```

2. **Enforce Fee Rules**
   - Implement fee calculation in payment processing
   - Add validation before payment completion

3. **Disable Unsigned Callbacks**
   - Set `MPESA_ALLOW_UNSIGNED_CALLBACKS=0` in production

### 9.2 Short-term Improvements

1. Add idempotency keys for payment processing
2. Implement payment amount constraints in database
3. Add validation for subscription plan amounts
4. Create audit trail for price changes

### 9.3 Long-term Enhancements

1. Consider payment webhooks for third-party integrations
2. Add payment reconciliation reports
3. Implement refund processing
4. Add payment method diversity (cards, bank transfers)

---

## 10. Test Coverage Recommendations

The following test scenarios should be added:

| Scenario                          | Expected Behavior        |
| --------------------------------- | ------------------------ |
| Callback with wrong amount        | Reject with error        |
| Duplicate callback                | Idempotent response      |
| Expired callback timestamp        | Reject with error        |
| Invalid callback signature        | Reject with 401          |
| Subscription with negative amount | Validation error         |
| Fee rule on payment               | Amount reduced correctly |

---

## Appendix: File Reference Map

### Payment Processing

- [`src/app/api/payments/mpesa/stk-push/route.js`](src/app/api/payments/mpesa/stk-push/route.js) - STK initiation
- [`src/app/api/payments/mpesa/callback/route.js`](src/app/api/payments/mpesa/callback/route.js) - Callback handling
- [`src/libs/payments/mpesa.js`](src/libs/payments/mpesa.js) - M-Pesa utilities

### Subscriptions

- [`src/app/api/tenant/subscriptions/initiate/route.js`](src/app/api/tenant/subscriptions/initiate/route.js) - Tenant subscription
- [`src/app/api/landlord/features/request/route.js`](src/app/api/landlord/features/request/route.js) - Landlord subscription
- [`src/libs/pricing/subscriptionPlans.js`](src/libs/pricing/subscriptionPlans.js) - Pricing logic

### Admin

- [`src/app/api/admin/subscription-plans/`](src/app/api/admin/subscription-plans/) - Plan management
- [`src/app/api/admin/fees/`](src/app/api/admin/fees/) - Fee rules
- [`src/app/api/admin/subscriptions/[subscriptionId]/decision/`](src/app/api/admin/subscriptions/[subscriptionId]/decision/) - Subscription decisions

### Access Control

- [`src/libs/tenant/subscriptionAccess.js`](src/libs/tenant/subscriptionAccess.js)
- [`src/libs/landlord/featureAccess.js`](src/libs/landlord/featureAccess.js)

---

_End of Report_
