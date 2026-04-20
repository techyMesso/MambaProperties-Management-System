'use client'

import { useEffect, useState } from 'react'

import { useParams, useRouter } from 'next/navigation'

import Alert from '@mui/material/Alert'
import CircularProgress from '@mui/material/CircularProgress'
import Grid from '@mui/material/Grid'
import Typography from '@mui/material/Typography'

import PropertyForm from '@components/PropertyForm'

const PropertiesEditPage = () => {
  const params = useParams()
  const router = useRouter()
  const propertyId = String(params?.id || '')

  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [initialValues, setInitialValues] = useState(null)

  useEffect(() => {
    if (!propertyId) {
      setLoadError('Missing property id.')
      setIsLoading(false)

      return
    }

    let isMounted = true

    const loadProperty = async () => {
      setIsLoading(true)
      setLoadError('')

      const response = await fetch(`/api/modules/properties/${propertyId}`, {
        method: 'GET',
        cache: 'no-store'
      })

      const body = await response.json().catch(() => ({}))

      if (!isMounted) {
        return
      }

      if (!response.ok) {
        setLoadError(body?.error || 'Unable to load property.')
        setIsLoading(false)

        return
      }

      setInitialValues({
        plotId: body?.row?.plotId || '',
        name: body?.row?.name || '',
        location: body?.row?.location || '',
        manager: body?.row?.manager || '',
        availabilityStatus: body?.row?.availabilityStatus || 'vacant'
      })
      setIsLoading(false)
    }

    loadProperty()

    return () => {
      isMounted = false
    }
  }, [propertyId])

  const handleSubmit = async values => {
    const response = await fetch(`/api/modules/properties/${propertyId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        values
      })
    })

    const body = await response.json().catch(() => ({}))

    if (!response.ok) {
      return {
        ok: false,
        error: body?.error || 'Unable to update plot.'
      }
    }

    router.push('/properties')
    router.refresh()

    return {
      ok: true
    }
  }

  return (
    <Grid container spacing={6}>
      <Grid item xs={12}>
        {isLoading ? (
          <div className='flex items-center gap-2'>
            <CircularProgress size={22} />
            <Typography>Loading property...</Typography>
          </div>
        ) : loadError ? (
          <Alert severity='error' variant='tonal'>
            {loadError}
          </Alert>
        ) : (
          <PropertyForm
            title='Edit Plot'
            description='Update property details and occupancy status.'
            submitLabel='Save Changes'
            cancelHref='/properties'
            initialValues={initialValues}
            onSubmit={handleSubmit}
          />
        )}
      </Grid>
    </Grid>
  )
}

export default PropertiesEditPage
