'use client'

import { useRouter } from 'next/navigation'

import Grid from '@mui/material/Grid'

import PropertyForm from '@components/PropertyForm'

const PropertiesCreatePage = () => {
  const router = useRouter()

  const handleSubmit = async values => {
    const response = await fetch('/api/modules/properties', {
      method: 'POST',
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
        error: body?.error || 'Unable to create plot.'
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
        <PropertyForm
          title='Register Plot'
          description='Create a property profile with location and manager assignment.'
          submitLabel='Create Plot'
          cancelHref='/properties'
          onSubmit={handleSubmit}
        />
      </Grid>
    </Grid>
  )
}

export default PropertiesCreatePage
