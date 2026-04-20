'use client'

import { useEffect, useMemo, useState } from 'react'

import Link from 'next/link'
import Image from 'next/image'

import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Chip from '@mui/material/Chip'
import Grid from '@mui/material/Grid'
import LinearProgress from '@mui/material/LinearProgress'
import MenuItem from '@mui/material/MenuItem'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'

const UNIT_CATEGORY_OPTIONS = ['Bedsitter', '1BR', '2BR', '3BR', 'Shop', 'Office', 'Studio']
const IMAGE_MIME_PREFIX = 'image/'
const MAX_PHOTOS = 10

const DEFAULT_VALUES = {
  unitId: '',
  plotId: '',
  category: '',
  rent: '',
  status: 'vacant',
  stage: 'open',
  description: '',
  amenities: '',
  isListed: true
}

const toValues = values => ({
  ...DEFAULT_VALUES,
  ...(values || {})
})

const toArray = value => {
  if (Array.isArray(value)) {
    return value
  }

  if (value && typeof value.length === 'number') {
    return Array.from(value)
  }

  return []
}

const toAmenityInput = value => {
  if (Array.isArray(value)) {
    return value.join(', ')
  }

  return String(value || '')
}

const getImageFiles = files =>
  toArray(files)
    .filter(file => file instanceof File)
    .filter(file => String(file.type || '').startsWith(IMAGE_MIME_PREFIX))

const validate = values => {
  const errors = {}
  const rentValue = Number(values.rent)

  if (!String(values.plotId || '').trim()) {
    errors.plotId = 'Plot is required.'
  }

  if (!String(values.category || '').trim()) {
    errors.category = 'Category is required.'
  }

  if (!Number.isFinite(rentValue) || rentValue < 0) {
    errors.rent = 'Rent must be a valid non-negative number.'
  }

  return errors
}

