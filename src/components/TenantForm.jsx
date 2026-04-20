'use client'

import { useEffect, useState } from 'react'

import Link from 'next/link'

import Alert from '@mui/material/Alert'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Grid from '@mui/material/Grid'
import MenuItem from '@mui/material/MenuItem'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'

const DEFAULT_VALUES = {
  tenant: '',
  phone: '',
  occupation: '',
  unit: '',
  paymentStatus: 'pending',
  portalEmail: ''
}

const toValues = values => ({
  ...DEFAULT_VALUES,
  ...(values || {})
})

const validate = values => {
  const errors = {}

  if (!String(values.tenant || '').trim()) {
    errors.tenant = 'Tenant name is required.'
  }

  if (!String(values.phone || '').trim()) {
    errors.phone = 'Phone number is required.'
  }

  return errors
}

const TenantForm = ({ title, description, submitLabel, cancelHref = '/tenants', initialValues, onSubmit }) => {
  const [formValues, setFormValues] = useState(toValues(initialValues))
  const [fieldErrors, setFieldErrors] = useState({})
  const [submitError, setSubmitError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    setFormValues(toValues(initialValues))
    setFieldErrors({})
    setSubmitError('')
  }, [initialValues])

  const handleFieldChange = (name, value) => {
    setFormValues(prev => ({
      ...prev,
      [name]: value
    }))

    if (fieldErrors[name]) {
      setFieldErrors(prev => {
        const next = { ...prev }

        delete next[name]

        return next
      })
    }
  }

  const handleSubmit = async event => {
    event.preventDefault()

    const validationErrors = validate(formValues)

    setFieldErrors(validationErrors)
    setSubmitError('')

    if (Object.keys(validationErrors).length > 0) {
      return
    }

    setIsSubmitting(true)

    try {
      const result = await onSubmit?.(formValues)

      if (!result?.ok) {
        setSubmitError(result?.error || 'Unable to save tenant.')
      }
    } catch (error) {
      setSubmitError(error?.message || 'Unable to save tenant.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Card className='mp-dashboard-section'>
      <CardContent>
        <Typography variant='h5'>{title}</Typography>
        {description ? (
          <Typography className='text-textSecondary mbe-6' variant='body2'>
            {description}
          </Typography>
        ) : null}

        {submitError ? (
          <Alert className='mbe-4' severity='error' variant='tonal'>
            {submitError}
          </Alert>
        ) : null}

        <form onSubmit={handleSubmit}>
          <Grid container spacing={4}>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                required
                label='Tenant Name'
                value={formValues.tenant}
                onChange={event => handleFieldChange('tenant', event.target.value)}
                error={Boolean(fieldErrors.tenant)}
                helperText={fieldErrors.tenant}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                required
                label='Phone Number'
                value={formValues.phone}
                onChange={event => handleFieldChange('phone', event.target.value)}
                error={Boolean(fieldErrors.phone)}
                helperText={fieldErrors.phone}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label='Occupation'
                value={formValues.occupation}
                onChange={event => handleFieldChange('occupation', event.target.value)}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label='Assigned Unit (optional)'
                value={formValues.unit}
                onChange={event => handleFieldChange('unit', event.target.value)}
                placeholder='UNT-0001'
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label='Tenant Portal Email (optional)'
                value={formValues.portalEmail}
                onChange={event => handleFieldChange('portalEmail', event.target.value)}
                helperText='Enter the tenant account email to grant portal access for payments and statements.'
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                select
                fullWidth
                required
                label='Payment Status'
                value={formValues.paymentStatus}
                onChange={event => handleFieldChange('paymentStatus', event.target.value)}
              >
                <MenuItem value='paid'>paid</MenuItem>
                <MenuItem value='partial'>partial</MenuItem>
                <MenuItem value='arrears'>arrears</MenuItem>
                <MenuItem value='pending'>pending</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={12}>
              <div className='flex flex-wrap gap-3'>
                <Button type='submit' variant='contained' disabled={isSubmitting}>
                  {isSubmitting ? 'Saving...' : submitLabel}
                </Button>
                <Button component={Link} href={cancelHref} variant='outlined' disabled={isSubmitting}>
                  Cancel
                </Button>
              </div>
            </Grid>
          </Grid>
        </form>
      </CardContent>
    </Card>
  )
}

export default TenantForm
