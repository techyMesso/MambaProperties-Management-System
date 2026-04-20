export const navGroups = {
  Features: [
    {
      title: 'Payments & Finance',
      links: [
        { label: 'MPesa Rent Collection', href: '/register' },
        { label: 'Arrears Tracking', href: '/register' },
        { label: 'Owner Statements', href: '/register' }
      ]
    },
    {
      title: 'Operations',
      links: [
        { label: 'Maintenance Work Orders', href: '/register' },
        { label: 'Occupancy Monitoring', href: '/register' },
        { label: 'Unit Inspections', href: '/register' }
      ]
    },
    {
      title: 'Growth Tools',
      links: [
        { label: 'Vacancy Listings', href: '/register' },
        { label: 'Tenant Onboarding', href: '/register' },
        { label: 'Portfolio Reports', href: '/register' }
      ]
    }
  ],
  'Use Cases': [
    {
      title: 'By Team',
      links: [
        { label: 'Landlords & Estate Owners', href: '/register' },
        { label: 'Property Managers', href: '/register' },
        { label: 'Agents & Caretakers', href: '/register' }
      ]
    },
    {
      title: 'By User',
      links: [
        { label: 'Tenant Experience', href: '/register' },
        { label: 'Service Providers', href: '/register' },
        { label: 'Multi-estate Teams', href: '/register' }
      ]
    }
  ],
  Resources: [
    {
      title: 'Knowledge',
      links: [
        { label: 'Help Center', href: '/under-maintenance' },
        { label: 'Landlord Guides', href: '/under-maintenance' },
        { label: 'Blog', href: '/under-maintenance' }
      ]
    },
    {
      title: 'Company',
      links: [
        { label: 'Roadmap', href: '/under-maintenance' },
        { label: 'Contact Sales', href: '/under-maintenance' },
        { label: 'Partner Program', href: '/under-maintenance' }
      ]
    }
  ]
}

export const hero = {
  badge: 'Rental & Estate Management Platform',
  title: 'Collect rent on time and run every estate from one MPesa-ready dashboard.',
  description:
    'Mambaproperties helps landlords and managers automate rent collection, monitor occupancy, resolve maintenance quickly, and keep owners informed with live portfolio insights.',
  primaryCta: { label: 'Get started', href: '/register' },
  secondaryCta: { label: 'Book a demo', href: '/under-maintenance' },
  trustChips: ['14-day free trial', 'No card required', 'MPesa-ready']
}

export const ratings = [
  { platform: 'Capterra-style', score: '4.8 / 5' },
  { platform: 'G2-style', score: '4.7 / 5' },
  { platform: 'GetApp-style', score: '4.9 / 5' },
  { platform: 'Advisor-style', score: '4.8 / 5' }
]

export const features = [
  {
    id: 'finance',
    icon: 'KES',
    title: 'Accounting & Rent Collection',
    subtitle: 'Keep every payment cycle clear, automated, and traceable.',
    bullets: [
      'Collect via MPesa links, bank transfer references, or manual receipt logging.',
      'Auto-generate monthly invoices and late payment reminders over SMS and WhatsApp.',
      'Track arrears aging per unit and export owner-ready statements.'
    ],
    learnHref: '/payments',
    visual: {
      label: 'Collections Snapshot',
      kpis: ['KES 3.42M Collected', '89% On-time Rate', '41 Active Payment Plans']
    }
  },
  {
    id: 'screening',
    icon: 'ID',
    title: 'Tenant Screening & Onboarding',
    subtitle: 'Reduce vacancy risk with structured intake and approval workflows.',
    bullets: [
      'Capture applicant details, references, and required documents in one flow.',
      'Standardize approvals with role-based checks for agents and managers.',
      'Move approved applicants straight into lease and billing setup.'
    ],
    learnHref: '/tenants',
    visual: {
      label: 'Onboarding Pipeline',
      kpis: ['112 Applicants', '37 Under Review', '22 Approved This Month']
    }
  },
  {
    id: 'listings',
    icon: 'ADS',
    title: 'Listings & Vacancy Management',
    subtitle: 'Fill empty units faster with a cleaner lead-to-viewing workflow.',
    bullets: [
      'Publish unit listings with rent, amenities, and availability dates.',
      'Track inquiries by source and schedule viewings from one calendar.',
      'Monitor days-vacant trends across properties and neighborhoods.'
    ],
    learnHref: '/properties',
    visual: {
      label: 'Vacancy Board',
      kpis: ['63 Listed Units', '146 New Leads', '18 Viewings This Week']
    }
  },
  {
    id: 'maintenance',
    icon: 'FIX',
    title: 'Maintenance & Work Orders',
    subtitle: 'Handle repairs from tenant report to contractor completion.',
    bullets: [
      'Let tenants submit issues with photos from mobile.',
      'Assign vendors or caretakers, then track SLA and resolution time.',
      'Capture labor and material costs for owner reporting and budgeting.'
    ],
    learnHref: '/maintenance',
    visual: {
      label: 'Work Order Flow',
      kpis: ['54 Open Tickets', '72% Resolved < 48h', 'KES 418K Maintenance Spend']
    }
  }
]

export const integrations = ['M-Pesa', 'Airtel Money', 'WhatsApp Business', 'QuickBooks', 'Google Calendar', 'SMS Gateway']

