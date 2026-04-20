'use client'

import { useEffect, useMemo, useState } from 'react'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'

import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Chip from '@mui/material/Chip'
import CircularProgress from '@mui/material/CircularProgress'
import Container from '@mui/material/Container'
import Grid from '@mui/material/Grid'
import Stack from '@mui/material/Stack'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'

import ModeDropdown from '@components/layout/shared/ModeDropdown'

import styles from './Pricing.module.css'

const formatKES = value => {
  const amount = Number(value || 0)

  if (!Number.isFinite(amount)) {
    return 'KES 0'
  }

  return `KES ${amount.toLocaleString('en-KE')}`
}

const findPlan = (catalog, key) =>
  (catalog || []).find(plan => plan?.planCode === key || plan?.featureKey === key) || null

const normalizeRoleLike = value =>
  String(value || '')
    .trim()
    .toLowerCase()

const normalizeAudience = value => {
  const normalized = String(value || '')
    .trim()
    .toLowerCase()

  if (normalized === 'landlord' || normalized === 'agent' || normalized === 'landlord_agent') {
    return 'landlord'
  }

  if (normalized === 'tenant') {
    return 'tenant'
  }

  return 'all'
}

const heroPreviewStats = ['KES 3.42M Collected', '89% On-time Rate', '41 Active Payment Plans']

const heroPreviewCards = [
  {
    title: 'Runda Royale',
    meta: '2560 · 1152',
    badge: 'Live listing',
    imageClass: 'heroPreviewImageOne'
  },
  {
    title: 'Kilimani Suites',
    meta: '2 viewings today',
    badge: 'Interior ready',
    imageClass: 'heroPreviewImageTwo'
  }
]

