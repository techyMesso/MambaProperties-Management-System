'use client'

import { useEffect, useState } from 'react'

import Link from 'next/link'

import Alert from '@mui/material/Alert'
import Autocomplete from '@mui/material/Autocomplete'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import CircularProgress from '@mui/material/CircularProgress'
import Grid from '@mui/material/Grid'
import MenuItem from '@mui/material/MenuItem'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'

const DEFAULT_VALUES = {
  plotId: '',
  name: '',
  location: '',
  manager: '',
  availabilityStatus: 'vacant'
}

const DEFAULT_LOCATION_OPTIONS = [
  'Nairobi, Kilimani',
  'Nairobi, Westlands',
  'Nairobi, South B',
  'Nairobi, South C',
  'Nairobi, Kileleshwa',
  'Nairobi, Lavington',
  'Nairobi, Kasarani',
  'Nairobi, Ruaka',
  'Nairobi, Ruiru',
  'Mombasa, Nyali',
  'Kisumu, Milimani',
  'Nakuru, CBD'
]

const toValues = values => ({
  ...DEFAULT_VALUES,
  ...(values || {})
})

const validate = values => {
  const errors = {}

  if (!String(values.name || '').trim()) {
    errors.name = 'Estate name is required.'
  }

  if (!String(values.location || '').trim()) {
    errors.location = 'Location is required.'
  }

  if (!String(values.manager || '').trim()) {
    errors.manager = 'Manager name is required.'
  }

  return errors
}

const PropertyForm = ({
  title,
  description,
  submitLabel,
  cancelHref = '/properties',
  initialValues,
  onSubmit
}) => {
  const [formValues, setFormValues] = useState(toValues(initialValues))
  const [fieldErrors, setFieldErrors] = useState({})
  const [submitError, setSubmitError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [locationOptions, setLocationOptions] = useState(DEFAULT_LOCATION_OPTIONS)
  const [loadingLocations, setLoadingLocations] = useState(false)

  useEffect(() => {
    setFormValues(toValues(initialValues))
    setFieldErrors({})
    setSubmitError('')
  }, [initialValues])

  useEffect(() => {
    let isMounted = true

    const loadLocations = async () => {
      setLoadingLocations(true)

      const response = await fetch('/api/modules/properties', {
        method: 'GET',
        cache: 'no-store'
      })

      const body = await response.json().catch(() => ({}))

      if (!isMounted) {
        return
      }

      const liveLocations = (body?.rows || []).map(row => String(row?.location || '').trim()).filter(Boolean)
      const initialLocation = String(initialValues?.location || '').trim()
      const merged = [...new Set([initialLocation, ...liveLocations, ...DEFAULT_LOCATION_OPTIONS].filter(Boolean))]

      setLocationOptions(merged)
      setLoadingLocations(false)
    }

    loadLocations()

    return () => {
      isMounted = false
    }
  }, [initialValues?.location])

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
        setSubmitError(result?.error || 'Unable to save property.')
      }
    } catch (error) {
      setSubmitError(error?.message || 'Unable to save property.')
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
                label='Plot ID (optional)'
                placeholder='Auto generated if empty'
                value={formValues.plotId}
                onChange={event => handleFieldChange('plotId', event.target.value)}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                required
                label='Estate Name'
                value={formValues.name}
                onChange={event => handleFieldChange('name', event.target.value)}
                error={Boolean(fieldErrors.name)}
                helperText={fieldErrors.name}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <Autocomplete
                freeSolo
                options={locationOptions}
                value={formValues.location}
                onInputChange={(_event, value) => handleFieldChange('location', value)}
                onChange={(_event, value) => handleFieldChange('location', typeof value === 'string' ? value : String(value || ''))}
                renderInput={params => (
                  <TextField
                    {...params}
                    fullWidth
                    required
                    label='Location'
                    placeholder='e.g. Nairobi, Kilimani'
                    error={Boolean(fieldErrors.location)}
                    helperText={fieldErrors.location || 'Autocomplete from existing properties + common locations.'}
                    InputProps={{
                      ...params.InputProps,
                      endAdornment: (
                        <>
                          {loadingLocations ? <CircularProgress color='inherit' size={18} /> : null}
                          {params.InputProps.endAdornment}
                        </>
                      )
                    }}
                  />
                )}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                required
                label='Manager'
                value={formValues.manager}
                onChange={event => handleFieldChange('manager', event.target.value)}
                error={Boolean(fieldErrors.manager)}
                helperText={fieldErrors.manager}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                select
                fullWidth
                required
                label='Availability Status'
                value={formValues.availabilityStatus}
                onChange={event => handleFieldChange('availabilityStatus', event.target.value)}
              >
                <MenuItem value='vacant'>vacant</MenuItem>
                <MenuItem value='occupied'>occupied</MenuItem>
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

export default PropertyForm
