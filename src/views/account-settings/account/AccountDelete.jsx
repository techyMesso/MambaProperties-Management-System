'use client'

import { useMemo, useState } from 'react'

import { useRouter } from 'next/navigation'

import Alert from '@mui/material/Alert'
import Card from '@mui/material/Card'
import CardHeader from '@mui/material/CardHeader'
import CardContent from '@mui/material/CardContent'
import FormControlLabel from '@mui/material/FormControlLabel'
import Checkbox from '@mui/material/Checkbox'
import Button from '@mui/material/Button'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import MenuItem from '@mui/material/MenuItem'

import { useAuthSession } from '@/contexts/auth-session-context'

const DEACTIVATION_PHRASE = 'DEACTIVATE MY ACCOUNT'
const CONFIRM_DEACTIVATE = 'deactivate'
const CONFIRM_KEEP = 'keep'

const REASON_OPTIONS = [
  { value: 'not_useful', label: 'I am not finding the app useful' },
  { value: 'too_expensive', label: 'Subscription cost is too high' },
  { value: 'found_alternative', label: 'I found an alternative platform' },
  { value: 'privacy_concerns', label: 'I have privacy or security concerns' },
  { value: 'technical_issues', label: 'I am facing technical issues' },
  { value: 'other', label: 'Other reason' }
]

const AccountDelete = () => {
  const router = useRouter()
  const { supabase } = useAuthSession()
  const [confirmed, setConfirmed] = useState(false)
  const [confirmationChoice, setConfirmationChoice] = useState('')
  const [reasonChoice, setReasonChoice] = useState('')
  const [otherReason, setOtherReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const isConfirmMatched = useMemo(() => confirmationChoice === CONFIRM_DEACTIVATE, [confirmationChoice])

  const isReasonValid = useMemo(
    () => Boolean(reasonChoice) && (reasonChoice !== 'other' || Boolean(otherReason.trim())),
    [reasonChoice, otherReason]
  )

  const canSubmit = confirmed && isConfirmMatched && isReasonValid && !submitting

  const handleSubmit = async event => {
    event.preventDefault()

    if (!canSubmit) {
      return
    }

    setSubmitting(true)
    setError('')
    setSuccess('')

    try {
      const response = await fetch('/api/account/deactivate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          acknowledged: confirmed,
          confirmation: DEACTIVATION_PHRASE,
          reason:
            reasonChoice === 'other'
              ? otherReason.trim() || null
              : REASON_OPTIONS.find(option => option.value === reasonChoice)?.label || null
        })
      })

      const payload = await response.json().catch(() => ({}))

      if (!response.ok) {
        setError(payload?.error || 'Unable to deactivate account.')
        setSubmitting(false)

        return
      }

      setSuccess('Account deactivated. Redirecting to login...')

      if (supabase) {
        await Promise.allSettled([supabase.auth.signOut({ scope: 'local' }), supabase.auth.signOut({ scope: 'global' })])
      }
    } catch {
      setError('Unable to deactivate account.')
      setSubmitting(false)

      return
    }

    router.replace('/login?deactivated=1')
    router.refresh()
  }

  return (
    <Card>
      <CardHeader title='Delete Account' />
      <CardContent>
        <form onSubmit={handleSubmit} className='flex flex-col items-start gap-4'>
          <Typography color='text.secondary'>
            This action is irreversible and will block this account from signing in.
          </Typography>
          <Typography variant='body2' color='text.secondary'>
            Select confirmation and reason to proceed with account deletion.
          </Typography>
          {error ? (
            <Alert severity='error' variant='tonal' className='w-full'>
              {error}
            </Alert>
          ) : null}
          {success ? (
            <Alert severity='success' variant='tonal' className='w-full'>
              {success}
            </Alert>
          ) : null}
          <TextField
            fullWidth
            select
            label='Delete Confirmation'
            value={confirmationChoice}
            onChange={event => setConfirmationChoice(event.target.value)}
          >
            <MenuItem value=''>Select confirmation</MenuItem>
            <MenuItem value={CONFIRM_KEEP}>Keep my account</MenuItem>
            <MenuItem value={CONFIRM_DEACTIVATE}>Yes, delete my account</MenuItem>
          </TextField>
          <TextField
            fullWidth
            select
            label='Reason for deleting account'
            value={reasonChoice}
            onChange={event => setReasonChoice(event.target.value)}
          >
            <MenuItem value=''>Select a reason</MenuItem>
            {REASON_OPTIONS.map(option => (
              <MenuItem key={option.value} value={option.value}>
                {option.label}
              </MenuItem>
            ))}
          </TextField>
          {reasonChoice === 'other' ? (
            <TextField
              fullWidth
              multiline
              minRows={2}
              maxRows={4}
              label='Other reason'
              value={otherReason}
              onChange={event => setOtherReason(event.target.value)}
            />
          ) : null}
          <Typography variant='body2' color='text.secondary'>
            Backend confirmation phrase: <strong>{DEACTIVATION_PHRASE}</strong>
          </Typography>
          <FormControlLabel
            control={<Checkbox checked={confirmed} onChange={event => setConfirmed(event.target.checked)} />}
            label='I understand this account will be blocked and cannot sign in again.'
          />
          <Button variant='contained' color='error' type='submit' disabled={!canSubmit}>
            {submitting ? 'Deactivating...' : 'Deactivate Account'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}

export default AccountDelete
