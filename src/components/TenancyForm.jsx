'use client'

import { useEffect, useMemo, useState } from 'react'

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
  agreementId: '',
  tenant: '',
  unit: '',
  moveIn: '',
  moveOut: '',
  status: 'pending'
}

const toValues = values => ({
  ...DEFAULT_VALUES,
  ...(values || {})
})

const validate = values => {
  const errors = {}

  if (!String(values.tenant || '').trim()) {
    errors.tenant = 'Tenant is required.'
  }

  if (!String(values.unit || '').trim()) {
    errors.unit = 'Unit is required.'
  }

  if (!String(values.moveIn || '').trim()) {
    errors.moveIn = 'Move-in date is required.'
  }

  return errors
}

const TenancyForm = ({
  title,
  description,
  submitLabel,
  cancelHref = '/tenancies',
  initialValues,
  tenantOptions = [],
  unitOptions = [],
  initialAgreementFileName = '',
  onSubmit
}) => {
  const [formValues, setFormValues] = useState(toValues(initialValues))
  const [fieldErrors, setFieldErrors] = useState({})
  const [submitError, setSubmitError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [agreementFile, setAgreementFile] = useState(null)

  useEffect(() => {
    setFormValues(toValues(initialValues))
    setFieldErrors({})
    setSubmitError('')
    setAgreementFile(null)
  }, [initialValues])

  const tenantsByName = useMemo(
    () =>
      [...new Set((tenantOptions || []).map(item => String(item || '').trim()).filter(Boolean))].sort((left, right) =>
        left.localeCompare(right)
      ),
    [tenantOptions]
  )

  const unitsByCode = useMemo(
    () =>
      [...new Set((unitOptions || []).map(item => String(item || '').trim()).filter(Boolean))].sort((left, right) =>
        left.localeCompare(right)
      ),
    [unitOptions]
  )

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
      const result = await onSubmit?.(formValues, agreementFile)

      if (!result?.ok) {
        setSubmitError(result?.error || 'Unable to save tenancy mapping.')
      }
    } catch (error) {
      setSubmitError(error?.message || 'Unable to save tenancy mapping.')
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
                label='Agreement ID (optional)'
                value={formValues.agreementId}
                onChange={event => handleFieldChange('agreementId', event.target.value)}
                placeholder='Auto generated if empty'
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                select
                fullWidth
                required
                label='Tenant'
                value={formValues.tenant}
                onChange={event => handleFieldChange('tenant', event.target.value)}
                error={Boolean(fieldErrors.tenant)}
                helperText={fieldErrors.tenant}
              >
                {tenantsByName.map(name => (
                  <MenuItem key={name} value={name}>
                    {name}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                select
                fullWidth
                required
                label='Unit'
                value={formValues.unit}
                onChange={event => handleFieldChange('unit', event.target.value)}
                error={Boolean(fieldErrors.unit)}
                helperText={fieldErrors.unit}
              >
                {unitsByCode.map(code => (
                  <MenuItem key={code} value={code}>
                    {code}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid item xs={12} md={3}>
              <TextField
                fullWidth
                required
                type='date'
                label='Move-In Date'
                InputLabelProps={{ shrink: true }}
                value={formValues.moveIn}
                onChange={event => handleFieldChange('moveIn', event.target.value)}
                error={Boolean(fieldErrors.moveIn)}
                helperText={fieldErrors.moveIn}
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <TextField
                fullWidth
                type='date'
                label='Move-Out Date'
                InputLabelProps={{ shrink: true }}
                value={formValues.moveOut}
                onChange={event => handleFieldChange('moveOut', event.target.value)}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                select
                fullWidth
                required
                label='Status'
                value={formValues.status}
                onChange={event => handleFieldChange('status', event.target.value)}
              >
                <MenuItem value='active'>active</MenuItem>
                <MenuItem value='pending'>pending</MenuItem>
                <MenuItem value='move-out scheduled'>move-out scheduled</MenuItem>
                <MenuItem value='terminated'>terminated</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={12}>
              <Button component='label' variant='outlined'>
                {agreementFile ? 'Replace Agreement File' : 'Upload Agreement File (optional)'}
                <input
                  hidden
                  type='file'
                  accept='.pdf,.png,.jpg,.jpeg,.webp,.doc,.docx'
                  onChange={event => setAgreementFile(event.target.files?.[0] || null)}
                />
              </Button>
              <Typography className='mte-2' variant='body2' color='text.secondary'>
                {agreementFile?.name || initialAgreementFileName || 'No agreement file selected.'}
              </Typography>
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

export default TenancyForm
