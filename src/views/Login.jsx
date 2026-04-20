'use client'

// React Imports
import { useMemo, useState } from 'react'

// Next Imports
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'

// MUI Imports
import Alert from '@mui/material/Alert'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Checkbox from '@mui/material/Checkbox'
import CircularProgress from '@mui/material/CircularProgress'
import Divider from '@mui/material/Divider'
import FormControlLabel from '@mui/material/FormControlLabel'
import IconButton from '@mui/material/IconButton'
import InputAdornment from '@mui/material/InputAdornment'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'

// Component Imports
import Illustrations from '@components/Illustrations'
import Logo from '@components/layout/shared/Logo'

// Config Imports
import themeConfig from '@configs/themeConfig'

// Hook Imports
import { useImageVariant } from '@core/hooks/useImageVariant'

// Lib Imports
import { createAuthPerfLogger } from '@/libs/auth/perf'
import { createBrowserSupabaseClient } from '@/libs/supabase'

const toLoginErrorMessage = ({ error, isOtpFlow = false }) => {
  const message = String(error?.message || '').trim().toLowerCase()

  if (isOtpFlow) {
    return 'Unable to start phone sign-in. Check the number and try again.'
  }

  if (
    message.includes('invalid login credentials') ||
    message.includes('invalid credentials') ||
    message.includes('email not confirmed') ||
    message.includes('user not found') ||
    message.includes('invalid email') ||
    message.includes('invalid password')
  ) {
    return 'Invalid email, phone number, or password.'
  }

  return 'Unable to sign in right now. Please try again later.'
}

const validateLoginFields = ({ identifier, password }) => {
  const errors = {}
  const loginInput = identifier.trim()

  if (!loginInput) {
    errors.identifier = 'Enter your email address or phone number.'
  }

  if (loginInput.includes('@') && !password) {
    errors.password = 'Password is required for email sign in.'
  }

  return errors
}

