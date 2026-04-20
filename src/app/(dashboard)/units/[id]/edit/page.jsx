'use client'

import { useEffect, useState } from 'react'

import { useParams, useRouter, useSearchParams } from 'next/navigation'

import Alert from '@mui/material/Alert'
import CircularProgress from '@mui/material/CircularProgress'
import Grid from '@mui/material/Grid'
import Typography from '@mui/material/Typography'

import UnitForm from '@components/UnitForm'
import { uploadUnitMedia } from '@/libs/property/uploadUnitMedia'

const UnitsEditPage = () => {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const unitId = String(params?.id || '')

  const [initialValues, setInitialValues] = useState(null)
  const [plotOptions, setPlotOptions] = useState([])
  const [existingMedia, setExistingMedia] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [deletingMediaId, setDeletingMediaId] = useState('')
  const [settingPrimaryMediaId, setSettingPrimaryMediaId] = useState('')
  const [uploadProgress, setUploadProgress] = useState(0)
  const [mediaActionError, setMediaActionError] = useState('')

  useEffect(() => {
    if (searchParams?.get('media') === 'retry') {
      setMediaActionError('Unit was created, but photo linking did not complete. Upload photos again here.')
    }
  }, [searchParams])

  useEffect(() => {
    if (!unitId) {
      setLoadError('Missing unit id.')
      setIsLoading(false)

      return
    }

    let isMounted = true

    const loadPageData = async () => {
      setIsLoading(true)
      setLoadError('')

      const [unitResponse, plotsResponse, mediaResponse] = await Promise.all([
        fetch(`/api/modules/units/${unitId}`, {
          method: 'GET',
          cache: 'no-store'
        }),
        fetch('/api/modules/properties', {
          method: 'GET',
          cache: 'no-store'
        }),
        fetch(`/api/modules/units/${unitId}/media`, {
          method: 'GET',
          cache: 'no-store'
        })
      ])

      const unitBody = await unitResponse.json().catch(() => ({}))
      const plotsBody = await plotsResponse.json().catch(() => ({}))
      const mediaBody = await mediaResponse.json().catch(() => ({}))

      if (!isMounted) {
        return
      }

      if (!unitResponse.ok) {
        setLoadError(unitBody?.error || 'Unable to load unit.')
        setIsLoading(false)

        return
      }

      const options = (plotsBody?.rows || [])
        .map(row => ({
          value: row.plotId,
          label: row.name ? `${row.plotId} - ${row.name}` : row.plotId
        }))
        .filter(option => option.value)

      setPlotOptions(options)
      setInitialValues({
        unitId: unitBody?.row?.unitId || '',
        plotId: unitBody?.row?.plotId || '',
        category: unitBody?.row?.category || '',
        rent: unitBody?.row?.rent ?? '',
        status: unitBody?.row?.status || 'vacant',
        stage: unitBody?.row?.stage || 'open',
        description: unitBody?.row?.description || '',
        amenities: unitBody?.row?.amenities || [],
        isListed: unitBody?.row?.isListed !== false
      })
      setExistingMedia(Array.isArray(mediaBody?.items) ? mediaBody.items : [])
      setIsLoading(false)
    }

    loadPageData()

    return () => {
      isMounted = false
    }
  }, [unitId])

  const handleDeleteExistingMedia = async mediaId => {
    if (!mediaId) {
      return
    }

    setDeletingMediaId(mediaId)
    setMediaActionError('')

    const response = await fetch(`/api/modules/units/${unitId}/media/${mediaId}`, {
      method: 'DELETE'
    })

    const body = await response.json().catch(() => ({}))

    if (!response.ok) {
      setMediaActionError(body?.error || 'Unable to delete photo.')
      setDeletingMediaId('')

      return
    }

    setExistingMedia(prev => prev.filter(item => item.id !== mediaId))
    setDeletingMediaId('')
  }

  const handleSetPrimaryExistingMedia = async mediaId => {
    if (!mediaId) {
      return
    }

    setSettingPrimaryMediaId(mediaId)
    setMediaActionError('')

    const response = await fetch(`/api/modules/units/${unitId}/media/${mediaId}`, {
      method: 'PATCH'
    })

    const body = await response.json().catch(() => ({}))

    if (!response.ok) {
      setMediaActionError(body?.error || 'Unable to set primary photo.')
      setSettingPrimaryMediaId('')

      return
    }

    setExistingMedia(prev =>
      prev.map(item => ({
        ...item,
        is_primary: item.id === mediaId
      }))
    )
    setSettingPrimaryMediaId('')
  }

  const handleSubmit = async (values, photoFiles) => {
    setUploadProgress(0)
    setMediaActionError('')

    const response = await fetch(`/api/modules/units/${unitId}`, {
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
        error: body?.error || 'Unable to update unit.'
      }
    }

    if (photoFiles?.length) {
      try {
        await uploadUnitMedia({
          unitId,
          files: photoFiles,
          onProgress: progress => setUploadProgress(progress)
        })
      } catch (error) {
        setMediaActionError(error?.message || 'Unit updated, but some photos failed to upload.')
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
        {isLoading ? (
          <div className='flex items-center gap-2'>
            <CircularProgress size={22} />
            <Typography>Loading unit...</Typography>
          </div>
        ) : loadError ? (
          <Alert severity='error' variant='tonal'>
            {loadError}
          </Alert>
        ) : (
          <UnitForm
            title='Edit Unit'
            description='Update unit details, rent, and booking stage.'
            submitLabel='Save Changes'
            cancelHref='/units'
            initialValues={initialValues}
            plotOptions={plotOptions}
            existingMedia={existingMedia}
            deletingMediaId={deletingMediaId}
            settingPrimaryMediaId={settingPrimaryMediaId}
            uploadProgress={uploadProgress}
            mediaActionError={mediaActionError}
            onDeleteExistingMedia={handleDeleteExistingMedia}
            onSetPrimaryExistingMedia={handleSetPrimaryExistingMedia}
            onSubmit={handleSubmit}
          />
        )}
      </Grid>
    </Grid>
  )
}

export default UnitsEditPage