export const benefits = [
  {
    icon: 'APP',
    title: 'Mobile-first operations',
    description: 'Handle rent follow-ups, approvals, and issue tracking from phone or desktop.'
  },
  {
    icon: 'OWN',
    title: 'Owner reporting in one click',
    description: 'Generate owner statements, cashflow snapshots, and occupancy updates in seconds.'
  },
  {
    icon: 'ROLE',
    title: 'Role-based team access',
    description: 'Set clear permissions for admins, managers, agents, and caretakers.'
  },
  {
    icon: 'MSG',
    title: 'Automated communication',
    description: 'Send reminders, receipts, and work-order updates via SMS, email, or WhatsApp.'
  },
  {
    icon: 'DATA',
    title: 'Portfolio health dashboard',
    description: 'Track occupancy, arrears, and maintenance trends across all properties in real time.'
  },
  {
    icon: 'SUP',
    title: 'Guided onboarding support',
    description: 'Launch faster with migration guidance and local support from day one.'
  }
]

export const testimonials = [
  {
    quote:
      'Before Mambaproperties, our team spent days reconciling rent. Now MPesa collections and arrears follow-up happen in one workflow.',
    name: 'Mary N.',
    role: 'Landlord',
    location: 'Mombasa',
    source: 'Verified customer'
  },
  {
    quote:
      'We manage multiple compounds in Nairobi. The occupancy and maintenance dashboards help us spot issues before owners escalate.',
    name: 'Peter K.',
    role: 'Property Manager',
    location: 'Nairobi',
    source: 'Verified customer'
  },
  {
    quote:
      'Our caretakers now close work orders from their phones and tenants receive updates instantly. Service quality has improved significantly.',
    name: 'Aisha W.',
    role: 'Estate Operations Lead',
    location: 'Kisumu',
    source: 'Verified customer'
  }
]

export const personas = [
  {
    title: 'Landlords & Estate Owners',
    frontText: 'Track rent health, occupancy, and owner returns across every property.',
    backText: 'View income, arrears, and vacancy trends portfolio-wide without chasing spreadsheets.'
  },
  {
    title: 'Property Managers',
    frontText: 'Run teams, tenants, and vendors from one operations command center.',
    backText: 'Assign work, approve requests, and share real-time updates with owners and landlords.'
  },
  {
    title: 'Agents & Caretakers',
    frontText: 'Handle viewings, move-ins, and field issues faster from mobile.',
    backText: 'Capture inquiries, complete inspections, and close tickets without office handovers.'
  },
  {
    title: 'Tenants',
    frontText: 'Pay rent, download receipts, and report issues in minutes.',
    backText: 'Follow payment status, maintenance progress, and notices in one self-service portal.'
  },
  {
    title: 'Service Providers',
    frontText: 'Receive clear jobs, timelines, and approvals before work starts.',
    backText: 'Share progress, upload proof of work, and close tasks with tracked turnaround times.'
  }
]

export const faqs = [
  {
    question: 'What is rental management software in the Kenyan context?',
    answer:
      'It is a platform that helps landlords and managers run rent collection, occupancy tracking, maintenance, and tenant communication from one system, including MPesa-friendly workflows.'
  },
  {
    question: 'Why use Mambaproperties instead of spreadsheets?',
    answer:
      'Spreadsheets break as portfolios grow. Mambaproperties centralizes payments, reminders, arrears, and reports so teams can act faster with fewer errors.'
  },
  {
    question: 'Who can use Mambaproperties?',
    answer:
      'Landlords, estate owners, property managers, agents, caretakers, tenants, and approved service providers can each use role-specific workflows.'
  },
  {
    question: 'How do MPesa rent payments work?',
    answer:
      'You can send payment prompts or references to tenants, track incoming transactions, reconcile balances, and issue receipts from the platform.'
  },
  {
    question: 'How is data kept secure?',
    answer:
      'The system uses authenticated access, role permissions, encrypted transport, and audit-aware workflows to protect tenant and financial data.'
  },
  {
    question: 'What support and onboarding are available?',
    answer:
      'Teams receive setup guidance, account configuration help, and ongoing support for operations, reporting, and user onboarding.'
  },
  {
    question: 'Can I manage multiple estates and caretakers?',
    answer:
      'Yes. You can organize properties by estate, assign caretakers by location, and monitor performance across all sites from one dashboard.'
  },
  {
    question: 'Do tenants receive reminders and receipts automatically?',
    answer:
      'Yes. You can automate reminders, send payment confirmations, and keep tenants updated on work-order progress.'
  }
]

export const footer = {
  product: [
    { label: 'Features', href: '/register' },
    { label: 'Pricing', href: '/pricing' },
    { label: 'Integrations', href: '/register' },
    { label: 'Roadmap', href: '/under-maintenance' }
  ],
  company: [
    { label: 'About', href: '/under-maintenance' },
    { label: 'Blog', href: '/under-maintenance' },
    { label: 'Careers', href: '/under-maintenance' },
    { label: 'Partners', href: '/under-maintenance' }
  ],
  resources: [
    { label: 'Help Center', href: '/under-maintenance' },
    { label: 'Landlord Guides', href: '/under-maintenance' },
    { label: 'API Docs', href: '/under-maintenance' },
    { label: 'Contact', href: '/under-maintenance' }
  ],
  legal: [
    { label: 'Terms', href: '/under-maintenance' },
    { label: 'Privacy', href: '/under-maintenance' },
    { label: 'Cookies', href: '/under-maintenance' },
    { label: 'Data Policy', href: '/under-maintenance' }
  ]
}
