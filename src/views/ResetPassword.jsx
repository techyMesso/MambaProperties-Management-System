'use client'

import { useEffect, useMemo, useState } from 'react'

import Link from 'next/link'
import { useRouter } from 'next/navigation'

import Alert from '@mui/material/Alert'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import CircularProgress from '@mui/material/CircularProgress'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'

import Illustrations from '@components/Illustrations'
import Logo from '@components/layout/shared/Logo'
import { useImageVariant } from '@core/hooks/useImageVariant'
import { createBrowserSupabaseClient } from '@/libs/supabase'

const isStrongPassword = value => {
  const text = String(value || '')

  return text.length >= 12 && /[a-z]/.test(text) && /[A-Z]/.test(text) && /\d/.test(text)
}

const ResetPassword = ({ mode }) => {
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isReady, setIsReady] = useState(false)

  const darkImg = '/images/pages/auth-v1-mask-dark.png'
  const lightImg = '/images/pages/auth-v1-mask-light.png'

  const router = useRouter()
  const authBackground = useImageVariant(mode, lightImg, darkImg)
  const supabase = useMemo(() => createBrowserSupabaseClient(), [])

  useEffect(() => {
    let isActive = true

    const bootstrap = async () => {
      if (!supabase) {
        if (isActive) {
          setErrorMessage('Supabase is not configured.')
          setIsReady(true)
        }

        return
      }

      const {
        data: { session }
      } = await supabase.auth.getSession()

      if (!isActive) {
        return
      }

      if (!session?.user) {
        setErrorMessage('Recovery session is missing or expired. Request a fresh reset link.')
      }

      setIsReady(true)
    }

    bootstrap()

    return () => {
      isActive = false
    }
  }, [supabase])

  const handleSubmit = async event => {
    event.preventDefault()
    setErrorMessage('')
    setSuccessMessage('')

    if (!isStrongPassword(newPassword)) {
      setErrorMessage('Password must be at least 12 characters and include uppercase, lowercase, and a number.')

      return
    }

    if (confirmPassword !== newPassword) {
      setErrorMessage('Password confirmation does not match.')

      return
    }

    if (!supabase) {
      setErrorMessage('Supabase is not configured.')

      return
    }

    setIsSubmitting(true)

    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      })

      if (error) {
        throw error
      }

      setSuccessMessage('Password updated successfully. Redirecting to login...')
      window.setTimeout(() => {
        router.replace('/login?message=Password reset successful. Please sign in.')
      }, 1200)
    } catch {
      setErrorMessage('Unable to reset password. Request a fresh reset link and try again.')
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
          <Typography variant='h4'>Choose a New Password</Typography>
          <div className='flex flex-col gap-5'>
            <Typography className='mbs-1'>Finish the recovery flow with a strong new password.</Typography>
            {errorMessage ? <Alert severity='error'>{errorMessage}</Alert> : null}
            {successMessage ? <Alert severity='success'>{successMessage}</Alert> : null}
            <form noValidate autoComplete='off' onSubmit={handleSubmit} className='flex flex-col gap-5'>
              <TextField
                autoFocus
                fullWidth
                required
                type='password'
                label='New Password'
                value={newPassword}
                onChange={event => setNewPassword(event.target.value)}
                disabled={!isReady || isSubmitting}
              />
              <TextField
                fullWidth
                required
                type='password'
                label='Confirm Password'
                value={confirmPassword}
                onChange={event => setConfirmPassword(event.target.value)}
                disabled={!isReady || isSubmitting}
              />
              <Typography variant='body2' color='text.secondary'>
                Use at least 12 characters with uppercase, lowercase, and a number.
              </Typography>
              <Button fullWidth variant='contained' type='submit' disabled={!isReady || isSubmitting}>
                {isSubmitting ? <CircularProgress size={20} color='inherit' /> : 'Update password'}
              </Button>
            </form>
          </div>
        </CardContent>
      </Card>
      <Illustrations maskImg={{ src: authBackground }} />
    </div>
  )
}

export default ResetPassword
