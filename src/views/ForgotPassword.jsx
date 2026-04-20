'use client'

import { useState } from 'react'

// Next Imports
import Link from 'next/link'

// MUI Imports
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Typography from '@mui/material/Typography'
import TextField from '@mui/material/TextField'
import Button from '@mui/material/Button'

// Component Imports
import Form from '@components/Form'
import DirectionalIcon from '@components/DirectionalIcon'
import Illustrations from '@components/Illustrations'
import Logo from '@components/layout/shared/Logo'

// Hook Imports
import { useImageVariant } from '@core/hooks/useImageVariant'
import Alert from '@mui/material/Alert'
import CircularProgress from '@mui/material/CircularProgress'

const ForgotPassword = ({ mode }) => {
  const [email, setEmail] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Vars
  const darkImg = '/images/pages/auth-v1-mask-dark.png'
  const lightImg = '/images/pages/auth-v1-mask-light.png'

  // Hooks
  const authBackground = useImageVariant(mode, lightImg, darkImg)

  const handleSubmit = async event => {
    event.preventDefault()
    setErrorMessage('')
    setSuccessMessage('')

    const normalizedEmail = String(email || '').trim()

    if (!normalizedEmail) {
      setErrorMessage('Email address is required.')

      return
    }

    setIsSubmitting(true)

    try {
      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email: normalizedEmail
        })
      })

      const body = await response.json().catch(() => ({}))

      if (!response.ok) {
        setErrorMessage(body?.error || 'Unable to send reset instructions right now.')
      } else {
        setSuccessMessage(body?.message || 'If an account exists for that email, a reset link has been sent.')
      }
    } catch {
      setSuccessMessage('If an account exists for that email, a reset link has been sent.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className='mp-auth-shell'>
      <Card className='mp-auth-card flex flex-col sm:is-[490px]'>
        <CardContent className='p-6 sm:!p-12'>
          <Link href='/' className='flex justify-center items-center mbe-6'>
            <Logo />
          </Link>
          <Typography variant='h4'>Reset Password</Typography>
          <div className='flex flex-col gap-5'>
            <Typography className='mbs-1'>
              Enter your email and we&#39;ll send you instructions to reset your password
            </Typography>
            {errorMessage ? <Alert severity='error'>{errorMessage}</Alert> : null}
            {successMessage ? <Alert severity='success'>{successMessage}</Alert> : null}
            <Form noValidate autoComplete='off' className='flex flex-col gap-5' onSubmit={handleSubmit}>
              <TextField autoFocus fullWidth label='Email' value={email} onChange={event => setEmail(event.target.value)} />
              <Button fullWidth variant='contained' type='submit' disabled={isSubmitting}>
                {isSubmitting ? <CircularProgress size={20} color='inherit' /> : 'Send reset link'}
              </Button>
              <Typography className='flex justify-center items-center' color='primary'>
                <Link href='/login' className='flex items-center'>
                  <DirectionalIcon ltrIconClass='ri-arrow-left-s-line' rtlIconClass='ri-arrow-right-s-line' />
                  <span>Back to Login</span>
                </Link>
              </Typography>
            </Form>
          </div>
        </CardContent>
      </Card>
      <Illustrations maskImg={{ src: authBackground }} />
    </div>
  )
}

export default ForgotPassword