const UnitForm = ({
  title,
  description,
  submitLabel,
  cancelHref = '/units',
  initialValues,
  plotOptions = [],
  loadingPlots = false,
  existingMedia = [],
  mediaActionError = '',
  deletingMediaId = '',
  settingPrimaryMediaId = '',
  uploadProgress = 0,
  onDeleteExistingMedia,
  onSetPrimaryExistingMedia,
  onSubmit
}) => {
  const [formValues, setFormValues] = useState(toValues(initialValues))
  const [fieldErrors, setFieldErrors] = useState({})
  const [submitError, setSubmitError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [selectedPhotoFiles, setSelectedPhotoFiles] = useState([])

  const previewItems = useMemo(
    () =>
      selectedPhotoFiles.map(file => ({
        key: `${file.name}-${file.size}-${file.lastModified}`,
        file,
        url: URL.createObjectURL(file)
      })),
    [selectedPhotoFiles]
  )

  useEffect(
    () => () => {
      previewItems.forEach(item => URL.revokeObjectURL(item.url))
    },
    [previewItems]
  )

  useEffect(() => {
    setFormValues({
      ...toValues(initialValues),
      amenities: toAmenityInput(initialValues?.amenities)
    })
    setFieldErrors({})
    setSubmitError('')
    setSelectedPhotoFiles([])
  }, [initialValues])

  const normalizedPlotOptions = useMemo(
    () =>
      (plotOptions || [])
        .filter(option => String(option.value || '').trim())
        .map(option => ({
          value: String(option.value).trim(),
          label: String(option.label || option.value).trim()
        })),
    [plotOptions]
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

  const pushFiles = files => {
    const imageFiles = getImageFiles(files)

    if (!imageFiles.length) {
      return
    }

    setSelectedPhotoFiles(prev => {
      const merged = [...prev, ...imageFiles]
      const deduped = []
      const seen = new Set()

      for (const file of merged) {
        const key = `${file.name}-${file.size}-${file.lastModified}`

        if (seen.has(key)) {
          continue
        }

        seen.add(key)
        deduped.push(file)

        if (deduped.length >= MAX_PHOTOS) {
          break
        }
      }

      return deduped
    })
  }

  const handleFileInput = event => {
    pushFiles(event.target.files)
    event.target.value = ''
  }

  const removeSelectedPhoto = key => {
    setSelectedPhotoFiles(prev => prev.filter(file => `${file.name}-${file.size}-${file.lastModified}` !== key))
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
      const payloadValues = {
        ...formValues,
        isListed: formValues.isListed === true || formValues.isListed === 'true'
      }

      const result = await onSubmit?.(payloadValues, selectedPhotoFiles)

      if (!result?.ok) {
        setSubmitError(result?.error || 'Unable to save unit.')
      } else {
        setSelectedPhotoFiles([])
      }
    } catch (error) {
      setSubmitError(error?.message || 'Unable to save unit.')
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

        {mediaActionError ? (
          <Alert className='mbe-4' severity='error' variant='tonal'>
            {mediaActionError}
          </Alert>
        ) : null}

        {isSubmitting && uploadProgress > 0 ? (
          <Box className='mbe-4'>
            <div className='flex items-center justify-between mbe-1'>
              <Typography variant='body2' color='text.secondary'>
                Uploading photos
              </Typography>
              <Typography variant='body2' color='text.secondary'>
                {uploadProgress}%
              </Typography>
            </div>
            <LinearProgress variant='determinate' value={uploadProgress} />
          </Box>
        ) : null}

        <form onSubmit={handleSubmit}>
          <Grid container spacing={4}>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label='Unit ID (optional)'
                placeholder='Auto generated if empty'
                value={formValues.unitId}
                onChange={event => handleFieldChange('unitId', event.target.value)}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                select
                fullWidth
                required
                label='Plot'
                value={formValues.plotId}
                onChange={event => handleFieldChange('plotId', event.target.value)}
                error={Boolean(fieldErrors.plotId)}
                helperText={fieldErrors.plotId || (loadingPlots ? 'Loading plots...' : '')}
                disabled={loadingPlots}
              >
                {normalizedPlotOptions.map(option => (
                  <MenuItem key={option.value} value={option.value}>
                    {option.label}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                select
                fullWidth
                required
                label='Category'
                value={formValues.category}
                onChange={event => handleFieldChange('category', event.target.value)}
                error={Boolean(fieldErrors.category)}
                helperText={fieldErrors.category}
              >
                {UNIT_CATEGORY_OPTIONS.map(option => (
                  <MenuItem key={option} value={option}>
                    {option}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                required
                label='Rent (KES)'
                type='number'
                value={formValues.rent}
                onChange={event => handleFieldChange('rent', event.target.value)}
                error={Boolean(fieldErrors.rent)}
                helperText={fieldErrors.rent}
                inputProps={{
                  min: 0
                }}
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
                <MenuItem value='vacant'>vacant</MenuItem>
                <MenuItem value='occupied'>occupied</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                select
                fullWidth
                required
                label='Booking Stage'
                value={formValues.stage}
                onChange={event => handleFieldChange('stage', event.target.value)}
              >
                <MenuItem value='open'>open</MenuItem>
                <MenuItem value='scheduled'>scheduled</MenuItem>
                <MenuItem value='pending'>pending</MenuItem>
                <MenuItem value='booked'>booked</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                multiline
                minRows={2}
                label='Description'
                value={formValues.description}
                onChange={event => handleFieldChange('description', event.target.value)}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label='Amenities (comma separated)'
                placeholder='WiFi, Parking, Balcony'
                value={formValues.amenities}
                onChange={event => handleFieldChange('amenities', event.target.value)}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                select
                fullWidth
                required
                label='Listed in Marketplace'
                value={formValues.isListed ? 'true' : 'false'}
                onChange={event => handleFieldChange('isListed', event.target.value === 'true')}
              >
                <MenuItem value='true'>Yes</MenuItem>
                <MenuItem value='false'>No</MenuItem>
              </TextField>
            </Grid>

            <Grid item xs={12}>
              <Box
                onDragOver={event => {
                  event.preventDefault()
                  setIsDragging(true)
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={event => {
                  event.preventDefault()
                  setIsDragging(false)
                  pushFiles(event.dataTransfer?.files)
                }}
                className={`border rounded p-4 ${isDragging ? 'border-primary bg-actionHover' : 'border-divider'}`}
              >
                <Typography variant='subtitle2' className='mbe-2'>
                  Unit Photos
                </Typography>
                <Typography variant='body2' color='text.secondary' className='mbe-3'>
                  Drag and drop photos here, or browse files. Maximum {MAX_PHOTOS} photos.
                </Typography>
                <Button component='label' variant='outlined' disabled={selectedPhotoFiles.length >= MAX_PHOTOS}>
                  Choose Photos
                  <input hidden type='file' accept='image/*' multiple onChange={handleFileInput} />
                </Button>
              </Box>
            </Grid>

            {existingMedia.length > 0 ? (
              <Grid item xs={12}>
                <Typography variant='subtitle2' className='mbe-2'>
                  Existing Photos
                </Typography>
                <Grid container spacing={3}>
                  {existingMedia.map(media => (
                    <Grid item xs={12} sm={6} md={4} key={media.id}>
                      <Card variant='outlined' className='mp-dashboard-kpi'>
                        <CardContent>
                          {media.url ? (
                            <div style={{ position: 'relative', width: '100%', height: 160, borderRadius: 8, overflow: 'hidden' }}>
                              <Image
                                src={media.url}
                                alt={media.caption || 'Unit photo'}
                                fill
                                sizes='(max-width: 900px) 100vw, 33vw'
                                unoptimized
                                style={{ objectFit: 'cover' }}
                              />
                            </div>
                          ) : (
                            <div className='flex items-center justify-center h-[160px] bg-actionHover rounded'>
                              <Typography variant='body2' color='text.secondary'>
                                Preview unavailable
                              </Typography>
                            </div>
                          )}
                          <div className='flex items-center justify-between mt-3'>
                            <Chip label={media.is_primary ? 'Primary' : 'Photo'} size='small' variant='tonal' color='info' />
                            <div className='flex items-center gap-1'>
                              <Button
                                variant='text'
                                size='small'
                                disabled={!onSetPrimaryExistingMedia || media.is_primary || settingPrimaryMediaId === media.id}
                                onClick={() => onSetPrimaryExistingMedia?.(media.id)}
                              >
                                {settingPrimaryMediaId === media.id ? 'Saving...' : media.is_primary ? 'Primary' : 'Set Primary'}
                              </Button>
                              <Button
                                variant='text'
                                color='error'
                                size='small'
                                disabled={!onDeleteExistingMedia || deletingMediaId === media.id}
                                onClick={() => onDeleteExistingMedia?.(media.id)}
                              >
                                {deletingMediaId === media.id ? 'Deleting...' : 'Delete'}
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </Grid>
                  ))}
                </Grid>
              </Grid>
            ) : null}

            {previewItems.length > 0 ? (
              <Grid item xs={12}>
                <Typography variant='subtitle2' className='mbe-2'>
                  New Photos ({previewItems.length})
                </Typography>
                <Grid container spacing={3}>
                  {previewItems.map(item => (
                    <Grid item xs={12} sm={6} md={4} key={item.key}>
                      <Card variant='outlined' className='mp-dashboard-kpi'>
                        <CardContent>
                          <div style={{ position: 'relative', width: '100%', height: 160, borderRadius: 8, overflow: 'hidden' }}>
                            <Image
                              src={item.url}
                              alt={item.file.name}
                              fill
                              sizes='(max-width: 900px) 100vw, 33vw'
                              unoptimized
                              style={{ objectFit: 'cover' }}
                            />
                          </div>
                          <div className='flex items-center justify-between mt-3'>
                            <Typography variant='body2' className='truncate'>
                              {item.file.name}
                            </Typography>
                            <Button variant='text' color='error' size='small' onClick={() => removeSelectedPhoto(item.key)}>
                              Remove
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    </Grid>
                  ))}
                </Grid>
              </Grid>
            ) : null}

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

export default UnitForm