const Pricing = ({ pricingCatalog = [], viewerProfile = null }) => {
  const router = useRouter()
  const searchParams = useSearchParams()
  const isVerified = searchParams?.get('verified') === '1'

  const audience = normalizeAudience(searchParams?.get('audience'))

  const requestedRole = String(searchParams?.get('role') || '')
    .trim()
    .toLowerCase()

  const recommendedPlan = String(searchParams?.get('recommended') || '')
    .trim()
    .toLowerCase()

  const marketplacePlan = findPlan(pricingCatalog, 'landlord_marketplace')
  const managementPlan = findPlan(pricingCatalog, 'landlord_management')
  const fullPlan = findPlan(pricingCatalog, 'landlord_full_access')
  const tenantHouseSearch = findPlan(pricingCatalog, 'tenant_house_search')
  const [mpesaPhone, setMpesaPhone] = useState(viewerProfile?.phone || '')
  const [submittingPlanCode, setSubmittingPlanCode] = useState('')
  const [submitError, setSubmitError] = useState('')
  const [submitSuccess, setSubmitSuccess] = useState('')

  useEffect(() => {
    setMpesaPhone(viewerProfile?.phone || '')
  }, [viewerProfile?.phone])

  const viewerRole = normalizeRoleLike(viewerProfile?.role)
  const viewerRequestedRole = normalizeRoleLike(viewerProfile?.requested_role)
  const viewerAudience = normalizeAudience(viewerRole || viewerRequestedRole)
  const isLandlordCheckoutReady = Boolean(viewerProfile?.id) && audience === 'landlord'
  const isTenantCheckoutReady = Boolean(viewerProfile?.id) && (audience === 'tenant' || viewerAudience === 'tenant')

  const allPlans = [
    {
      id: 'landlord-marketplace',
      planCode: marketplacePlan?.planCode || 'landlord_marketplace',
      audience: 'landlord',
      badge: 'Annual billing',
      title: marketplacePlan?.planName || 'Marketplace Only',
      price: formatKES(marketplacePlan?.amount || 999),
      feeNote: marketplacePlan?.feeAmount > 0 ? `Includes ${formatKES(marketplacePlan.feeAmount)} platform fee` : '',
      cadence: 'per year',
      description:
        marketplacePlan?.description ||
        'For landlords who only want advertising and tenant inquiries from the marketplace.',
      features: marketplacePlan?.features?.length
        ? marketplacePlan.features
        : ['List houses on marketplace', 'Receive tenant inquiries', 'No tenant management tools'],
      cta: { label: 'Choose marketplace', href: '/register' }
    },
    {
      id: 'landlord-management',
      planCode: managementPlan?.planCode || 'landlord_management',
      audience: 'landlord',
      badge: 'Annual billing',
      title: managementPlan?.planName || 'Management Module Only',
      price: formatKES(managementPlan?.amount || 1499),
      feeNote: managementPlan?.feeAmount > 0 ? `Includes ${formatKES(managementPlan.feeAmount)} platform fee` : '',
      cadence: 'per year',
      description:
        managementPlan?.description ||
        'For landlords with existing tenants who want operations without marketplace advertising.',
      features: managementPlan?.features?.length
        ? managementPlan.features
        : ['Manage tenants', 'Record rent payments', 'Track rent balances', 'Send reminders'],
      cta: { label: 'Choose management', href: '/register' }
    },
    {
      id: 'landlord-full',
      planCode: fullPlan?.planCode || 'landlord_full_access',
      audience: 'landlord',
      badge: 'Most complete',
      title: fullPlan?.planName || 'Full Subscription',
      price: formatKES(fullPlan?.amount || 2199),
      feeNote: fullPlan?.feeAmount > 0 ? `Includes ${formatKES(fullPlan.feeAmount)} platform fee` : '',
      cadence: 'per year',
      description:
        fullPlan?.description ||
        'For landlords and agents who want both marketplace exposure and full property management.',
      features: fullPlan?.features?.length
        ? fullPlan.features
        : [
            'Marketplace listings included',
            'Tenant search and inquiries',
            'Full tenant management system',
            'Rent tracking and payment records'
          ],
      cta: { label: 'Choose full plan', href: '/register' },
      highlight: true
    },
    {
      id: 'tenant-search',
      planCode: tenantHouseSearch?.planCode || 'tenant_house_search',
      audience: 'tenant',
      badge: 'Only while searching',
      title: tenantHouseSearch?.planName || 'Tenant House Search',
      price: formatKES(tenantHouseSearch?.amount || 299),
      feeNote:
        tenantHouseSearch?.feeAmount > 0 ? `Includes ${formatKES(tenantHouseSearch.feeAmount)} platform fee` : '',
      cadence: 'per month',
      description:
        tenantHouseSearch?.description ||
        'Monthly subscription required only when you are actively searching for a house.',
      features: tenantHouseSearch?.features?.length
        ? [...tenantHouseSearch.features, 'Pause anytime when you secure a home.']
        : ['Search & filter houses', 'Save favorites', 'Contact landlords', 'Pause anytime when you secure a home.'],
      cta: { label: 'Start searching', href: '/register' }
    }
  ]

  const plans = allPlans
    .filter(plan => audience === 'all' || plan.audience === audience)
    .map(plan => ({
      ...plan,
      badge: plan.planCode === recommendedPlan ? 'Recommended for you' : plan.badge,
      highlight: plan.planCode === recommendedPlan || plan.highlight
    }))

  const heroTitle =
    audience === 'landlord'
      ? 'Choose the annual landlord plan that fits how you run your rentals.'
      : audience === 'tenant'
        ? 'Choose the tenant house-search plan and unlock marketplace access.'
        : 'Pricing built around how landlords and tenants really work in Kenya.'

  const heroSubtitle =
    audience === 'landlord'
      ? 'Your account is verified. Pick one annual plan for advertising, management, or both, then continue to payment and admin review.'
      : audience === 'tenant'
        ? 'Tenants only subscribe while searching. Once you move in, landlords grant portal access for payments and statements.'
        : 'Landlords and agents can choose marketplace only, management only, or a full annual subscription. Tenants pay monthly only while house hunting, and tenant portal access is granted by the landlord after move-in.'

  const verificationMessage =
    audience === 'landlord'
      ? `Email verified successfully. ${requestedRole === 'agent' ? 'Agent' : 'Landlord'} onboarding is now focused on annual plans.`
      : 'Email verified successfully. Choose a plan to continue.'

  const handleLandlordPlanSelection = async plan => {
    if (!isLandlordCheckoutReady) {
      router.push('/register')

      return
    }

    if (!mpesaPhone.trim()) {
      setSubmitError('Enter the M-Pesa phone number to receive the STK push.')
      setSubmitSuccess('')

      return
    }

    setSubmittingPlanCode(plan.planCode)
    setSubmitError('')
    setSubmitSuccess('')

    try {
      const response = await fetch('/api/landlord/features/request', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          feature: plan.planCode,
          phoneNumber: mpesaPhone.trim()
        })
      })

      const payload = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(payload?.error || payload?.message || 'Unable to start the landlord subscription payment.')
      }

      setSubmitSuccess(
        payload?.customerMessage || 'M-Pesa STK prompt sent successfully. Complete the payment on your phone.'
      )

      const pendingUrl = new URL('/approval-pending', window.location.origin)

      pendingUrl.searchParams.set('plan', plan.planCode)

      if (payload?.checkoutRequestId) {
        pendingUrl.searchParams.set('checkout', payload.checkoutRequestId)
      }

      if (payload?.status) {
        pendingUrl.searchParams.set('status', payload.status)
      }

      router.push(`${pendingUrl.pathname}${pendingUrl.search}`)
    } catch (error) {
      setSubmitError(error?.message || 'Unable to start the landlord subscription payment.')
    } finally {
      setSubmittingPlanCode('')
    }
  }

  const handleTenantPlanSelection = async plan => {
    if (!isTenantCheckoutReady) {
      router.push('/register')

      return
    }

    if (!mpesaPhone.trim()) {
      setSubmitError('Enter the M-Pesa phone number to receive the tenant STK push.')
      setSubmitSuccess('')

      return
    }

    setSubmittingPlanCode(plan.planCode)
    setSubmitError('')
    setSubmitSuccess('')

    try {
      const response = await fetch('/api/tenant/subscriptions/initiate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          subscriptionType: 'house_search',
          phoneNumber: mpesaPhone.trim()
        })
      })

      const payload = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(payload?.error || payload?.message || 'Unable to start the tenant subscription payment.')
      }

      setSubmitSuccess(
        payload?.customerMessage || 'M-Pesa STK prompt sent successfully. Complete the payment on your phone.'
      )

      // Build clean redirect URL - use 'next' param for Login page compatibility
      // The Login page will redirect to this 'next' target after successful authentication
      const paymentsUrl = new URL('/payments', window.location.origin)

      paymentsUrl.searchParams.set('subscription', 'required')
      paymentsUrl.searchParams.set('intent', 'search')

      // Use 'next' parameter pointing to marketplace - Login page will use this for redirect
      const returnToUrl = new URL('/marketplace', window.location.origin)

      returnToUrl.searchParams.set('intent', 'search')
      paymentsUrl.searchParams.set('next', returnToUrl.pathname + returnToUrl.search)

      router.push(`${paymentsUrl.pathname}${paymentsUrl.search}`)
    } catch (error) {
      setSubmitError(error?.message || 'Unable to start the tenant subscription payment.')
    } finally {
      setSubmittingPlanCode('')
    }
  }

  return (
    <Box className={styles.pageRoot}>
      <a href='#pricing-main' className='mp-skip-link'>
        Skip to main content
      </a>

      <Box className={styles.pricingHeader}>
        <Container maxWidth='lg' className={styles.pricingHeaderInner}>
          <Link href='/' className={styles.brandWrap}>
            <span className={styles.brandMark}>M</span>
            <Stack spacing={0}>
              <Typography className={styles.brandTitle}>Mambaproperties</Typography>
              <Typography className={styles.brandSub}>Subscription plans</Typography>
            </Stack>
          </Link>

          <Stack direction='row' spacing={1} className={styles.pricingHeaderActions}>
            <div className={styles.modeToggleWrap}>
              <ModeDropdown />
            </div>
            <Button component={Link} href='/' variant='text' className={styles.headerLink}>
              Back home
            </Button>
            <Button component={Link} href='/login' variant='outlined' className={styles.headerGhostButton}>
              Log in
            </Button>
            <Button component={Link} href='/register' variant='contained' className={styles.headerTrialButton}>
              Start Free Trial
            </Button>
          </Stack>
        </Container>
      </Box>

      <Box className={styles.heroSection}>
        <Container maxWidth='lg'>
          <Grid container spacing={4} alignItems='center'>
            <Grid item xs={12} lg={6}>
              <Stack spacing={2}>
                {isVerified ? (
                  <Alert severity='success' variant='tonal'>
                    {verificationMessage}
                  </Alert>
                ) : null}
                {submitError ? (
                  <Alert severity='error' variant='tonal'>
                    {submitError}
                  </Alert>
                ) : null}
                {submitSuccess ? (
                  <Alert severity='success' variant='tonal'>
                    {submitSuccess}
                  </Alert>
                ) : null}
                <Chip label='Transparent pricing' className={styles.heroChip} />
                <Typography variant='h2' className={styles.heroTitle}>
                  {heroTitle}
                </Typography>
                <Typography className={styles.heroSubtitle}>{heroSubtitle}</Typography>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                  <Button component={Link} href='#pricing-main' variant='contained' className={styles.primaryCta}>
                    {audience === 'landlord' ? 'View landlord plans' : 'Choose a plan'}
                  </Button>
                  <Button component={Link} href='/under-maintenance' variant='outlined' className={styles.secondaryCta}>
                    Talk to sales
                  </Button>
                </Stack>
              </Stack>
            </Grid>
	            <Grid item xs={12} lg={6}>
	              <Box className={styles.heroPanel}>
	                <Typography className={styles.heroPanelTitle}>
	                  {audience === 'landlord' ? 'Landlord onboarding at a glance' : 'Access rules at a glance'}
	                </Typography>
                <Stack spacing={2}>
                  <Box className={styles.heroRule}>
                    <span className={styles.ruleDot} />
                    <div>
                      <Typography className={styles.ruleTitle}>Landlord + Agent = same annual plan</Typography>
                      <Typography className={styles.ruleText}>Three plan options, one annual billing model.</Typography>
                    </div>
                  </Box>
                  <Box className={styles.heroRule}>
                    <span className={styles.ruleDot} />
                    <div>
                      <Typography className={styles.ruleTitle}>Tenants subscribe only for house search</Typography>
                      <Typography className={styles.ruleText}>Monthly, pause when you move into a plot.</Typography>
                    </div>
                  </Box>
                  <Box className={styles.heroRule}>
                    <span className={styles.ruleDot} />
                    <div>
                      <Typography className={styles.ruleTitle}>Portal access comes from landlords</Typography>
                      <Typography className={styles.ruleText}>
                        Payments and statements unlock after tenancy is created.
                      </Typography>
	                    </div>
	                  </Box>
	                </Stack>
	                <Box className={styles.heroPreviewShell}>
	                  <Box className={styles.heroPreviewHeader}>
	                    {heroPreviewStats.map(item => (
	                      <Box key={item} className={styles.heroPreviewStat}>
	                        {item}
	                      </Box>
	                    ))}
	                  </Box>
	                  <Box className={styles.heroPreviewCanvas}>
	                    {heroPreviewCards.map(card => (
	                      <Box key={card.title} className={styles.heroPreviewCard}>
	                        <Box className={`${styles.heroPreviewImage} ${styles[card.imageClass]}`}>
	                          <span className={styles.heroPreviewBadge}>{card.badge}</span>
	                          <span className={styles.heroPreviewGallery}>
	                            <i className='ri-image-line' aria-hidden='true' />
	                            6+
	                          </span>
	                        </Box>
	                        <Box className={styles.heroPreviewBody}>
	                          <Typography className={styles.heroPreviewTitle}>{card.title}</Typography>
	                          <Typography className={styles.heroPreviewMeta}>{card.meta}</Typography>
	                        </Box>
	                      </Box>
	                    ))}
	                  </Box>
	                  <Stack direction='row' spacing={1} className={styles.heroPreviewPills}>
	                    {['Admin review in queue', 'STK ready', 'Agent seats included'].map(item => (
	                      <Box key={item} className={styles.heroPreviewPill}>
	                        {item}
	                      </Box>
	                    ))}
	                  </Stack>
	                </Box>
	              </Box>
	            </Grid>
          </Grid>
        </Container>
      </Box>

      <Box component='main' id='pricing-main' className={styles.pricingSection}>
        <Container maxWidth='lg'>
          {(audience === 'landlord' || audience === 'tenant') && (
            <Box className={styles.checkoutPanel}>
              <Stack spacing={2}>
                <Box>
                  <Typography className={styles.checkoutEyebrow}>Checkout setup</Typography>
                  <Typography className={styles.checkoutTitle}>Confirm where we should send the M-Pesa STK prompt.</Typography>
                </Box>
                <Alert severity='info' variant='tonal'>
                  {audience === 'landlord'
                    ? 'Choose one annual plan to continue. After payment, your account stays in the approval queue until admin review is complete.'
                    : 'Choose the monthly tenant house-search plan to receive an M-Pesa STK push and unlock marketplace access.'}
                </Alert>
                <TextField
                  className={styles.phoneField}
                  fullWidth
                  label='M-Pesa Phone Number'
                  value={mpesaPhone}
                  onChange={event => setMpesaPhone(event.target.value)}
                  placeholder='e.g. 0712345678'
                  helperText={
                    audience === 'landlord'
                      ? isLandlordCheckoutReady
                        ? 'We will send the STK push to this number when you choose a landlord plan.'
                        : 'Sign in with your landlord or agent account to pay from this page.'
                      : isTenantCheckoutReady
                        ? 'We will send the STK push to this number when you start the tenant house-search plan.'
                        : 'Sign in with your tenant account to pay from this page.'
                  }
                />
              </Stack>
            </Box>
          )}
          <Grid container spacing={3}>
            {plans.map(plan => (
              <Grid item xs={12} md={6} lg={3} key={plan.id}>
                <Card className={`${styles.planCard} ${plan.highlight ? styles.planHighlight : ''}`}>
                  <CardContent className={styles.planCardContent}>
                    <Chip label={plan.badge} className={styles.planChip} />
                    <Typography variant='h5' className={styles.planTitle}>
                      {plan.title}
                    </Typography>
                    <Box className={styles.priceRow}>
                      <Typography className={styles.priceValue}>{plan.price}</Typography>
                      <Typography className={styles.priceCadence}>{plan.cadence}</Typography>
                    </Box>
                    {plan.feeNote ? (
                      <Typography variant='body2' color='text.secondary'>
                        {plan.feeNote}
                      </Typography>
                    ) : null}
                    <Typography className={styles.planDescription}>{plan.description}</Typography>
                    <ul className={styles.planList}>
                      {plan.features.map(feature => (
                        <li key={feature}>{feature}</li>
                      ))}
                    </ul>
                    {isLandlordCheckoutReady && plan.audience === 'landlord' ? (
                      <Button
                        onClick={() => handleLandlordPlanSelection(plan)}
                        variant={plan.highlight ? 'contained' : 'outlined'}
                        className={styles.planButton}
                        disabled={submittingPlanCode === plan.planCode}
                      >
                        {submittingPlanCode === plan.planCode ? (
                          <>
                            <CircularProgress size={18} color='inherit' sx={{ mr: 1 }} />
                            Sending STK...
                          </>
                        ) : (
                          plan.cta.label
                        )}
                      </Button>
                    ) : isTenantCheckoutReady && plan.audience === 'tenant' ? (
                      <Button
                        onClick={() => handleTenantPlanSelection(plan)}
                        variant={plan.highlight ? 'contained' : 'outlined'}
                        className={styles.planButton}
                        disabled={submittingPlanCode === plan.planCode}
                      >
                        {submittingPlanCode === plan.planCode ? (
                          <>
                            <CircularProgress size={18} color='inherit' sx={{ mr: 1 }} />
                            Sending STK...
                          </>
                        ) : (
                          plan.cta.label
                        )}
                      </Button>
                    ) : (
                      <Button
                        component={Link}
                        href={plan.cta.href}
                        variant={plan.highlight ? 'contained' : 'outlined'}
                        className={styles.planButton}
                      >
                        {plan.cta.label}
                      </Button>
                    )}
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Container>
      </Box>

      <Box className={styles.accessSection}>
        <Container maxWidth='lg'>
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <Typography className={styles.sectionEyebrow}>How access works</Typography>
              <Typography variant='h4' className={styles.sectionTitle}>
                Built-in access control from search to tenancy.
              </Typography>
              <Typography className={styles.sectionBody}>
                Tenants only subscribe during house search. Once a lease is confirmed, landlords grant tenant portal
                rights for rent payments and statements. Agents ride on the same landlord pricing structure and manage
                operations together.
              </Typography>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} className={styles.accessActions}>
                <Button component={Link} href='/register' variant='contained'>
                  Get started
                </Button>
                <Button component={Link} href='/under-maintenance' variant='text'>
                  Read onboarding guide
                </Button>
              </Stack>
            </Grid>
            <Grid item xs={12} md={6}>
              <Box className={styles.timeline}>
                {[
                  {
                    step: '1',
                    title: 'Tenant subscribes for house search',
                    body: 'Monthly plan unlocks marketplace browsing and contact workflows.'
                  },
                  {
                    step: '2',
                    title: 'Landlord confirms tenancy',
                    body: 'Tenant is mapped to a unit and rent schedule is created.'
                  },
                  {
                    step: '3',
                    title: 'Portal rights granted',
                    body: 'Payments, statements, and communication stay open for the tenancy.'
                  }
                ].map(item => (
                  <Box key={item.step} className={styles.timelineItem}>
                    <Box className={styles.timelineBadge}>{item.step}</Box>
                    <Box>
                      <Typography className={styles.timelineTitle}>{item.title}</Typography>
                      <Typography className={styles.timelineBody}>{item.body}</Typography>
                    </Box>
                  </Box>
                ))}
              </Box>
            </Grid>
          </Grid>
        </Container>
      </Box>

      <Box className={styles.noteSection}>
        <Container maxWidth='lg'>
          <Grid container spacing={2}>
            <Grid item xs={12} md={8}>
              <Typography className={styles.noteTitle}>Agents are bundled with landlord subscriptions.</Typography>
              <Typography className={styles.noteBody}>
                This keeps operations unified: the same annual plan covers landlord teams, agents, and caretakers
                working on the portfolio.
              </Typography>
            </Grid>
            <Grid item xs={12} md={4} className={styles.noteActionWrap}>
              <Button component={Link} href='/register' variant='outlined' className={styles.noteButton}>
                Start your trial
              </Button>
            </Grid>
          </Grid>
        </Container>
      </Box>
    </Box>
  )
}

export default Pricing
