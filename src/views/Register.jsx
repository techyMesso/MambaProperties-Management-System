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
import MenuItem from '@mui/material/MenuItem'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'

// Component Imports
import Illustrations from '@components/Illustrations'
import Logo from '@components/layout/shared/Logo'

// Hook Imports
import { useImageVariant } from '@core/hooks/useImageVariant'

// Lib Imports
import { USER_ROLES } from '@/libs/auth/roles'
import { createAuthPerfLogger } from '@/libs/auth/perf'

const isStrongPassword = value => {
  const text = String(value || '')

  return text.length >= 12 && /[a-z]/.test(text) && /[A-Z]/.test(text) && /\d/.test(text)
}

const toRegistrationErrorMessage = error => {
  const message = String(error?.message || '').trim().toLowerCase()

  if (!message) {
    return 'Unable to create account with those details.'
  }

  if (
    message.includes('already registered') ||
    message.includes('already exists') ||
    message.includes('invalid login credentials') ||
    message.includes('user already')
  ) {
    return 'Unable to create account with those details.'
  }

  return 'Unable to create account right now. Please try again later.'
}

const Register = ({ mode }) => {
  // States
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [phoneNumber, setPhoneNumber] = useState('')
  const [idNumber, setIdNumber] = useState('')
  const [occupation, setOccupation] = useState('')
  const [role, setRole] = useState(USER_ROLES.LANDLORD)
  const [password, setPassword] = useState('')
  const [acceptTerms, setAcceptTerms] = useState(false)
  const [isPasswordShown, setIsPasswordShown] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [successMessage, setSuccessMessage] = useState('')

  // Vars
  const darkImg = '/images/pages/auth-v1-mask-dark.png'
  const lightImg = '/images/pages/auth-v1-mask-light.png'

  // Hooks
  const router = useRouter()
  const searchParams = useSearchParams()
  const authBackground = useImageVariant(mode, lightImg, darkImg)
  const nextPath = useMemo(() => searchParams.get('next') || '', [searchParams])
  const formStatusId = 'register-form-status'
  const formDescribedBy = errorMessage || successMessage ? formStatusId : undefined

  const handleClickShowPassword = () => setIsPasswordShown(show => !show)

  const handleSubmit = async event => {
    const perf = createAuthPerfLogger('auth.register.submit', {
      requestedRole: role
    })

    let outcome = 'idle'
    let roleForLog = null

    event.preventDefault()

    setErrorMessage('')
    setSuccessMessage('')

    if (!fullName.trim()) {
      setErrorMessage('Full name is required.')

      return
    }

    if (!email.trim()) {
      setErrorMessage('Email address is required.')

      return
    }

    if (!password) {
      setErrorMessage('Password is required.')

      return
    }

    if (!isStrongPassword(password)) {
      setErrorMessage('Password must be at least 12 characters and include uppercase, lowercase, and a number.')

      return
    }

    if (!acceptTerms) {
      setErrorMessage('You must accept the terms and policies.')

      return
    }

    setIsSubmitting(true)

    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          fullName: fullName.trim(),
          email: email.trim(),
          phoneNumber: phoneNumber.trim() || null,
          idNumber: idNumber.trim() || null,
          occupation: occupation.trim() || null,
          role,
          password,
          acceptTerms
        })
      })

      const payload = await response.json().catch(() => ({}))

      perf.mark('signup-finished', { hasError: !response.ok, status: response.status })

      if (!response.ok) {
        throw new Error(payload?.error || 'Unable to create account with those details.')
      }

      if (payload?.authenticated) {
        const syncProfileResponse = await fetch('/api/auth/sync-profile', {
          method: 'POST',
          headers: perf.enabled ? { 'x-auth-perf': '1' } : undefined
        })

        perf.mark('sync-profile-response', { status: syncProfileResponse.status })

        const syncProfileData = await syncProfileResponse.json().catch(() => ({}))
        const redirectTo = syncProfileData?.redirectTo || ''

        outcome = 'redirect'
        roleForLog = syncProfileData?.role || null
        router.replace(nextPath || redirectTo || '/dashboard')

        return
      }

      setSuccessMessage(payload?.message || 'Account created. Check your email from MambaProperties to verify the account, then sign in.')
      outcome = 'pending_email_verification'
    } catch (error) {
      setErrorMessage(toRegistrationErrorMessage(error))
      outcome = 'error'
      perf.mark('submit-error', { message: error?.message || 'register_failed' })
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
      <Card className='mp-auth-card mp-auth-card-inner flex flex-col sm:is-[560px]'>
        <CardContent className='p-6 sm:!p-12'>
          <Link href='/' className='flex justify-center items-start mbe-6'>
            <Logo />
          </Link>
          <div className='flex flex-col gap-5'>
            <div>
              <div className='mp-auth-kicker'>Start your workspace</div>
              <Typography variant='h4' className='mp-auth-title'>Create your workspace</Typography>
              <Typography className='mp-auth-lead'>
                Start onboarding landlords, agents, and tenants with secure role-based access.
              </Typography>
            </div>
            <div className='mp-auth-benefits'>
              <span className='mp-auth-benefit'>Role-based onboarding</span>
              <span className='mp-auth-benefit'>KYC-ready account setup</span>
              <span className='mp-auth-benefit'>Works for teams and single landlords</span>
            </div>

            {errorMessage && (
              <Alert id={formStatusId} severity='error' className='mp-auth-alert' variant='tonal'>
                {errorMessage}
              </Alert>
            )}
            {successMessage && (
              <Alert id={formStatusId} severity='success' className='mp-auth-alert' variant='tonal'>
                {successMessage}
              </Alert>
            )}

            <form noValidate autoComplete='off' onSubmit={handleSubmit} className='flex flex-col gap-5' aria-describedby={formDescribedBy}>
              <TextField autoFocus fullWidth label='Full Name' value={fullName} onChange={event => setFullName(event.target.value)} />
              <TextField fullWidth label='Email Address' value={email} onChange={event => setEmail(event.target.value)} />
              <TextField
                fullWidth
                label='Phone Number'
                placeholder='+2547XXXXXXXX'
                value={phoneNumber}
                onChange={event => setPhoneNumber(event.target.value)}
              />
              <TextField
                fullWidth
                label='ID / Passport Number'
                value={idNumber}
                onChange={event => setIdNumber(event.target.value)}
              />
              <TextField fullWidth label='Occupation' value={occupation} onChange={event => setOccupation(event.target.value)} />
              <TextField select fullWidth label='Requested Account Role' value={role} onChange={event => setRole(event.target.value)}>
                <MenuItem value={USER_ROLES.LANDLORD}>Landlord</MenuItem>
                <MenuItem value={USER_ROLES.AGENT}>Agent</MenuItem>
                <MenuItem value={USER_ROLES.TENANT}>Tenant</MenuItem>
              </TextField>
              <TextField
                fullWidth
                label='Password'
                type={isPasswordShown ? 'text' : 'password'}
                value={password}
                onChange={event => setPassword(event.target.value)}
                helperText='Use at least 12 characters, with uppercase, lowercase, and a number.'
                FormHelperTextProps={{ className: 'mp-field-helper' }}
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
              <FormControlLabel
                control={<Checkbox checked={acceptTerms} onChange={event => setAcceptTerms(event.target.checked)} />}
                label={
                  <>
                    <span>I agree to platform </span>
                    <Link className='text-primary' href='/' onClick={event => event.preventDefault()}>
                      terms, policies, and KYC checks
                    </Link>
                  </>
                }
              />
              <Button fullWidth variant='contained' type='submit' disabled={isSubmitting}>
                {isSubmitting ? <CircularProgress size={20} color='inherit' /> : 'Create Account'}
              </Button>
              <div className='flex justify-center items-center flex-wrap gap-2'>
                <Typography>Already registered?</Typography>
                <Typography component={Link} href='/login' color='primary'>
                  Sign in
                </Typography>
              </div>
              <Divider className='gap-3'>Use login page for social sign-in</Divider>
              <Typography className='mp-auth-footnote'>
                Landlord and agent accounts can continue into approval and workspace provisioning after sign-up.
              </Typography>
            </form>
          </div>
        </CardContent>
      </Card>
      <Illustrations maskImg={{ src: authBackground }} />
    </div>
  )
}

export default Register
