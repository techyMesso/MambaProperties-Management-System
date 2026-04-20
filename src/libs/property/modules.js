import { modulePages } from '@views/property/moduleData'
import { USER_ROLES } from '@/libs/auth/roles'

/**
 * Convert a value to a number or null when not parseable.
 * @param {unknown} value
 * @returns {number|null}
 */
const toNumber = value => {
  if (value === null || value === undefined || value === '') {
    return null
  }

  const parsed = Number(value)

  return Number.isNaN(parsed) ? null : parsed
}

/**
 * Convert a value to an ISO date string (YYYY-MM-DD) or null.
 * @param {unknown} value
 * @returns {string|null}
 */
const toDate = value => {
  if (!value) {
    return null
  }

  const parsed = new Date(value)

  if (Number.isNaN(parsed.getTime())) {
    return null
  }

  return parsed.toISOString().slice(0, 10)
}

/**
 * Convert a value to an ISO timestamp or null.
 * @param {unknown} value
 * @returns {string|null}
 */
const toTimestamp = value => {
  if (!value) {
    return null
  }

  const parsed = new Date(value)

  if (Number.isNaN(parsed.getTime())) {
    return null
  }

  return parsed.toISOString()
}

/**
 * Normalize a value to a trimmed string.
 * @param {unknown} value
 * @returns {string}
 */
const normalizeString = value => {
  if (value === null || value === undefined) {
    return ''
  }

  return String(value).trim()
}

const KNOWN_SUBSCRIPTION_PLAN_LABELS = {
  tenant_house_search: 'Tenant House Search',
  house_search: 'Tenant House Search',
  landlord_marketplace: 'Marketplace Only',
  marketplace_listing: 'Marketplace Only',
  landlord_management: 'Management Module Only',
  management_module: 'Management Module Only',
  landlord_full_access: 'Full Subscription',
  full_access: 'Full Subscription'
}

const pickFirstString = values => values.map(value => normalizeString(value)).find(Boolean) || ''

const resolveKnownSubscriptionPlanLabel = value => {
  const normalized = normalizeString(value).toLowerCase()

  return KNOWN_SUBSCRIPTION_PLAN_LABELS[normalized] || ''
}

const hasMeaningfulSubscriptionPlan = value => {
  const normalized = normalizeString(value).toLowerCase()

  return Boolean(normalized && normalized !== '-' && normalized !== 'plan')
}

/**
 * Normalize amenities from array or comma-separated text.
 * @param {unknown} value
 * @returns {string[]}
 */
const normalizeAmenities = value => {
  if (Array.isArray(value)) {
    return value
      .map(item => normalizeString(item))
      .filter(Boolean)
      .slice(0, 50)
  }

  const fromText = normalizeString(value)

  if (!fromText) {
    return []
  }

  return fromText
    .split(',')
    .map(item => normalizeString(item))
    .filter(Boolean)
    .slice(0, 50)
}

/**
 * Build a short human-readable code with a prefix.
 * @param {string} prefix
 * @returns {string}
 */
const buildCode = prefix => {
  const date = new Date()
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  const rand = Math.floor(Math.random() * 900 + 100)

  return `${prefix}-${y}${m}${d}-${rand}`
}

/**
 * Use a provided value or generate a code if missing.
 * @param {unknown} value
 * @param {string} prefix
 * @returns {string}
 */
const pickOrGenerate = (value, prefix) => {
  const normalized = normalizeString(value)

  return normalized || buildCode(prefix)
}

/**
 * Convert a value to an ISO datetime local string (YYYY-MM-DDTHH:mm) or empty string.
 * @param {unknown} value
 * @returns {string}
 */
const toISODateTimeLocal = value => {
  if (!value) {
    return ''
  }

  const parsed = new Date(value)

  if (Number.isNaN(parsed.getTime())) {
    return ''
  }

  return parsed.toISOString().slice(0, 16)
}

