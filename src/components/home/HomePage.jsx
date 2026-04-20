'use client'

import { useEffect, useMemo, useState } from 'react'

import Link from 'next/link'

import Accordion from '@mui/material/Accordion'
import AccordionDetails from '@mui/material/AccordionDetails'
import AccordionSummary from '@mui/material/AccordionSummary'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Chip from '@mui/material/Chip'
import Container from '@mui/material/Container'
import Divider from '@mui/material/Divider'
import Drawer from '@mui/material/Drawer'
import Grid from '@mui/material/Grid'
import IconButton from '@mui/material/IconButton'
import Popover from '@mui/material/Popover'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'

import ModeDropdown from '@components/layout/shared/ModeDropdown'
import {
  benefits,
  faqs,
  features,
  footer,
  hero,
  integrations,
  navGroups,
  personas,
  ratings,
  testimonials
} from '@/data/home'

import styles from './homepage.module.css'

const desktopMenuItems = ['Features', 'Use Cases', 'Resources']

const heroListings = [
  {
    title: 'Westlands Residences',
    meta: '12 units • 96% occupied',
    value: 'KES 85K avg',
    badge: 'Exterior view',
    galleryCount: '12',
    likes: '4'
  },
  {
    title: 'Kilimani Suites',
    meta: '8 units • 2 pending repairs',
    value: 'KES 61K avg',
    badge: 'Suite interior',
    galleryCount: '9',
    likes: '6'
  },
  {
    title: 'Runda Court',
    meta: '15 units • 1 arrears account',
    value: 'KES 120K avg',
    badge: 'Owner lounge',
    galleryCount: '16',
    likes: '3'
  }
]

const discoveryPills = ['Rent collection', 'Maintenance', 'Tenant comms', 'Vacancy tracking', 'Owner reports']

const storyMoments = [
  { label: '08:15', title: 'Rent follow-up sent', detail: '12 tenants nudged over SMS and WhatsApp.' },
  { label: '11:40', title: 'Inspection completed', detail: 'Field agent uploaded notes and move-in photos.' },
  { label: '16:05', title: 'Work order closed', detail: 'Caretaker marked plumbing fix as resolved.' }
]

const storySignals = ['94% on-time collections', '17 active site tasks', 'Owners updated weekly']
const COPYRIGHT_YEAR = 2026

const renderStars = count => {
  return Array.from({ length: count }).map((_, index) => (
    <span key={index} className={styles.star} aria-hidden='true'>
      ★
    </span>
  ))
}

