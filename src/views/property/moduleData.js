export const modulePages = {
  properties: {
    title: 'Plots & Estates',
    description: 'Register estates, generate plot IDs, and monitor occupancy by location.',
    primaryActionLabel: 'Register Plot',
    secondaryActionLabel: 'Import Estates',
    stats: [
      { label: 'Registered Plots', value: '42', hint: '+3 new this month' },
      { label: 'Total Units', value: '368', hint: 'Across all plots' },
      { label: 'Occupied Units', value: '291', hint: '79% occupancy rate' },
      { label: 'Vacant Units', value: '77', hint: 'Ready for booking' }
    ],
    columns: [
      { key: 'plotId', label: 'Plot ID' },
      { key: 'name', label: 'Estate Name' },
      { key: 'location', label: 'Location' },
      { key: 'manager', label: 'Manager' },
      { key: 'availabilityStatus', label: 'Availability' }
    ],
    rows: [
      {
        plotId: 'PLT-0012',
        name: 'Kilimani Heights',
        location: 'Nairobi, Kilimani',
        manager: 'Main Landlord',
        availabilityStatus: 'occupied'
      },
      {
        plotId: 'PLT-0018',
        name: 'Sunrise Court',
        location: 'Nairobi, South B',
        manager: 'Grace W.',
        availabilityStatus: 'vacant'
      },
      {
        plotId: 'PLT-0021',
        name: 'Westwood Plaza',
        location: 'Nairobi, Westlands',
        manager: 'Peter K.',
        availabilityStatus: 'occupied'
      }
    ]
  },
  units: {
    title: 'Houses & Units',
    description: 'Manage unit categories, house numbers, rent prices, and occupancy state.',
    primaryActionLabel: 'Add Unit',
    secondaryActionLabel: 'Bulk Upload',
    stats: [
      { label: 'Bedsitters', value: '136', hint: '37% of all units' },
      { label: '1 Bedroom', value: '124', hint: 'Most demanded type' },
      { label: '2 Bedroom', value: '82', hint: 'Family segment' },
      { label: 'Shops/Offices', value: '26', hint: 'Commercial units' }
    ],
    columns: [
      { key: 'unitId', label: 'Unit ID' },
      { key: 'plotId', label: 'Plot ID' },
      { key: 'category', label: 'Category' },
      { key: 'rent', label: 'Rent (KES)' },
      { key: 'status', label: 'Status' }
    ],
    rows: [
      { unitId: 'UNT-0931', plotId: 'PLT-0012', category: '1BR', rent: '28,000', status: 'occupied' },
      { unitId: 'UNT-0940', plotId: 'PLT-0012', category: 'Bedsitter', rent: '16,000', status: 'vacant' },
      { unitId: 'UNT-0986', plotId: 'PLT-0018', category: 'Shop', rent: '35,000', status: 'occupied' }
    ]
  },
  tenants: {
    title: 'Tenants',
    description: 'Capture tenant profiles, KYC details, and payment reliability segments.',
    primaryActionLabel: 'Add Tenant',
    secondaryActionLabel: 'Download List',
    stats: [
      { label: 'Active Tenants', value: '291', hint: 'Current occupants' },
      { label: 'Move-outs This Month', value: '12', hint: 'Churn indicator' },
      { label: 'Late Payment Accounts', value: '41', hint: 'Needs follow-up' },
      { label: 'Verified IDs', value: '276', hint: '95% compliance' }
    ],
    columns: [
      { key: 'tenant', label: 'Tenant' },
      { key: 'phone', label: 'Phone' },
      { key: 'occupation', label: 'Occupation' },
      { key: 'unit', label: 'Unit' },
      { key: 'paymentStatus', label: 'Payment Status' }
    ],
    rows: [
      {
        tenant: 'Ann Wanjiru',
        phone: '+254 712 111 420',
        occupation: 'Teacher',
        unit: 'UNT-0931',
        paymentStatus: 'paid'
      },
      {
        tenant: 'David Mwangi',
        phone: '+254 722 901 110',
        occupation: 'Engineer',
        unit: 'UNT-0928',
        paymentStatus: 'partial'
      },
      {
        tenant: 'Mercy Akinyi',
        phone: '+254 734 221 002',
        occupation: 'Trader',
        unit: 'UNT-0940',
        paymentStatus: 'arrears'
      }
    ]
  },
  tenancies: {
    title: 'Tenant-House Mapping',
    description: 'Track tenancy agreements, move-in dates, and move-out workflows per unit.',
    primaryActionLabel: 'Create Mapping',
    secondaryActionLabel: 'Export Agreements',
    stats: [
      { label: 'Active Tenancies', value: '291', hint: 'Linked to units' },
      { label: 'Agreements Uploaded', value: '267', hint: 'Digital storage' },
      { label: 'Move-outs Scheduled', value: '18', hint: 'Upcoming this quarter' },
      { label: 'Relocation Requests', value: '7', hint: 'Internal transfers' }
    ],
    columns: [
      { key: 'agreementId', label: 'Agreement ID' },
      { key: 'tenant', label: 'Tenant' },
      { key: 'unit', label: 'Unit ID' },
      { key: 'moveIn', label: 'Move-In Date' },
      { key: 'status', label: 'Status' }
    ],
    rows: [
      { agreementId: 'AGR-7701', tenant: 'Ann Wanjiru', unit: 'UNT-0931', moveIn: '2025-10-01', status: 'active' },
      {
        agreementId: 'AGR-7728',
        tenant: 'David Mwangi',
        unit: 'UNT-0928',
        moveIn: '2025-12-15',
        status: 'pending'
      },
      {
        agreementId: 'AGR-7754',
        tenant: 'Mercy Akinyi',
        unit: 'UNT-0940',
        moveIn: '2024-08-01',
        status: 'move-out scheduled'
      }
    ]
  },
  marketplace: {
    title: 'House Search & Booking',
    description: 'Manage tenant search demand, viewing appointments, and booking conversion funnel.',
    primaryActionLabel: 'Add Listing',
    secondaryActionLabel: 'Export Leads',
    stats: [
      { label: 'Live Listings', value: '77', hint: 'Vacant units in market' },
      { label: 'Viewing Requests', value: '54', hint: 'This week' },
      { label: 'Bookings Pending', value: '19', hint: 'Awaiting deposit' },
      { label: 'Booking Fees Collected', value: 'KES 86K', hint: 'Month-to-date' }
    ],
    columns: [
      { key: 'listing', label: 'Listing' },
      { key: 'location', label: 'Location' },
      { key: 'price', label: 'Price (KES)' },
      { key: 'category', label: 'Category' },
      { key: 'stage', label: 'Booking Stage' }
    ],
    rows: [
      {
        listing: 'UNT-0940 / Sunrise Court',
        location: 'South B',
        price: '16,000',
        category: 'Bedsitter',
        stage: 'open'
      },
      {
        listing: 'UNT-0982 / Westwood Plaza',
        location: 'Westlands',
        price: '45,000',
        category: '2BR',
        stage: 'scheduled'
      },
      {
        listing: 'UNT-0970 / Kilimani Heights',
        location: 'Kilimani',
        price: '30,000',
        category: '1BR',
        stage: 'pending'
      }
    ]
  },
  payments: {
    title: 'Rent Payments',
    description: 'Track collections from M-Pesa, paybill, till, and online bank integrations.',
    primaryActionLabel: 'Record Payment',
    secondaryActionLabel: 'Download Statement',
    stats: [
      { label: 'Collected This Month', value: 'KES 4.9M', hint: '86% target attainment' },
      { label: 'Pending Balance', value: 'KES 780K', hint: 'Due this month' },
      { label: 'Arrears Balance', value: 'KES 1.2M', hint: 'Aged >30 days' },
      { label: 'Deposits Held', value: 'KES 7.6M', hint: 'Security deposits' }
    ],
    columns: [
      { key: 'receiptNo', label: 'Receipt No' },
      { key: 'tenant', label: 'Tenant' },
      { key: 'channel', label: 'Channel' },
      { key: 'amount', label: 'Amount (KES)' },
      { key: 'status', label: 'Status' }
    ],
    rows: [
      {
        receiptNo: 'RCP-61120',
        tenant: 'Ann Wanjiru',
        channel: 'M-Pesa STK',
        amount: '28,000',
        status: 'paid'
      },
      {
        receiptNo: 'RCP-61133',
        tenant: 'David Mwangi',
        channel: 'Paybill',
        amount: '20,000',
        status: 'partial'
      },
      {
        receiptNo: 'RCP-61144',
        tenant: 'Mercy Akinyi',
        channel: 'Bank Transfer',
        amount: '0',
        status: 'arrears'
      }
    ]
  },
  paymentsMonitoring: {
    title: 'Payments Monitoring',
    description: 'Monitor platform payment flow, provider references, pending transactions, and failed settlements.',
    primaryActionLabel: 'Refresh Monitoring',
    secondaryActionLabel: 'Export Monitoring',
    stats: [
      { label: 'Processed Volume', value: 'KES 0', hint: 'Paid and partial transactions' },
      { label: 'Pending Queue', value: '0', hint: 'Transactions awaiting callback or review' },
      { label: 'Failed/Arrears', value: '0', hint: 'Requires follow-up and reconciliation' },
      { label: 'Live Payment Records', value: '0', hint: 'Rows visible in monitoring scope' }
    ],
    columns: [
      { key: 'createdAt', label: 'Created At' },
      { key: 'owner', label: 'Owner' },
      { key: 'receiptNo', label: 'Receipt No' },
      { key: 'tenant', label: 'Tenant' },
      { key: 'channel', label: 'Channel' },
      { key: 'amount', label: 'Amount (KES)' },
      { key: 'status', label: 'Status' },
      { key: 'transactionRef', label: 'Transaction Ref' },
      { key: 'checkoutRef', label: 'Checkout Ref' },
      { key: 'invoiceId', label: 'Invoice ID' }
    ],
    rows: [
      {
        createdAt: '2026-03-03 10:21',
        owner: 'Owner 1de1771a',
        receiptNo: 'RCP-61120',
        tenant: 'Ann Wanjiru',
        channel: 'M-Pesa STK',
        amount: '28,000',
        status: 'pending',
        transactionRef: 'ws_CO_12345',
        checkoutRef: 'ws_CH_12345',
        invoiceId: 'INV-2026-0201'
      }
    ]
  },
  invoices: {
    title: 'Invoices & Digital Receipts',
    description: 'Generate monthly invoices, send reminders, and store downloadable receipts.',
    primaryActionLabel: 'Generate Invoices',
    secondaryActionLabel: 'Bulk Send',
    stats: [
      { label: 'Invoices This Month', value: '312', hint: 'Auto-generated batch' },
      { label: 'Paid Invoices', value: '233', hint: '74.7% paid' },
      { label: 'Overdue Invoices', value: '59', hint: 'Need reminders' },
      { label: 'Receipts Issued', value: '241', hint: 'Digital receipts' }
    ],
    columns: [
      { key: 'invoiceNo', label: 'Invoice No' },
      { key: 'tenant', label: 'Tenant' },
      { key: 'period', label: 'Billing Period' },
      { key: 'dueAmount', label: 'Due Amount (KES)' },
      { key: 'status', label: 'Status' }
    ],
    rows: [
      {
        invoiceNo: 'INV-2026-0201',
        tenant: 'Ann Wanjiru',
        period: 'Feb 2026',
        dueAmount: '28,000',
        status: 'paid'
      },
      {
        invoiceNo: 'INV-2026-0207',
        tenant: 'David Mwangi',
        period: 'Feb 2026',
        dueAmount: '28,000',
        status: 'partial'
      },
      {
        invoiceNo: 'INV-2026-0219',
        tenant: 'Mercy Akinyi',
        period: 'Feb 2026',
        dueAmount: '16,000',
        status: 'overdue'
      }
    ]
  },
  maintenance: {
    title: 'Maintenance & Issue Tracking',
    description: 'Track issue tickets from tenants and assign caretakers or contractors.',
    primaryActionLabel: 'Create Ticket',
    secondaryActionLabel: 'Export Tickets',
    stats: [
      { label: 'Open Requests', value: '36', hint: 'Awaiting assignment' },
      { label: 'In Progress', value: '22', hint: 'Being handled' },
      { label: 'Completed', value: '149', hint: 'Closed this quarter' },
      { label: 'Avg Resolution', value: '2.8 days', hint: 'Service SLA metric' }
    ],
    columns: [
      { key: 'ticket', label: 'Ticket' },
      { key: 'unit', label: 'Unit ID' },
      { key: 'issueType', label: 'Issue Type' },
      { key: 'assignee', label: 'Assigned To' },
      { key: 'status', label: 'Status' }
    ],
    rows: [
      {
        ticket: 'MT-1142',
        unit: 'UNT-0931',
        issueType: 'Plumbing leak',
        assignee: 'Caretaker - Kevin',
        status: 'in progress'
      },
      {
        ticket: 'MT-1149',
        unit: 'UNT-0940',
        issueType: 'Power outage',
        assignee: 'Contractor - SparkFix',
        status: 'pending'
      },
      {
        ticket: 'MT-1160',
        unit: 'UNT-0921',
        issueType: 'Door lock replacement',
        assignee: 'Caretaker - Stella',
        status: 'completed'
      }
    ]
  },
  messaging: {
    title: 'Communication & Messaging',
    description: 'Broadcast announcements and track landlord-tenant in-app communication.',
    primaryActionLabel: 'New Broadcast',
    secondaryActionLabel: 'Export Chat Logs',
    stats: [
      { label: 'Unread Messages', value: '18', hint: 'Require attention' },
      { label: 'Announcements Sent', value: '11', hint: 'This month' },
      { label: 'WhatsApp Campaigns', value: '4', hint: 'Bulk sends' },
      { label: 'SMS Delivery Rate', value: '98.4%', hint: 'Reminder reliability' }
    ],
    columns: [
      { key: 'thread', label: 'Thread' },
      { key: 'audience', label: 'Audience' },
      { key: 'channel', label: 'Channel' },
      { key: 'lastUpdate', label: 'Last Update' },
      { key: 'status', label: 'Status' }
    ],
    rows: [
      {
        thread: 'Water outage notice',
        audience: 'All tenants - PLT-0012',
        channel: 'In-app + SMS',
        lastUpdate: '2026-02-17 08:20',
        status: 'completed'
      },
      {
        thread: 'Rent reminder cycle',
        audience: 'Arrears segment',
        channel: 'SMS + WhatsApp',
        lastUpdate: '2026-02-18 09:05',
        status: 'in progress'
      },
      {
        thread: 'Welcome new tenants',
        audience: 'Move-ins this week',
        channel: 'In-app',
        lastUpdate: '2026-02-18 18:12',
        status: 'scheduled'
      }
    ]
  },
  documents: {
    title: 'Document Management',
    description: 'Store agreements, ownership docs, invoices, receipts, and maintenance records.',
    primaryActionLabel: 'Upload Document',
    secondaryActionLabel: 'Archive Export',
    stats: [
      { label: 'Agreements Stored', value: '267', hint: 'Signed tenancy files' },
      { label: 'Ownership Docs', value: '42', hint: 'Per registered plot' },
      { label: 'Receipts Stored', value: '1,908', hint: 'Searchable history' },
      { label: 'Storage Used', value: '18.7 GB', hint: 'Supabase storage target' }
    ],
    columns: [
      { key: 'docId', label: 'Document ID' },
      { key: 'type', label: 'Type' },
      { key: 'owner', label: 'Owner' },
      { key: 'filePath', label: 'File' },
      { key: 'uploaded', label: 'Uploaded On' },
      { key: 'status', label: 'Status' }
    ],
    rows: [
      {
        docId: 'DOC-4451',
        type: 'Tenancy Agreement',
        owner: 'Ann Wanjiru',
        filePath: 'ann-wanjiru-agreement.pdf',
        uploaded: '2026-02-01',
        status: 'active'
      },
      {
        docId: 'DOC-4478',
        type: 'Ownership Certificate',
        owner: 'Westwood Plaza',
        filePath: 'westwood-ownership-certificate.pdf',
        uploaded: '2026-01-15',
        status: 'active'
      },
      {
        docId: 'DOC-4493',
        type: 'Maintenance Report',
        owner: 'UNT-0931',
        filePath: 'unt-0931-maintenance-report.pdf',
        uploaded: '2026-02-14',
        status: 'pending review'
      }
    ]
  },
  reports: {
    title: 'Reports & Analytics',
    description: 'Review collection trends, vacancy analytics, tenant payment behavior, and usage.',
    primaryActionLabel: 'Generate Report',
    secondaryActionLabel: 'Download Excel/PDF',
    stats: [
      { label: 'Monthly Revenue', value: 'KES 5.7M', hint: '+8.4% vs last month' },
      { label: 'Collection Rate', value: '86%', hint: 'Paid vs invoiced' },
      { label: 'Vacancy Trend', value: '21%', hint: '-2 points this quarter' },
      { label: 'Arrears Accounts', value: '41', hint: 'High-risk tenant segment' }
    ],
    columns: [
      { key: 'report', label: 'Report' },
      { key: 'scope', label: 'Scope' },
      { key: 'generatedBy', label: 'Generated By' },
      { key: 'updated', label: 'Last Updated' },
      { key: 'status', label: 'Status' }
    ],
    rows: [
      {
        report: 'Rent Collection Summary',
        scope: 'All plots',
        generatedBy: 'System Auto Job',
        updated: '2026-02-18 23:59',
        status: 'completed'
      },
      {
        report: 'Arrears Aging Analysis',
        scope: 'Tenant segment >30 days',
        generatedBy: 'Finance Admin',
        updated: '2026-02-18 11:43',
        status: 'completed'
      },
      {
        report: 'Vacancy Forecast',
        scope: 'Next 90 days',
        generatedBy: 'Portfolio Manager',
        updated: '2026-02-17 16:09',
        status: 'scheduled'
      }
    ]
  },
  landlordLeads: {
    title: 'Landlord Leads',
    description: 'Track inbound landlord prospects, qualification stage, and conversion readiness.',
    primaryActionLabel: 'Review Leads',
    secondaryActionLabel: 'Export Leads',
    stats: [
      { label: 'New Leads', value: '0', hint: 'Recent landlord prospect signups' },
      { label: 'Qualified Leads', value: '0', hint: 'Ready for onboarding call' },
      { label: 'Converted Landlords', value: '0', hint: 'Lead to active landlord profile' },
      { label: 'Response Queue', value: '0', hint: 'Leads waiting follow-up' }
    ],
    columns: [
      { key: 'leadId', label: 'Lead ID' },
      { key: 'leadName', label: 'Lead Name' },
      { key: 'phone', label: 'Phone' },
      { key: 'stage', label: 'Stage' },
      { key: 'source', label: 'Source' },
      { key: 'createdAt', label: 'Created At' }
    ],
    rows: [
      {
        leadId: 'LD-001',
        leadName: 'Westlands Estates Ltd',
        phone: '+254700123456',
        stage: 'qualified',
        source: 'Landing page signup',
        createdAt: '2026-03-01 11:20'
      }
    ]
  },
  onboardingPipeline: {
    title: 'Onboarding Pipeline',
    description: 'Move verified landlords from signup to trial and paid activation with clear next actions.',
    primaryActionLabel: 'Review Pipeline',
    secondaryActionLabel: 'Export Pipeline',
    stats: [
      { label: 'Setup Pending', value: '0', hint: 'Need KYC/setup completion' },
      { label: 'Trial Accounts', value: '0', hint: 'Currently evaluating platform' },
      { label: 'Activated Accounts', value: '0', hint: 'Converted to active subscription' },
      { label: 'Blocked Accounts', value: '0', hint: 'Need manual intervention' }
    ],
    columns: [
      { key: 'landlord', label: 'Landlord' },
      { key: 'stage', label: 'Pipeline Stage' },
      { key: 'plan', label: 'Plan' },
      { key: 'status', label: 'Status' },
      { key: 'nextAction', label: 'Next Action' },
      { key: 'updatedAt', label: 'Last Updated' }
    ],
    rows: [
      {
        landlord: 'Owner 1de1771a',
        stage: 'trial',
        plan: 'Growth',
        status: 'trial',
        nextAction: 'Activate paid subscription',
        updatedAt: '2026-03-02 09:10'
      }
    ]
  },
  subscriptions: {
    title: 'Subscriptions & Plans',
    description: 'Review landlord billing status, active plans, and subscription lifecycle updates.',
    primaryActionLabel: 'Review Subscriptions',
    secondaryActionLabel: 'Export Billing List',
    stats: [
      { label: 'Active Subscriptions', value: '0', hint: 'Currently billable landlord accounts' },
      { label: 'Trial Accounts', value: '0', hint: 'Landlords in trial period' },
      { label: 'Expired Accounts', value: '0', hint: 'Need renewal follow-up' },
      { label: 'Plan Changes', value: '0', hint: 'Recent plan upgrade/downgrade actions' }
    ],
    columns: [
      { key: 'subscriptionId', label: 'Subscription ID' },
      { key: 'owner', label: 'Landlord' },
      { key: 'plan', label: 'Plan' },
      { key: 'status', label: 'Status' },
      { key: 'period', label: 'Billing Period' },
      { key: 'updatedAt', label: 'Last Updated' }
    ],
    rows: [
      {
        subscriptionId: 'SUB-001',
        owner: 'Owner 1de1771a',
        plan: 'Growth',
        status: 'active',
        period: '2026-03-01 → 2026-03-31',
        updatedAt: '2026-03-01 10:00'
      }
    ]
  },
  fees: {
    title: 'Fees & Commissions',
    description: 'Configure and monitor platform transaction fees, commission rules, and policy status.',
    primaryActionLabel: 'Review Fee Rules',
    secondaryActionLabel: 'Export Fee Rules',
    stats: [
      { label: 'Active Rules', value: '0', hint: 'Currently enforced fee rules' },
      { label: 'Commission Rules', value: '0', hint: 'Percentage based commission policies' },
      { label: 'Flat Fee Rules', value: '0', hint: 'Fixed amount billing policies' },
      { label: 'Updated This Month', value: '0', hint: 'Rule revisions this month' }
    ],
    columns: [
      { key: 'rule', label: 'Rule' },
      { key: 'scope', label: 'Scope' },
      { key: 'rate', label: 'Rate' },
      { key: 'status', label: 'Status' },
      { key: 'updatedAt', label: 'Last Updated' }
    ],
    rows: [
      {
        rule: 'MPesa Collection Fee',
        scope: 'Rent Payments',
        rate: '1.5%',
        status: 'active',
        updatedAt: '2026-03-01 09:30'
      }
    ]
  },
  users: {
    title: 'User Management',
    description: 'Review platform users, role requests, and profile completeness across admin, landlord, agent, and tenant accounts.',
    primaryActionLabel: 'Review Users',
    secondaryActionLabel: 'Export Users',
    stats: [
      { label: 'Total Users', value: '0', hint: 'All roles in one directory' },
      { label: 'Role Requests', value: '0', hint: 'Pending requested role updates' },
      { label: 'Landlords', value: '0', hint: 'Profiles with landlord role' },
      { label: 'Tenants', value: '0', hint: 'Profiles with tenant role' }
    ],
    columns: [
      { key: 'name', label: 'Name' },
      { key: 'phone', label: 'Phone' },
      { key: 'role', label: 'Role' },
      { key: 'requestedRole', label: 'Requested Role' },
      { key: 'createdAt', label: 'Created On' }
    ],
    rows: [
      {
        name: 'Sample User',
        phone: '+254700000000',
        role: 'tenant',
        requestedRole: 'landlord',
        createdAt: '2026-03-01 12:00'
      }
    ]
  },
  admin: {
    title: 'System Admin Console',
    description: 'Manage subscriptions, user verification, fees, audit trails, and platform controls.',
    primaryActionLabel: 'Review Audit Logs',
    secondaryActionLabel: 'Export Audit Logs',
    stats: [
      { label: 'Verified Landlords', value: '84', hint: 'Platform-approved accounts' },
      { label: 'Active Subscriptions', value: '73', hint: 'Paying organizations' },
      { label: 'Suspended Accounts', value: '6', hint: 'Compliance actions' },
      { label: 'Audit Events (24h)', value: '1,284', hint: 'Security tracking' }
    ],
    columns: [
      { key: 'entity', label: 'Entity' },
      { key: 'action', label: 'Action' },
      { key: 'owner', label: 'Owner' },
      { key: 'timestamp', label: 'Timestamp' },
      { key: 'status', label: 'Status' }
    ],
    rows: [
      {
        entity: 'Landlord #LD-098',
        action: 'KYC Verification',
        owner: 'Compliance Team',
        timestamp: '2026-02-18 14:21',
        status: 'completed'
      },
      {
        entity: 'Subscription #SUB-441',
        action: 'Plan Upgrade',
        owner: 'Billing Admin',
        timestamp: '2026-02-18 10:03',
        status: 'completed'
      },
      {
        entity: 'User #USR-8841',
        action: 'Suspension Review',
        owner: 'Risk Team',
        timestamp: '2026-02-19 08:44',
        status: 'pending'
      }
    ]
  }
}