/**
 * Format a value as a KES amount or empty string.
 * @param {unknown} value
 * @returns {string}
 */
const formatMaybeAmount = value => {
  const amount = toNumber(value)

  if (amount === null) {
    return ''
  }

  return `KES ${Math.max(0, amount).toLocaleString('en-KE')}`
}

const createFieldsByModule = {
  properties: [
    { name: 'plotId', label: 'Plot ID', required: false, placeholder: 'Auto generated if empty' },
    { name: 'name', label: 'Estate Name', required: true },
    { name: 'location', label: 'Location', required: true },
    { name: 'manager', label: 'Manager', required: true },
    {
      name: 'availabilityStatus',
      label: 'Availability',
      required: true,
      type: 'select',
      options: ['vacant', 'occupied']
    }
  ],
  units: [
    { name: 'unitId', label: 'Unit ID', required: false, placeholder: 'Auto generated if empty' },
    { name: 'plotId', label: 'Plot ID', required: true },
    { name: 'category', label: 'Category', required: true },
    { name: 'rent', label: 'Rent (KES)', required: true, type: 'number' },
    { name: 'description', label: 'Description', required: false },
    { name: 'amenities', label: 'Amenities (comma separated)', required: false },
    { name: 'isListed', label: 'Listed in Marketplace', required: false, type: 'select', options: ['true', 'false'] },
    { name: 'status', label: 'Status', required: true, type: 'select', options: ['vacant', 'occupied'] },
    {
      name: 'stage',
      label: 'Booking Stage',
      required: false,
      type: 'select',
      options: ['open', 'scheduled', 'pending']
    }
  ],
  tenants: [
    { name: 'tenant', label: 'Tenant Name', required: true },
    { name: 'phone', label: 'Phone', required: true },
    { name: 'occupation', label: 'Occupation', required: false },
    { name: 'unit', label: 'Unit ID', required: false },
    {
      name: 'paymentStatus',
      label: 'Payment Status',
      required: true,
      type: 'select',
      options: ['paid', 'partial', 'arrears', 'pending']
    }
  ],
  tenancies: [
    { name: 'agreementId', label: 'Agreement ID', required: false, placeholder: 'Auto generated if empty' },
    { name: 'tenant', label: 'Tenant Name', required: true },
    { name: 'unit', label: 'Unit ID', required: true },
    { name: 'moveIn', label: 'Move-In Date', required: true, type: 'date' },
    { name: 'moveOut', label: 'Move-Out Date', required: false, type: 'date' },
    {
      name: 'status',
      label: 'Status',
      required: true,
      type: 'select',
      options: ['active', 'pending', 'move-out scheduled']
    }
  ],
  payments: [
    { name: 'receiptNo', label: 'Receipt No', required: false, placeholder: 'Auto generated if empty' },
    { name: 'tenant', label: 'Tenant Name', required: true },
    { name: 'channel', label: 'Channel', required: true },
    { name: 'amount', label: 'Amount (KES)', required: true, type: 'number' },
    {
      name: 'status',
      label: 'Status',
      required: true,
      type: 'select',
      options: ['paid', 'partial', 'arrears', 'pending']
    }
  ],
  paymentsMonitoring: [],
  invoices: [
    { name: 'invoiceNo', label: 'Invoice No', required: false, placeholder: 'Auto generated if empty' },
    { name: 'tenant', label: 'Tenant Name', required: true },
    { name: 'period', label: 'Period', required: true, placeholder: 'Feb 2026' },
    { name: 'dueAmount', label: 'Due Amount (KES)', required: true, type: 'number' },
    {
      name: 'status',
      label: 'Status',
      required: true,
      type: 'select',
      options: ['paid', 'partial', 'overdue', 'pending']
    }
  ],
  maintenance: [
    { name: 'ticket', label: 'Ticket', required: false, placeholder: 'Auto generated if empty' },
    { name: 'unit', label: 'Unit ID', required: true },
    { name: 'issueType', label: 'Issue Type', required: true },
    { name: 'assignee', label: 'Assignee', required: false },
    { name: 'priority', label: 'Priority', required: true, type: 'select', options: ['Low', 'Medium', 'High'] },
    {
      name: 'status',
      label: 'Status',
      required: true,
      type: 'select',
      options: ['pending', 'in progress', 'completed']
    }
  ],
  messaging: [
    { name: 'thread', label: 'Thread', required: true },
    { name: 'audience', label: 'Audience', required: true },
    { name: 'channel', label: 'Channel', required: true },
    { name: 'lastUpdate', label: 'Last Update', required: false, type: 'datetime-local' },
    {
      name: 'status',
      label: 'Status',
      required: true,
      type: 'select',
      options: ['scheduled', 'in progress', 'completed']
    }
  ],
  documents: [
    { name: 'docId', label: 'Document ID', required: false, placeholder: 'Auto generated if empty' },
    { name: 'type', label: 'Type', required: true },
    { name: 'owner', label: 'Owner', required: true },
    {
      name: 'filePath',
      label: 'File',
      required: true,
      type: 'file',
      accept: '.pdf,.png,.jpg,.jpeg,.webp,.doc,.docx'
    },
    { name: 'uploaded', label: 'Uploaded On', required: false, type: 'date' },
    {
      name: 'status',
      label: 'Status',
      required: true,
      type: 'select',
      options: ['active', 'pending review', 'archived']
    }
  ],
  reports: [
    { name: 'report', label: 'Report Name', required: true },
    { name: 'scope', label: 'Scope', required: true },
    { name: 'generatedBy', label: 'Generated By', required: true },
    { name: 'updated', label: 'Last Updated', required: false, type: 'datetime-local' },
    {
      name: 'status',
      label: 'Status',
      required: true,
      type: 'select',
      options: ['scheduled', 'completed', 'failed']
    }
  ],
  landlordLeads: [
    {
      field: 'leadId',
      header: 'Lead ID',
      type: 'text'
    },
    {
      field: 'leadName',
      header: 'Lead Name',
      type: 'text'
    },
    {
      field: 'phone',
      header: 'Phone',
      type: 'text'
    },
    {
      field: 'stage',
      header: 'Stage',
      type: 'chip'
    },
    {
      field: 'source',
      header: 'Source',
      type: 'text'
    },
    {
      field: 'createdAt',
      header: 'Created At',
      type: 'text'
    }
  ],
  onboardingPipeline: [],
  subscriptions: [],
  fees: [],
  users: [],
  admin: []
}

