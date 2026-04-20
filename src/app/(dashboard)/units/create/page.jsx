'use client'

import { useEffect, useState } from 'react'

import { useRouter } from 'next/navigation'

import Alert from '@mui/material/Alert'
import Grid from '@mui/material/Grid'

import UnitForm from '@components/UnitForm'
import { attachUnitMedia, uploadUnitMediaFiles } from '@/libs/property/uploadUnitMedia'

const UnitsCreatePage = () => {
  const router = useRouter()
  const [plotOptions, setPlotOptions] = useState([])
  const [loadingPlots, setLoadingPlots] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [uploadProgress, setUploadProgress] = useState(0)
  const [mediaActionError, setMediaActionError] = useState('')

  useEffect(() => {
    let isMounted = true

    const loadPlots = async () => {
      setLoadingPlots(true)
      setLoadError('')

      const response = await fetch('/api/modules/properties', {
        method: 'GET',
        cache: 'no-store'
      })

      const body = await response.json().catch(() => ({}))

      if (!isMounted) {
        return
      }

      if (!response.ok) {
        setLoadError(body?.error || 'Unable to load plots.')
        setLoadingPlots(false)

        return
      }

      const options = (body?.rows || [])
        .map(row => ({
          value: row.plotId,
          label: row.name ? `${row.plotId} - ${row.name}` : row.plotId
        }))
        .filter(option => option.value)

      setPlotOptions(options)
      setLoadingPlots(false)
    }

    loadPlots()

    return () => {
      isMounted = false
    }
  }, [])

  const handleSubmit = async (values, photoFiles) => {
    setUploadProgress(0)
    setMediaActionError('')
    let stagedPaths = []

    if (photoFiles?.length) {
      try {
        stagedPaths = await uploadUnitMediaFiles({
          files: photoFiles,
          onProgress: progress => setUploadProgress(Math.min(90, Math.round(progress * 0.9)))
        })
      } catch (error) {
        return {
          ok: false,
          error: error?.message || 'Unable to upload unit photos. Please retry before creating the unit.'
        }
      }
    }

    const response = await fetch('/api/modules/units', {
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
        error: body?.error || 'Unable to create unit.'
      }
    }

    const recordId = body?.recordId

    let mediaLinked = true

    if (recordId && stagedPaths.length) {
      try {
        await attachUnitMedia({
          unitId: recordId,
          paths: stagedPaths
        })

        setUploadProgress(100)
      } catch (error) {
        mediaLinked = false
        setMediaActionError(error?.message || 'Unit created, but linking uploaded photos failed. Open unit edit and re-attach.')
      }
    }

    if (recordId && !mediaLinked) {
      router.push(`/units/${recordId}/edit?media=retry`)
      router.refresh()

      return {
        ok: true
      }
    }

    router.push('/units')
    router.refresh()

    return {
      ok: true
    }
  }

  return (
    <Grid container spacing={6}>
      <Grid item xs={12}>
        {loadError ? (
          <Alert className='mbe-4' severity='error' variant='tonal'>
            {loadError}
          </Alert>
        ) : null}
        <UnitForm
          title='Add Unit'
          description='Create a new house or unit under an existing plot.'
          submitLabel='Create Unit'
          cancelHref='/units'
          plotOptions={plotOptions}
          loadingPlots={loadingPlots}
          uploadProgress={uploadProgress}
          mediaActionError={mediaActionError}
          onSubmit={handleSubmit}
        />
      </Grid>
    </Grid>
  )
}

export default UnitsCreatePage