const HomePage = () => {
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState({})
  const [megaMenu, setMegaMenu] = useState({ key: '', anchorEl: null })
  const [activeFeature, setActiveFeature] = useState(features[0].id)
  const [activeTestimonial, setActiveTestimonial] = useState(0)
  const [expandedFaq, setExpandedFaq] = useState(faqs[0].question)
  const [expandedPersona, setExpandedPersona] = useState(null)

  const activeFeatureContent = useMemo(() => {
    return features.find(item => item.id === activeFeature) || features[0]
  }, [activeFeature])

  useEffect(() => {
    const timer = setInterval(() => {
      setActiveTestimonial(prev => (prev + 1) % testimonials.length)
    }, 6500)

    return () => clearInterval(timer)
  }, [])

  const handleMegaOpen = (event, key) => {
    setMegaMenu({ key, anchorEl: event.currentTarget })
  }

  const handleMegaClose = () => {
    setMegaMenu({ key: '', anchorEl: null })
  }

  const handleMobileGroupToggle = key => {
    setMobileMenuOpen(prev => ({ ...prev, [key]: !prev[key] }))
  }

  const goToNextTestimonial = () => {
    setActiveTestimonial(prev => (prev + 1) % testimonials.length)
  }

  const goToPrevTestimonial = () => {
    setActiveTestimonial(prev => (prev - 1 + testimonials.length) % testimonials.length)
  }

  const handleFeatureKeyDown = (event, featureId) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      setActiveFeature(featureId)
    }
  }

  return (
    <Box className={styles.pageRoot}>
      <a href='#home-main-content' className='mp-skip-link'>
        Skip to main content
      </a>
      <Box className={styles.headerShell}>
        <Container maxWidth='lg' className={styles.headerContainer}>
          <Link href='/' className={styles.logoWrap}>
            <span className={styles.logoMark}>M</span>
            <Stack spacing={0}>
              <Typography className={styles.logoTitle}>Mambaproperties</Typography>
              <Typography className={styles.logoSub}>Kenya Rental SaaS</Typography>
            </Stack>
          </Link>

          <Box className={styles.desktopNav}>
            {desktopMenuItems.map(item => (
              <Button
                key={item}
                className={styles.navButton}
                onMouseEnter={event => handleMegaOpen(event, item)}
                onFocus={event => handleMegaOpen(event, item)}
                onClick={event => handleMegaOpen(event, item)}
                aria-haspopup='menu'
                aria-expanded={megaMenu.key === item ? 'true' : undefined}
                aria-controls={megaMenu.key === item ? 'home-mega-menu' : undefined}
              >
                {item}
              </Button>
            ))}
            <Button component={Link} href='/pricing' className={styles.navButton}>
              Pricing
            </Button>
          </Box>

          <Stack direction='row' spacing={1} className={styles.headerActions}>
            <div className={styles.modeToggleWrap}>
              <ModeDropdown />
            </div>
            <Button component={Link} href='/login' variant='outlined' className={styles.loginButton}>
              Log in
            </Button>
            <Button component={Link} href='/register' variant='contained' className={styles.trialButton}>
              Start Free Trial
            </Button>
            <IconButton
              className={styles.mobileMenuBtn}
              onClick={() => setMobileNavOpen(true)}
              aria-label='Open menu'
            >
              ☰
            </IconButton>
          </Stack>
        </Container>
      </Box>

      <Box className={styles.categoryRail}>
        <Container maxWidth='lg'>
          <Stack direction='row' spacing={1.25} className={styles.categoryScroller}>
            {discoveryPills.map(item => (
              <Box key={item} className={styles.categoryPill}>
                {item}
              </Box>
            ))}
          </Stack>
        </Container>
      </Box>

      <Popover
        id='home-mega-menu'
        open={Boolean(megaMenu.anchorEl)}
        anchorEl={megaMenu.anchorEl}
        onClose={handleMegaClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
        PaperProps={{
          className: styles.megaPaper,
          onMouseLeave: handleMegaClose
        }}
      >
        <Grid container spacing={2} aria-label={`${megaMenu.key || 'Navigation'} links`}>
          {(navGroups[megaMenu.key] || []).map(group => (
            <Grid key={group.title} item xs={12} sm={6} md={4}>
              <Typography className={styles.megaGroupTitle}>{group.title}</Typography>
              <Stack spacing={1}>
                {group.links.map(linkItem => (
                  <Link key={linkItem.label} href={linkItem.href} className={styles.megaLink} onClick={handleMegaClose}>
                    {linkItem.label}
                  </Link>
                ))}
              </Stack>
            </Grid>
          ))}
        </Grid>
      </Popover>

      <Drawer
        anchor='right'
        open={mobileNavOpen}
        onClose={() => setMobileNavOpen(false)}
        PaperProps={{ className: styles.mobileDrawer, 'aria-label': 'Mobile navigation' }}
      >
        <Box className={styles.drawerHeader}>
          <Typography className={styles.drawerTitle}>Menu</Typography>
          <IconButton onClick={() => setMobileNavOpen(false)} aria-label='Close menu'>
            ✕
          </IconButton>
        </Box>

        <Stack spacing={1} className={styles.mobileNavStack}>
          {desktopMenuItems.map(menu => (
            <Box key={menu}>
              <button
                type='button'
                className={styles.mobileGroupToggle}
                onClick={() => handleMobileGroupToggle(menu)}
                aria-expanded={Boolean(mobileMenuOpen[menu])}
                aria-controls={`mobile-nav-${menu.toLowerCase().replace(/\s+/g, '-')}`}
              >
                <span>{menu}</span>
                <span>{mobileMenuOpen[menu] ? '−' : '+'}</span>
              </button>
              {mobileMenuOpen[menu] ? (
                <Box className={styles.mobileGroupItems} id={`mobile-nav-${menu.toLowerCase().replace(/\s+/g, '-')}`}>
                  {(navGroups[menu] || []).map(group => (
                    <Box key={group.title} className={styles.mobileGroupBlock}>
                      <Typography className={styles.mobileGroupTitle}>{group.title}</Typography>
                      {group.links.map(linkItem => (
                        <Link
                          key={linkItem.label}
                          href={linkItem.href}
                          className={styles.mobileSubLink}
                          onClick={() => setMobileNavOpen(false)}
                        >
                          {linkItem.label}
                        </Link>
                      ))}
                    </Box>
                  ))}
                </Box>
              ) : null}
            </Box>
          ))}

          <Link href='/pricing' className={styles.mobileDirectLink} onClick={() => setMobileNavOpen(false)}>
            Pricing
          </Link>
        </Stack>

        <Stack direction='row' spacing={1} className={styles.mobileActions}>
          <Button component={Link} href='/login' variant='outlined' fullWidth onClick={() => setMobileNavOpen(false)}>
            Log in
          </Button>
          <Button component={Link} href='/register' variant='contained' fullWidth onClick={() => setMobileNavOpen(false)}>
            Start Free Trial
          </Button>
        </Stack>
      </Drawer>

      <Box component='main' id='home-main-content'>
        <Box component='section' className={styles.heroSection}>
        <Container maxWidth='lg'>
          <Grid container spacing={5} alignItems='center'>
            <Grid item xs={12} lg={6}>
              <Chip label={hero.badge} className={styles.heroBadge} />
              <Typography component='h1' className={styles.heroTitle}>
                {hero.title}
              </Typography>
              <Typography className={styles.heroDescription}>{hero.description}</Typography>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} className={styles.heroActions}>
                <Button component={Link} href={hero.primaryCta.href} variant='contained' className={styles.primaryCta}>
                  {hero.primaryCta.label}
                </Button>
                <Button component={Link} href={hero.secondaryCta.href} variant='outlined' className={styles.secondaryCta}>
                  {hero.secondaryCta.label}
                </Button>
              </Stack>
              <Stack direction='row' spacing={1} flexWrap='wrap' useFlexGap className={styles.trustRow}>
                {hero.trustChips.map(item => (
                  <Chip key={item} label={item} className={styles.trustChip} />
                ))}
              </Stack>
            </Grid>

            <Grid item xs={12} lg={6}>
              <Card className={styles.heroVisual}>
                <CardContent>
                  <Box className={styles.heroVisualTop}>
                    <Box>
                      <Typography className={styles.heroVisualEyebrow}>Live portfolio preview</Typography>
                      <Typography className={styles.heroVisualTitle}>Browse your entire rental operation like a listings marketplace.</Typography>
                    </Box>
                    <Box className={styles.heroSummaryCard}>
                      <Typography className={styles.heroSummaryLabel}>This month</Typography>
                      <Typography className={styles.heroSummaryValue}>KES 3.42M</Typography>
                      <Typography className={styles.heroSummaryMeta}>Collected across 35 occupied units</Typography>
                    </Box>
                  </Box>
                  <Grid container spacing={2} className={styles.heroListingGrid}>
                    {heroListings.map((item, index) => (
                      <Grid item xs={12} sm={4} key={item.title}>
                        <Box className={styles.heroListingCard}>
                          <Box className={`${styles.heroListingImage} ${styles[`heroListingImage${index + 1}`]}`}>
                            <Box className={styles.heroListingImageTop}>
                              <span className={styles.heroListingBadge}>{item.badge}</span>
                              <span className={styles.heroListingFavorite}>
                                <i className='ri-heart-3-line' aria-hidden='true' />
                                {item.likes}
                              </span>
                            </Box>
                            <Box className={styles.heroListingImageBottom}>
                              <span className={styles.heroListingGallery}>
                                <i className='ri-image-line' aria-hidden='true' />
                                {item.galleryCount}+
                              </span>
                            </Box>
                          </Box>
                          <Box className={styles.heroListingBody}>
                            <Typography className={styles.heroListingTitle}>{item.title}</Typography>
                            <Typography className={styles.heroListingMeta}>{item.meta}</Typography>
                            <Typography className={styles.heroListingValue}>{item.value}</Typography>
                          </Box>
                        </Box>
                      </Grid>
                    ))}
                  </Grid>
                  <Stack direction='row' spacing={1} className={styles.heroMetricStrip}>
                    {['94% occupancy', '17 arrears alerts', '54 open tickets'].map(item => (
                      <Box key={item} className={styles.heroMetricPill}>
                        {item}
                      </Box>
                    ))}
                  </Stack>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </Container>
        </Box>

        <Box component='section' className={styles.ratingsStrip}>
        <Container maxWidth='lg'>
          <Grid container spacing={2}>
            {ratings.map(platform => (
              <Grid item xs={12} sm={6} lg={3} key={platform.platform}>
                <Box className={styles.ratingCard}>
                  <Box aria-hidden='true'>{renderStars(5)}</Box>
                  <Typography className={styles.ratingPlatform}>{platform.platform}</Typography>
                  <Typography className={styles.ratingScore}>{platform.score}</Typography>
                </Box>
              </Grid>
            ))}
          </Grid>
        </Container>
        </Box>

        <Box component='section' className={styles.featureSection}>
        <Container maxWidth='lg'>
          <Typography className={styles.sectionEyebrow}>Core capabilities</Typography>
          <Typography component='h2' className={styles.sectionTitle}>
            Everything you need to run rentals at scale.
          </Typography>

          <Box className={styles.featureDesktopViewport}>
            <Grid container spacing={4} className={styles.featureDesktop}>
              <Grid item xs={12} lg={6}>
                <Stack spacing={2}>
                  {features.map(item => (
                    <Box
                      key={item.id}
                      role='button'
                      tabIndex={0}
                      className={`${styles.featureItem} ${activeFeature === item.id ? styles.featureItemActive : ''}`}
                      onClick={() => setActiveFeature(item.id)}
                      onKeyDown={event => handleFeatureKeyDown(event, item.id)}
                      aria-pressed={activeFeature === item.id}
                    >
                      <Box className={styles.featureIcon}>{item.icon}</Box>
                      <Box>
                        <Typography className={styles.featureTitle}>{item.title}</Typography>
                        <Typography className={styles.featureSubtitle}>{item.subtitle}</Typography>
                        <ul className={styles.featureBullets}>
                          {item.bullets.slice(0, 2).map(point => (
                            <li key={point}>{point}</li>
                          ))}
                        </ul>
                        <Link href={item.learnHref} className={styles.learnLink}>
                          Learn more
                        </Link>
                      </Box>
                    </Box>
                  ))}
                </Stack>
              </Grid>

              <Grid item xs={12} lg={6}>
                <Card className={styles.featureVisualCard}>
                  <CardContent>
                    <Typography className={styles.visualLabel}>{activeFeatureContent.visual.label}</Typography>
                    <Stack spacing={1.5} className={styles.visualKpis}>
                      {activeFeatureContent.visual.kpis.map(kpi => (
                        <Box key={kpi} className={styles.visualKpiRow}>
                          {kpi}
                        </Box>
                      ))}
                    </Stack>
                    <Divider className={styles.visualDivider} />
                    <Box className={styles.mockPanel}>
                      <Box className={styles.mockBar}>
                        <span />
                        <span />
                        <span />
                      </Box>
                      <Box className={styles.mockBody}>
                        <Box className={styles.mockLineWide} />
                        <Box className={styles.mockLineMid} />
                        <Box className={styles.mockLineShort} />
                        <Box className={styles.mockGraph} />
                      </Box>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          </Box>

          <Box className={styles.featureMobileViewport}>
            <Stack spacing={2.5} className={styles.featureMobileStack}>
              {features.map(item => (
                <Card key={item.id} className={styles.featureMobileCard}>
                  <CardContent>
                    <Box className={styles.featureIcon}>{item.icon}</Box>
                    <Typography className={styles.featureTitle}>{item.title}</Typography>
                    <Typography className={styles.featureSubtitle}>{item.subtitle}</Typography>
                    <ul className={styles.featureBullets}>
                      {item.bullets.map(point => (
                        <li key={point}>{point}</li>
                      ))}
                    </ul>
                    <Box className={styles.mobileVisualBox}>
                      {item.visual.kpis.map(kpi => (
                        <Box key={kpi} className={styles.visualKpiRow}>
                          {kpi}
                        </Box>
                      ))}
                    </Box>
                    <Link href={item.learnHref} className={styles.learnLink}>
                      Learn more
                    </Link>
                  </CardContent>
                </Card>
              ))}
            </Stack>
          </Box>
        </Container>
        </Box>

        <Box component='section' className={styles.integrationsSection}>
        <Container maxWidth='lg'>
          <Typography component='h2' className={styles.sectionTitleSmall}>
            Connect with the tools you already use
          </Typography>
          <Typography className={styles.sectionLead}>
            Sync payments, notifications, and reporting workflows with your existing stack.
          </Typography>
          <Box className={styles.integrationRow}>
            {integrations.map(item => (
              <Box key={item} className={styles.integrationPill}>
                {item}
              </Box>
            ))}
          </Box>
        </Container>
        </Box>

        <Box component='section' className={styles.benefitsSection}>
        <Container maxWidth='lg'>
          <Typography component='h2' className={styles.sectionTitleSmall}>
            Everything else your operations team needs
          </Typography>
          <Grid container spacing={2.5}>
            {benefits.map(item => (
              <Grid item xs={12} sm={6} lg={4} key={item.title}>
                <Card className={styles.benefitCard}>
                  <CardContent>
                    <Box className={styles.benefitIcon}>{item.icon}</Box>
                    <Typography className={styles.benefitTitle}>{item.title}</Typography>
                    <Typography className={styles.benefitText}>{item.description}</Typography>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Container>
        </Box>

        <Box component='section' className={styles.testimonialBand}>
        <Container maxWidth='lg'>
          <Grid container spacing={4}>
            <Grid item xs={12} lg={5}>
              <Typography className={styles.sectionEyebrow}>Customer stories</Typography>
              <Typography component='h2' className={styles.sectionTitleSmall}>
                Trusted by landlords and property teams across Kenya
              </Typography>
              <Typography className={styles.sectionLead}>
                Teams use Mambaproperties to reduce arrears, speed up maintenance, and keep residents informed from one platform.
              </Typography>
            </Grid>
            <Grid item xs={12} lg={7}>
              <Box className={styles.storyVisual}>
                <Box className={styles.storyVisualHeader}>
                  <div>
                    <Typography className={styles.storyVisualTitle}>In the field</Typography>
                    <Typography className={styles.storyVisualText}>
                      See how estate teams handle rent follow-up, inspections, and work orders directly from mobile.
                    </Typography>
                  </div>
                  <Box className={styles.storyPulse}>
                    <span />
                    Live activity
                  </Box>
                </Box>
                <Box className={styles.storyVisualGrid}>
                  {storyMoments.map(item => (
                    <Box key={item.title} className={styles.storyActionCard}>
                      <Typography className={styles.storyActionMeta}>{item.label}</Typography>
                      <Typography className={styles.storyActionTitle}>{item.title}</Typography>
                      <Typography className={styles.storyActionDetail}>{item.detail}</Typography>
                    </Box>
                  ))}
                </Box>
                <Stack direction='row' spacing={1} className={styles.storyScoreStrip}>
                  {storySignals.map(item => (
                    <Box key={item} className={styles.storyScorePill}>
                      {item}
                    </Box>
                  ))}
                </Stack>
              </Box>
            </Grid>
          </Grid>

          <Card className={styles.testimonialCard}>
            <CardContent>
              <Stack direction='row' justifyContent='space-between' alignItems='center'>
                <Box aria-hidden='true'>{renderStars(5)}</Box>
                <Stack direction='row' spacing={1}>
                  <IconButton className={styles.testimonialNavButton} aria-label='Previous testimonial' onClick={goToPrevTestimonial}>
                    ←
                  </IconButton>
                  <IconButton className={styles.testimonialNavButton} aria-label='Next testimonial' onClick={goToNextTestimonial}>
                    →
                  </IconButton>
                </Stack>
              </Stack>

              <Typography className={styles.testimonialQuote} aria-live='polite'>
                {testimonials[activeTestimonial].quote}
              </Typography>
              <Typography className={styles.testimonialMeta}>
                {testimonials[activeTestimonial].name} · {testimonials[activeTestimonial].role}, {testimonials[activeTestimonial].location}
              </Typography>
              <Chip label={testimonials[activeTestimonial].source} className={styles.sourceChip} />
            </CardContent>
          </Card>
        </Container>
        </Box>

        <Box component='section' className={styles.personaSection}>
        <Container maxWidth='lg'>
          <Typography className={styles.sectionEyebrow}>Who it is for</Typography>
          <Typography component='h2' className={styles.sectionTitleSmall}>
            Built for every role in rental operations
          </Typography>

          <Grid container spacing={2.5}>
            {personas.map((item, index) => (
              <Grid item xs={12} sm={6} lg={4} key={item.title}>
                <button
                  type='button'
                  className={`${styles.personaFlipCard} ${expandedPersona === index ? styles.isFlipped : ''}`}
                  onClick={() => setExpandedPersona(expandedPersona === index ? null : index)}
                  aria-pressed={expandedPersona === index}
                >
                  <Box className={styles.personaInner}>
                    <Box className={styles.personaFront}>
                      <Box className={styles.personaBadge}>{item.title.slice(0, 3).toUpperCase()}</Box>
                      <Typography className={styles.personaTitle}>{item.title}</Typography>
                      <Typography className={styles.personaText}>{item.frontText}</Typography>
                    </Box>
                    <Box className={styles.personaBack}>
                      <Typography className={styles.personaTitle}>{item.title}</Typography>
                      <Typography className={styles.personaText}>{item.backText}</Typography>
                      <span className={styles.personaHint}>Tap or click to flip back</span>
                    </Box>
                  </Box>
                </button>
              </Grid>
            ))}
          </Grid>
        </Container>
        </Box>

        <Box component='section' className={styles.faqSection}>
        <Container maxWidth='lg'>
          <Typography component='h2' className={styles.sectionTitleSmall}>
            Frequently asked questions
          </Typography>
          <Box className={styles.faqList}>
            {faqs.map(item => (
              <Accordion
                key={item.question}
                expanded={expandedFaq === item.question}
                onChange={() => setExpandedFaq(expandedFaq === item.question ? '' : item.question)}
                className={styles.faqItem}
              >
                <AccordionSummary expandIcon={<span className={styles.faqExpandIcon}>+</span>}>
                  <Typography className={styles.faqQuestion}>{item.question}</Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <Typography className={styles.faqAnswer}>{item.answer}</Typography>
                </AccordionDetails>
              </Accordion>
            ))}
          </Box>
        </Container>
        </Box>

        <Box className={styles.midCta}>
        <Container maxWidth='lg'>
          <Stack direction={{ xs: 'column', md: 'row' }} justifyContent='space-between' alignItems={{ md: 'center' }} spacing={2}>
            <Typography className={styles.midCtaText}>Reduce arrears and admin workload from your first month.</Typography>
            <Button component={Link} href='/register' variant='contained' className={styles.primaryCta}>
              Start Free Trial
            </Button>
          </Stack>
        </Container>
        </Box>

        <Box className={styles.finalCta}>
        <Container maxWidth='lg'>
          <Typography className={styles.finalCtaTitle}>Ready to simplify your rentals?</Typography>
          <Typography className={styles.finalCtaSubtitle}>Start your free trial today and bring every estate workflow into one platform.</Typography>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} justifyContent='center'>
            <Button component={Link} href='/register' variant='contained' className={styles.primaryCta}>
              Start Free Trial
            </Button>
            <Button component={Link} href='/login' variant='outlined' className={styles.secondaryCtaInvert}>
              Log in
            </Button>
          </Stack>
        </Container>
        </Box>
      </Box>

      <Box component='footer' className={styles.footer}>
        <Container maxWidth='lg'>
          <Grid container spacing={3}>
            <Grid item xs={12} md={3}>
              <Typography className={styles.footerTitle}>Product</Typography>
              <Stack spacing={1}>
                {footer.product.map(item => (
                  <Link key={item.label} href={item.href} className={styles.footerLink}>
                    {item.label}
                  </Link>
                ))}
              </Stack>
            </Grid>
            <Grid item xs={12} md={3}>
              <Typography className={styles.footerTitle}>Company</Typography>
              <Stack spacing={1}>
                {footer.company.map(item => (
                  <Link key={item.label} href={item.href} className={styles.footerLink}>
                    {item.label}
                  </Link>
                ))}
              </Stack>
            </Grid>
            <Grid item xs={12} md={3}>
              <Typography className={styles.footerTitle}>Resources</Typography>
              <Stack spacing={1}>
                {footer.resources.map(item => (
                  <Link key={item.label} href={item.href} className={styles.footerLink}>
                    {item.label}
                  </Link>
                ))}
              </Stack>
            </Grid>
            <Grid item xs={12} md={3}>
              <Typography className={styles.footerTitle}>Legal</Typography>
              <Stack spacing={1}>
                {footer.legal.map(item => (
                  <Link key={item.label} href={item.href} className={styles.footerLink}>
                    {item.label}
                  </Link>
                ))}
              </Stack>
            </Grid>
          </Grid>

          <Divider className={styles.footerDivider} />
          <Stack direction={{ xs: 'column', md: 'row' }} justifyContent='space-between' spacing={1.5}>
            <Typography className={styles.footerBottom}>© {COPYRIGHT_YEAR} Mambaproperties. All rights reserved.</Typography>
            <Typography className={styles.footerBottom}>Kenya | English</Typography>
          </Stack>
        </Container>
      </Box>
    </Box>
  )
}

export default HomePage