const moduleDefinitions = {
  properties: {
    table: 'plots',
    orderBy: 'created_at',
    select: 'id,plotId:plot_id,name,location,manager,availabilityStatus:availability_status',
    toInsert: values => ({
      plot_id: pickOrGenerate(values.plotId, 'PLT'),
      name: normalizeString(values.name),
      location: normalizeString(values.location),
      manager: normalizeString(values.manager),
      availability_status: normalizeString(values.availabilityStatus) || 'vacant'
    }),
    toUpdate: values => ({
      plot_id: normalizeString(values.plotId),
      name: normalizeString(values.name),
      location: normalizeString(values.location),
      manager: normalizeString(values.manager),
      availability_status: normalizeString(values.availabilityStatus) || 'vacant'
    })
  },
  units: {
    table: 'units',
    orderBy: 'created_at',
    select:
      'id,unitId:unit_id,plotId:plot_id,category,rent,status,stage:booking_stage,description,amenities,isListed:is_listed',
    toInsert: values => ({
      unit_id: pickOrGenerate(values.unitId, 'UNT'),
      plot_id: normalizeString(values.plotId),
      category: normalizeString(values.category),
      rent: toNumber(values.rent),
      status: normalizeString(values.status) || 'vacant',
      booking_stage: normalizeString(values.stage) || 'open',
      description: normalizeString(values.description),
      amenities: normalizeAmenities(values.amenities),
      is_listed: values.isListed === false || values.isListed === 'false' ? false : true
    }),
    toUpdate: values => ({
      unit_id: normalizeString(values.unitId),
      plot_id: normalizeString(values.plotId),
      category: normalizeString(values.category),
      rent: toNumber(values.rent),
      status: normalizeString(values.status) || 'vacant',
      booking_stage: normalizeString(values.stage) || 'open',
      description: normalizeString(values.description),
      amenities: normalizeAmenities(values.amenities),
      is_listed: values.isListed === false || values.isListed === 'false' ? false : true
    })
  },
  tenants: {
    table: 'tenants',
    orderBy: 'created_at',
    select: 'id,tenant:tenant_name,phone,occupation,unit:unit_code,paymentStatus:payment_status',
    toInsert: values => ({
      tenant_name: normalizeString(values.tenant),
      phone: normalizeString(values.phone),
      occupation: normalizeString(values.occupation),
      unit_code: normalizeString(values.unit),
      payment_status: normalizeString(values.paymentStatus) || 'pending'
    }),
    toUpdate: values => ({
      tenant_name: normalizeString(values.tenant),
      phone: normalizeString(values.phone),
      occupation: normalizeString(values.occupation),
      unit_code: normalizeString(values.unit),
      payment_status: normalizeString(values.paymentStatus) || 'pending'
    })
  },
  tenancies: {
    table: 'tenancies',
    orderBy: 'created_at',
    select: 'id,agreementId:agreement_id,tenant:tenant_name,unit:unit_code,moveIn:move_in,moveOut:move_out,status',
    toInsert: values => ({
      agreement_id: pickOrGenerate(values.agreementId, 'AGR'),
      tenant_name: normalizeString(values.tenant),
      unit_code: normalizeString(values.unit),
      move_in: toDate(values.moveIn),
      move_out: toDate(values.moveOut),
      status: normalizeString(values.status) || 'pending'
    }),
    toUpdate: values => ({
      agreement_id: normalizeString(values.agreementId) || undefined,
      tenant_name: normalizeString(values.tenant),
      unit_code: normalizeString(values.unit),
      move_in: toDate(values.moveIn),
      move_out: toDate(values.moveOut),
      status: normalizeString(values.status) || 'pending'
    })
  },
  marketplace: {
    table: 'units',
    orderBy: 'created_at',
    select:
      'unitDbId:id,ownerId:owner_id,listing:unit_id,location:plot_id,price:rent,category,stage:booking_stage,status',
    toRows: rows =>
      (rows || [])
        .filter(row => (row.status || '').toLowerCase() === 'vacant')
        .map(row => ({
          unitDbId: row.unitDbId,
          ownerId: row.ownerId,
          listing: row.listing,
          location: row.location,
          price: row.price,
          category: row.category,
          stage: row.stage || 'open'
        })),
    createEnabled: false
  },
  payments: {
    table: 'payments',
    orderBy: 'created_at',
    select: 'receiptNo:receipt_no,tenant:tenant_name,channel,amount,status',
    toInsert: values => ({
      receipt_no: pickOrGenerate(values.receiptNo, 'RCP'),
      tenant_name: normalizeString(values.tenant),
      channel: normalizeString(values.channel),
      amount: toNumber(values.amount),
      status: normalizeString(values.status) || 'pending'
    })
  },
  paymentsMonitoring: {
    table: 'payments',
    orderBy: 'created_at',
    select:
      'paymentId:id,ownerId:owner_id,receiptNo:receipt_no,tenant:tenant_name,channel,amount,status,createdAt:created_at,transactionRef:transaction_ref,checkoutRef:channel_reference,invoiceId:invoice_id',
    createEnabled: false,
    toRows: rows =>
      (rows || []).map(row => ({
        paymentId: normalizeString(row.paymentId) || '-',
        owner: normalizeString(row.ownerId) ? `Owner ${normalizeString(row.ownerId).slice(0, 8)}` : '-',
        receiptNo: normalizeString(row.receiptNo) || '-',
        tenant: normalizeString(row.tenant) || '-',
        channel: normalizeString(row.channel) || '-',
        amount: toNumber(row.amount) ?? 0,
        status: normalizeString(row.status) || '-',
        transactionRef: normalizeString(row.transactionRef) || '-',
        checkoutRef: normalizeString(row.checkoutRef) || '-',
        invoiceId: normalizeString(row.invoiceId) || '-',
        createdAt: toISODateTimeLocal(row.createdAt)
      }))
  },
  invoices: {
    table: 'invoices',
    orderBy: 'created_at',
    select: 'invoiceNo:invoice_no,tenant:tenant_name,period,dueAmount:due_amount,status',
    toInsert: values => ({
      invoice_no: pickOrGenerate(values.invoiceNo, 'INV'),
      tenant_name: normalizeString(values.tenant),
      period: normalizeString(values.period),
      due_amount: toNumber(values.dueAmount),
      status: normalizeString(values.status) || 'pending'
    })
  },
  maintenance: {
    table: 'maintenance_requests',
    orderBy: 'created_at',
    select: 'ticket,unit:unit_code,issueType:issue_type,assignee,priority,status',
    toInsert: values => ({
      ticket: pickOrGenerate(values.ticket, 'MT'),
      unit_code: normalizeString(values.unit),
      issue_type: normalizeString(values.issueType),
      assignee: normalizeString(values.assignee),
      priority: normalizeString(values.priority) || 'Medium',
      status: normalizeString(values.status) || 'pending'
    })
  },
  messaging: {
    table: 'messages',
    orderBy: 'created_at',
    select: 'thread,audience,channel,lastUpdate:last_update,status',
    toRows: rows =>
      (rows || []).map(row => ({
        ...row,
        lastUpdate: toISODateTimeLocal(row.lastUpdate)
      })),
    toInsert: values => ({
      thread: normalizeString(values.thread),
      audience: normalizeString(values.audience),
      channel: normalizeString(values.channel),
      last_update: toTimestamp(values.lastUpdate) || new Date().toISOString(),
      status: normalizeString(values.status) || 'scheduled'
    })
  },
  documents: {
    table: 'documents',
    orderBy: 'created_at',
    select: 'docId:doc_id,type,owner:owner_name,filePath:file_path,uploaded,status',
    toInsert: values => ({
      doc_id: pickOrGenerate(values.docId, 'DOC'),
      type: normalizeString(values.type),
      owner_name: normalizeString(values.owner),
      file_path: normalizeString(values.filePath) || null,
      uploaded: toDate(values.uploaded) || new Date().toISOString().slice(0, 10),
      status: normalizeString(values.status) || 'active'
    })
  },
  reports: {
    table: 'report_runs',
    orderBy: 'created_at',
    select: 'report,scope,generatedBy:generated_by,updated,status',
    toRows: rows =>
      (rows || []).map(row => ({
        ...row,
        updated: toISODateTimeLocal(row.updated)
      })),
    toInsert: values => ({
      report: normalizeString(values.report),
      scope: normalizeString(values.scope),
      generated_by: normalizeString(values.generatedBy),
      updated: toTimestamp(values.updated) || new Date().toISOString(),
      status: normalizeString(values.status) || 'scheduled'
    })
  },
  subscriptions: {
    table: 'landlord_subscriptions',
    orderBy: 'created_at',
    select: '*',
    createEnabled: false,
    toRows: rows =>
      (rows || []).map(row => {
        const ownerId = normalizeString(row.owner_id)
        const requestedPlanCode = pickFirstString([row.requested_plan, row.pending_plan, row.next_plan, row.plan_change_request])
        const requestedPlanName = pickFirstString([row.requested_plan_name, row.pending_plan_name, row.next_plan_name])
        const currentPlanCode = pickFirstString([row.plan_code, row.plan, row.subscription_plan, row.tier])
        const currentPlanName = pickFirstString([row.plan_name])

        const requestedPlan =
          requestedPlanName || resolveKnownSubscriptionPlanLabel(requestedPlanCode) || requestedPlanCode || '-'

        const planLabel = currentPlanName || resolveKnownSubscriptionPlanLabel(currentPlanCode) || currentPlanCode || '-'

        const status = normalizeString(row.status) || (row.active === false ? 'inactive' : 'active')
        const startDate = normalizeString(row.starts_at || row.start_date || row.billing_start || '')
        const endDate = normalizeString(row.ends_at || row.end_date || row.billing_end || '')

        return {
          recordId: normalizeString(row.id),
          subscriptionId: normalizeString(row.subscription_id) || normalizeString(row.id),
          planId: normalizeString(row.plan_id),
          owner: ownerId ? `Owner ${ownerId.slice(0, 8)}` : '-',
          plan: planLabel,
          planCode: currentPlanCode,
          requestedPlan,
          requestedPlanCode,
          status,
          period:
            startDate && endDate
              ? `${startDate.slice(0, 10)} → ${endDate.slice(0, 10)}`
              : startDate.slice(0, 10) || '-',
          updatedAt: toISODateTimeLocal(row.updated_at || row.created_at)
        }
      })
  },
  fees: {
    table: 'platform_fee_rules',
    orderBy: 'created_at',
    select: '*',
    createEnabled: false,
    toRows: rows =>
      (rows || []).map(row => {
        const ruleName =
          normalizeString(row.rule_name) ||
          normalizeString(row.code) ||
          normalizeString(row.fee_type) ||
          normalizeString(row.name) ||
          `Rule ${normalizeString(row.id).slice(0, 8)}`

        const scope = normalizeString(row.scope) || normalizeString(row.applies_to) || 'Platform'
        const percentRate = toNumber(row.rate_percent ?? row.percentage ?? row.commission_percent)
        const flatAmount = toNumber(row.flat_amount ?? row.amount ?? row.fixed_fee)

        const rate =
          percentRate !== null
            ? `${percentRate}%`
            : flatAmount !== null
              ? formatMaybeAmount(flatAmount)
              : normalizeString(row.rate_label) || '-'

        const status = normalizeString(row.status) || (row.active === false ? 'inactive' : 'active')

        return {
          recordId: normalizeString(row.id),
          rule: ruleName,
          scope,
          rate,
          ratePercent: percentRate,
          flatAmount,
          status,
          updatedAt: toISODateTimeLocal(row.updated_at || row.created_at)
        }
      })
  },
  landlordLeads: {
    table: 'profiles',
    orderBy: 'created_at',
    select: 'id,fullName:full_name,phone,role,requestedRole:requested_role,createdAt:created_at,accountStatus:account_status',
    createEnabled: false,
    toRows: rows =>
      (rows || [])
        .filter(row => {
          const role = normalizeString(row.role)
          const requestedRole = normalizeString(row.requestedRole)
          const accountStatus = normalizeString(row.accountStatus)

          return (role === 'landlord' || requestedRole === 'landlord') && accountStatus !== 'deactivated'
        })
        .map(row => {
          const role = normalizeString(row.role)
          const requestedRole = normalizeString(row.requestedRole)

          const stage = role === 'landlord' ? 'converted' : requestedRole === 'landlord' ? 'requested' : 'new'

          return {
            leadId: normalizeString(row.id).slice(0, 8),
            leadName: normalizeString(row.fullName) || 'Landlord Lead',
            phone: normalizeString(row.phone) || '-',
            stage,
            source: requestedRole === 'landlord' ? 'Self-signup request' : 'Platform registration',
            createdAt: toISODateTimeLocal(row.createdAt)
          }
        })
  },
  onboardingPipeline: {
    table: 'landlord_subscriptions',
    orderBy: 'created_at',
    select: '*',
    createEnabled: false,
    toRows: rows =>
      (rows || [])
        .map(row => {
        const ownerId = normalizeString(row.owner_id)
        const currentPlanCode = pickFirstString([row.plan_code, row.plan, row.subscription_plan, row.tier])
        const currentPlanName = pickFirstString([row.plan_name])
        const planLabel = currentPlanName || resolveKnownSubscriptionPlanLabel(currentPlanCode) || currentPlanCode || '-'

        const status = normalizeString(row.status) || (row.active === false ? 'inactive' : 'active')

        const stage =
          status === 'trial'
            ? 'trial'
            : status === 'active'
              ? 'activated'
              : status === 'pending'
                ? 'setup pending'
                : status === 'rejected'
                  ? 'blocked'
                  : 'review'

        return {
          landlord: ownerId ? `Owner ${ownerId.slice(0, 8)}` : '-',
          stage,
          plan: planLabel,
          status,
          nextAction:
            stage === 'setup pending'
              ? 'Complete KYC and setup'
              : stage === 'trial'
                ? 'Activate paid subscription'
                : stage === 'activated'
                  ? 'Retention follow-up'
                  : 'Review account',
          updatedAt: toISODateTimeLocal(row.updated_at || row.created_at)
        }
      })
        .filter(row => !(normalizeString(row?.status) === 'trial' && !hasMeaningfulSubscriptionPlan(row?.plan)))
  },
  users: {
    table: 'profiles',
    orderBy: 'created_at',
    select: 'id,name:full_name,phone,role,requestedRole:requested_role,createdAt:created_at,accountStatus:account_status',
    createEnabled: false,
    toRows: rows =>
      (rows || []).map(row => ({
        ...row,
        name: normalizeString(row.name) || 'User',
        phone: normalizeString(row.phone) || '-',
        role: normalizeString(row.role) || 'tenant',
        requestedRole: normalizeString(row.requestedRole) || '-',
        createdAt: toISODateTimeLocal(row.createdAt)
      })).filter(row => normalizeString(row.accountStatus) !== 'deactivated')
  },
  admin: {
    table: 'admin_audit_logs',
    orderBy: 'created_at',
    select: 'entity,action,owner:owner_name,timestamp:event_time,status',
    createEnabled: false,
    toRows: rows =>
      (rows || []).map(row => ({
        ...row,
        timestamp: toISODateTimeLocal(row.timestamp)
      }))
  }
}

const nonCreatableForTenant = new Set([
  'properties',
  'units',
  'tenants',
  'tenancies',
  'marketplace',
  'payments',
  'invoices',
  'reports',
  'subscriptions',
  'landlordLeads',
  'onboardingPipeline',
  'fees',
  'users',
  'admin'
])

const nonCreatableForAgent = new Set([
  'reports',
  'subscriptions',
  'landlordLeads',
  'onboardingPipeline',
  'fees',
  'users',
  'admin'
])

export const canCreateModuleForRole = (moduleKey, role) => {
  if (!isModuleCreatable(moduleKey)) {
    return false
  }

  if (role === USER_ROLES.TENANT) {
    return !nonCreatableForTenant.has(moduleKey)
  }

  if (role === USER_ROLES.AGENT) {
    return !nonCreatableForAgent.has(moduleKey)
  }

  return true
}

export const getModuleDefinition = moduleKey => moduleDefinitions[moduleKey] ?? null

export const getModuleCreateFields = moduleKey => createFieldsByModule[moduleKey] ?? []

export const getModuleFallback = moduleKey => modulePages[moduleKey] ?? null

export const isModuleCreatable = moduleKey => moduleDefinitions[moduleKey]?.createEnabled !== false