const Login = ({ mode }) => {
  // States
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [isPasswordShown, setIsPasswordShown] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [infoMessage, setInfoMessage] = useState('')
  const [fieldErrors, setFieldErrors] = useState({})

  // Vars
  const darkImg = '/images/pages/auth-v1-mask-dark.png'
  const lightImg = '/images/pages/auth-v1-mask-light.png'

  // Hooks
  const router = useRouter()
  const searchParams = useSearchParams()
  const authBackground = useImageVariant(mode, lightImg, darkImg)

  // Consolidate redirect parameters - prefer 'next', fall back to 'returnTo', then default to '/'
  // This prevents redirect parameter stacking (e.g., /login?intent=...&returnTo=...&next=/...)
  const nextPath = useMemo(() => {
    const nextParam = searchParams.get('next')
    const returnToParam = searchParams.get('returnTo')

    // If 'next' is present, use it (it's the standard redirect param)
    if (nextParam) {
      return nextParam
    }

    // If 'returnTo' is present (from tenant flow), use it as the redirect target
    if (returnToParam) {
      return returnToParam
    }

    // Default fallback
    return '/'
  }, [searchParams])

  const authMessage = useMemo(() => searchParams.get('message') || '', [searchParams])
  const supabase = useMemo(() => createBrowserSupabaseClient(), [])
  const formStatusId = 'login-form-status'
  const formDescribedBy = errorMessage || authMessage || infoMessage ? formStatusId : undefined

  const handleClickShowPassword = () => setIsPasswordShown(show => !show)

  const handleIdentifierChange = value => {
    setIdentifier(value)

    setFieldErrors(prev => {
      if (!prev.identifier && !(prev.password && value.includes('@'))) {
        return prev
      }

      const next = { ...prev }

      delete next.identifier

      if (!value.includes('@')) {
        delete next.password
      }

      return next
    })
  }

  const handlePasswordChange = value => {
    setPassword(value)

    setFieldErrors(prev => {
      if (!prev.password) {
        return prev
      }

      const next = { ...prev }

      delete next.password

      return next
    })
  }

  const handleOAuthSignIn = async provider => {
    const perf = createAuthPerfLogger('auth.login.oauth', { provider })

    setErrorMessage('')
    setInfoMessage('')
    setIsSubmitting(true)

    try {
      if (!supabase) {
        throw new Error('Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.')
      }

      const redirectTo = `${window.location.origin}${nextPath || '/'}`

      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo
        }
      })

      perf.mark('oauth-request-finished', { hasError: Boolean(error) })

      if (error) {
        throw error
      }

      perf.done({ outcome: 'redirect' })
    } catch (error) {
      setErrorMessage('Unable to start social login right now. Please try again later.')
      perf.done({ outcome: 'error', message: error?.message || 'oauth_failed' })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleSubmit = async e => {
    const perf = createAuthPerfLogger('auth.login.submit')
    let outcome = 'idle'
    let roleForLog = null

    e.preventDefault()

    setErrorMessage('')
    setInfoMessage('')

    const validationErrors = validateLoginFields({ identifier, password })

    setFieldErrors(validationErrors)

    if (Object.keys(validationErrors).length > 0) {
      setErrorMessage('Please correct the highlighted fields and try again.')

      return
    }

    const loginInput = identifier.trim()

    setIsSubmitting(true)

    try {
      if (!supabase) {
        throw new Error('Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.')
      }

      if (loginInput.includes('@')) {
        const response = await fetch('/api/auth/login', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            identifier: loginInput,
            password
          })
        })

        const body = await response.json().catch(() => ({}))

        perf.mark('password-signin-finished', { hasError: !response.ok, status: response.status })

        if (!response.ok) {
          throw new Error(body?.error || 'Invalid email, phone number, or password.')
        }

        let redirectTo = ''

        try {
          const controller = new AbortController()
          const timeout = setTimeout(() => controller.abort(), 8000)

          try {
            const syncProfileResponse = await fetch('/api/auth/sync-profile', {
              method: 'POST',
              signal: controller.signal,
              headers: perf.enabled ? { 'x-auth-perf': '1' } : undefined
            })

            perf.mark('sync-profile-response', { status: syncProfileResponse.status })

            const syncProfileData = await syncProfileResponse.json().catch(() => ({}))

            perf.mark('sync-profile-json-ready')

            redirectTo = syncProfileData?.redirectTo || ''
            perf.mark('resolved-role-from-sync', { role: syncProfileData?.role || '' })
          } finally {
            clearTimeout(timeout)
          }
        } catch {
          perf.mark('sync-profile-fallback-resolve-role')
        }

        outcome = 'redirect'
        roleForLog = body?.role || null
        router.replace(nextPath || redirectTo || '/dashboard')

        return
      }

      const normalizedPhone = loginInput.startsWith('+') ? loginInput : `+${loginInput}`

      const { error } = await supabase.auth.signInWithOtp({
        phone: normalizedPhone,
        options: {
          shouldCreateUser: false
        }
      })

      perf.mark('otp-request-finished', { hasError: Boolean(error) })

      if (error) {
        throw error
      }

      setInfoMessage('OTP sent to your phone. Complete verification from the Supabase auth flow.')

      outcome = 'otp_sent'
    } catch (error) {
      setErrorMessage(toLoginErrorMessage({ error, isOtpFlow: !loginInput.includes('@') }))
      outcome = 'error'
      perf.mark('submit-error', { message: error?.message || 'login_failed' })
    } finally {
      perf.done({
        outcome,
        role: roleForLog
      })
      setIsSubmitting(false)
    }
  }

  return (
    <div className='mp-auth-shell'>
      <Card className='mp-auth-card mp-auth-card-inner flex flex-col sm:is-[490px]'>
        <CardContent className='p-6 sm:!p-12'>
          <Link href='/' className='flex justify-center items-center mbe-6'>
            <Logo />
          </Link>
          <div className='flex flex-col gap-5'>
            <div>
              <div className='mp-auth-kicker'>Property platform access</div>
              <Typography variant='h4' className='mp-auth-title'>{`Welcome back to ${themeConfig.templateName}`}</Typography>
              <Typography className='mp-auth-lead'>
                Sign in with email/password or phone OTP to manage properties, tenants, and rent collection.
              </Typography>
            </div>
            <div className='mp-auth-benefits'>
              <span className='mp-auth-benefit'>Fast rent follow-up</span>
              <span className='mp-auth-benefit'>Tenant messaging</span>
              <span className='mp-auth-benefit'>Portfolio reporting</span>
            </div>

            {errorMessage && (
              <Alert id={formStatusId} severity='error' className='mp-auth-alert' variant='tonal'>
                {errorMessage}
              </Alert>
            )}
            {!errorMessage && authMessage && (
              <Alert id={formStatusId} severity='info' className='mp-auth-alert' variant='tonal'>
                {authMessage}
              </Alert>
            )}
            {infoMessage && (
              <Alert id={formStatusId} severity='success' className='mp-auth-alert' variant='tonal'>
                {infoMessage}
              </Alert>
            )}

            <form noValidate autoComplete='off' onSubmit={handleSubmit} className='flex flex-col gap-5' aria-describedby={formDescribedBy}>
              <TextField
                autoFocus
                fullWidth
                id='login-identifier'
                label='Email or Phone Number'
                value={identifier}
                onChange={e => handleIdentifierChange(e.target.value)}
                error={Boolean(fieldErrors.identifier)}
                helperText={fieldErrors.identifier || ' '}
                className={fieldErrors.identifier ? 'mp-error-shake' : undefined}
                FormHelperTextProps={{ id: 'login-identifier-help', className: 'mp-field-helper' }}
                inputProps={{ 'aria-describedby': 'login-identifier-help' }}
              />
              <TextField
                fullWidth
                label='Password (email login)'
                id='login-password'
                type={isPasswordShown ? 'text' : 'password'}
                value={password}
                onChange={e => handlePasswordChange(e.target.value)}
                error={Boolean(fieldErrors.password)}
                helperText={fieldErrors.password || 'Use this only when signing in with email.'}
                className={fieldErrors.password ? 'mp-error-shake' : undefined}
                FormHelperTextProps={{ id: 'login-password-help', className: 'mp-field-helper' }}
                inputProps={{ 'aria-describedby': 'login-password-help' }}
                InputProps={{
                  endAdornment: (
                    <InputAdornment position='end'>
                      <IconButton
                        size='small'
                        edge='end'
                        onClick={handleClickShowPassword}
                        onMouseDown={event => event.preventDefault()}
                      >
                        <i className={isPasswordShown ? 'ri-eye-off-line' : 'ri-eye-line'} />
                      </IconButton>
                    </InputAdornment>
                  )
                }}
              />
              <div className='flex justify-between items-center gap-x-3 gap-y-1 flex-wrap'>
                <FormControlLabel control={<Checkbox id='keep-signed-in' />} label='Keep me signed in' />
                <Typography className='text-end' color='primary' component={Link} href='/forgot-password'>
                  Forgot password?
                </Typography>
              </div>
              <Button fullWidth variant='contained' type='submit' disabled={isSubmitting}>
                {isSubmitting ? <CircularProgress size={20} color='inherit' /> : 'Sign In'}
              </Button>
              <div className='flex justify-center items-center flex-wrap gap-2'>
                <Typography>Need a new account?</Typography>
                <Typography component={Link} href='/register' color='primary'>
                  Register as Landlord, Agent, or Tenant
                </Typography>
              </div>
              <Divider className='gap-3'>or continue with</Divider>
              <div className='mp-auth-social-row'>
                <IconButton
                  size='small'
                  className='text-googlePlus mp-auth-social-button'
                  onClick={() => handleOAuthSignIn('google')}
                  aria-label='Continue with Google'
                >
                  <i className='ri-google-fill' />
                </IconButton>
                <IconButton
                  size='small'
                  className='text-facebook mp-auth-social-button'
                  onClick={() => handleOAuthSignIn('facebook')}
                  aria-label='Continue with Facebook'
                >
                  <i className='ri-facebook-fill' />
                </IconButton>
                <IconButton
                  size='small'
                  className='text-github mp-auth-social-button'
                  onClick={() => handleOAuthSignIn('github')}
                  aria-label='Continue with GitHub'
                >
                  <i className='ri-github-fill' />
                </IconButton>
              </div>
              <Typography className='mp-auth-footnote'>
                Your workspace stays role-aware, so each sign-in lands you in the right operational view.
              </Typography>
            </form>
          </div>
        </CardContent>
      </Card>
      <Illustrations maskImg={{ src: authBackground }} />
    </div>
  )
}

export default Login
