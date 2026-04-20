# Payment API Contract

**System:** MambaProperties  
**Updated:** March 28, 2026

## Purpose

This document defines the current payment initiation and callback contract used by:

- tenant marketplace subscriptions
- landlord or agent plan subscriptions
- tenant rent or invoice M-Pesa STK payments

All payment flows converge on the shared M-Pesa callback route.

## Route Map

### 1. Tenant Marketplace Subscription

- Route: `POST /api/tenant/subscriptions/initiate`
- Purpose: create or continue a tenant `house_search` subscription and send an STK push

### 2. Landlord or Agent Plan Subscription

- Route: `POST /api/landlord/features/request`
- Purpose: request `landlord_marketplace`, `landlord_management`, or `landlord_full_access` and send an STK push

### 3. Generic Rent or Invoice STK Payment

- Route: `POST /api/payments/mpesa/stk-push`
- Purpose: initiate a normal tenant rent or invoice M-Pesa payment

### 4. Shared Callback

- Route: `POST /api/payments/mpesa/callback`
- Purpose: process M-Pesa callback payloads and activate the related payment or subscription record

## Status Semantics

### `202 Accepted`

Returned when the app successfully sends an STK request to M-Pesa and is waiting for user action on the phone.

Common fields:

- `checkoutRequestId`
- `customerMessage`
- `nextAction: "enter_pin"`

### `502 Bad Gateway`

Returned when the app is healthy but the upstream M-Pesa request fails.

Common fields:

- `error`
- `errorCode: "BAD_GATEWAY"`
- `errorDetails.provider: "mpesa"`
- `errorDetails.nextAction: "payment_failed"`

### `400 Bad Request`

Returned for invalid input or invalid local business conditions.

Examples:

- invalid phone number
- invalid plan code
- tenant already has an active subscription

### `401 Unauthorized`

Returned when the user is not authenticated.

### `403 Forbidden`

Returned when the user is authenticated but is not allowed to use that payment route.

## Tenant Subscription API

### Request

`POST /api/tenant/subscriptions/initiate`

```json
{
  "subscriptionType": "house_search",
  "phoneNumber": "0712345678"
}
```

### Successful STK Response

HTTP `202`

```json
{
  "success": true,
  "subscriptionId": "uuid",
  "subscriptionType": "house_search",
  "subscriptionName": "Tenant House Search",
  "amount": 299,
  "currency": "KES",
  "status": "pending_payment",
  "paymentStatus": "pending_confirmation",
  "checkoutRequestId": "ws_CO_...",
  "customerMessage": "Success. Request accepted for processing",
  "nextAction": "enter_pin",
  "requestId": "uuid"
}
```

### Existing Pending STK Response

HTTP `200`

Used when a pending subscription already has a live `payment_reference`.

```json
{
  "success": true,
  "subscriptionId": "uuid",
  "status": "pending_payment",
  "checkoutRequestId": "ws_CO_...",
  "nextAction": "complete_existing_payment",
  "message": "A previous M-Pesa prompt is still pending. Complete that payment or wait for it to expire before retrying.",
  "requestId": "uuid"
}
```

### Upstream M-Pesa Failure

HTTP `502`

```json
{
  "success": false,
  "error": "Wrong credentials",
  "errorCode": "BAD_GATEWAY",
  "errorDetails": {
    "provider": "mpesa",
    "subscriptionId": "uuid",
    "subscriptionType": "house_search",
    "nextAction": "payment_failed",
    "paymentStatus": "not_started"
  },
  "requestId": "uuid"
}
```

## Landlord Plan API

### Request

`POST /api/landlord/features/request`

```json
{
  "feature": "landlord_full_access",
  "phoneNumber": "0712345678"
}
```

### Successful STK Response

HTTP `202`

```json
{
  "success": true,
  "feature": "landlord_full_access",
  "featureName": "Full Subscription",
  "amount": 2199,
  "currency": "KES",
  "status": "pending_payment",
  "paymentStatus": "pending_confirmation",
  "checkoutRequestId": "ws_CO_...",
  "customerMessage": "Success. Request accepted for processing",
  "nextAction": "enter_pin",
  "requestId": "uuid"
}
```

### Upstream M-Pesa Failure

HTTP `502`

```json
{
  "success": false,
  "error": "Wrong credentials",
  "errorCode": "BAD_GATEWAY",
  "errorDetails": {
    "provider": "mpesa",
    "feature": "landlord_full_access",
    "requestedRole": "landlord",
    "nextAction": "payment_failed",
    "paymentStatus": "not_started"
  },
  "requestId": "uuid"
}
```

## Generic STK Payment API

### Request

`POST /api/payments/mpesa/stk-push`

```json
{
  "ownerId": "uuid",
  "invoiceId": "uuid",
  "amount": 12000,
  "phoneNumber": "0712345678",
  "accountReference": "INV-2026-0001",
  "description": "Rent payment for March 2026"
}
```

### Successful STK Response

HTTP `202`

```json
{
  "success": true,
  "paymentId": "uuid",
  "receiptNo": null,
  "amount": 12000,
  "ownerId": "uuid",
  "status": "pending",
  "paymentStatus": "pending_confirmation",
  "checkoutRequestId": "ws_CO_...",
  "customerMessage": "Success. Request accepted for processing",
  "nextAction": "enter_pin",
  "requestId": "uuid"
}
```

### Upstream M-Pesa Failure

HTTP `502`

```json
{
  "success": false,
  "error": "Wrong credentials",
  "errorCode": "BAD_GATEWAY",
  "errorDetails": {
    "provider": "mpesa",
    "ownerId": "uuid",
    "amount": 12000,
    "accountReference": "INV-2026-0001",
    "nextAction": "payment_failed",
    "paymentStatus": "not_started"
  },
  "requestId": "uuid"
}
```

## Callback Responsibilities

`POST /api/payments/mpesa/callback` is responsible for:

- verifying callback authenticity based on configured callback rules
- locating the related `payments` row by `channel_reference`
- locating tenant subscriptions by `payment_reference`
- validating callback amount against stored amount before activation
- activating `tenant_subscriptions` on successful payment
- activating `landlord_feature_access` on successful landlord plan payment
- logging `payment_provider_events`

## Business Rules

### Tenant Subscription

- only tenant accounts can call `POST /api/tenant/subscriptions/initiate`
- tenant marketplace access is gated by an active, paid `house_search` subscription

### Landlord or Agent Plans

- only landlord or agent onboarding accounts can call `POST /api/landlord/features/request`
- dashboard access now requires:
  - admin approval
  - KYC verification
  - active paid landlord feature access

### Generic Rent Payment

- tenants can only pay for owners they are mapped to
- admins can initiate payment for another owner

## Known External Dependency Risk

If OAuth succeeds but STK still returns:

- `errorCode: "500.001.1001"`
- `errorMessage: "Wrong credentials"`

the remaining cause is normally outside the app code and usually points to:

- `MPESA_SHORTCODE`
- `MPESA_PASSKEY`
- Daraja sandbox STK credential pairing
- incorrect machine date/time used during STK password generation

## Related Files

- `src/app/api/tenant/subscriptions/initiate/route.js`
- `src/app/api/landlord/features/request/route.js`
- `src/app/api/payments/mpesa/stk-push/route.js`
- `src/app/api/payments/mpesa/callback/route.js`
- `src/libs/payments/mpesa.js`
- `src/proxy.js`
- `src/libs/auth/postAuthRedirect.js`

