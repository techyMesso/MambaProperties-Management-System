'use client'

import { useEffect, useState } from 'react'

import Link from 'next/link'
import Image from 'next/image'

import { useParams } from 'next/navigation'

import Alert from '@mui/material/Alert'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Chip from '@mui/material/Chip'
import CircularProgress from '@mui/material/CircularProgress'
import Grid from '@mui/material/Grid'
import Typography from '@mui/material/Typography'

const formatKES = value => {
  const amount = Number(value)

  if (!Number.isFinite(amount)) {
    return 'KES 0'
  }

  return `KES ${Math.round(amount).toLocaleString('en-KE')}`
}

const toArray = value => (Array.isArray(value) ? value : [])

const UnitsDetailPage = () => {
  const params = useParams()
  const unitId = String(params?.id || '')

  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [mediaActionError, setMediaActionError] = useState('')
  const [deletingMediaId, setDeletingMediaId] = useState('')
  const [settingPrimaryMediaId, setSettingPrimaryMediaId] = useState('')
  const [unit, setUnit] = useState(null)
  const [mediaItems, setMediaItems] = useState([])

  useEffect(() => {
    if (!unitId) {
      setLoadError('Missing unit id.')
      setIsLoading(false)

      return
    }

    let isMounted = true

    const load = async () => {
      setIsLoading(true)
      setLoadError('')

      const response = await fetch(`/api/modules/units/${unitId}/media`, {
        method: 'GET',
        cache: 'no-store'
      })

      const body = await response.json().catch(() => ({}))

      if (!isMounted) {
        return
      }

      if (!response.ok) {
        setLoadError(body?.error || 'Unable to load unit details.')
        setIsLoading(false)

        return
      }

      setUnit(body?.unit || null)
      setMediaItems(toArray(body?.items))
      setIsLoading(false)
    }

    load()

    return () => {
      isMounted = false
    }
  }, [unitId])

  const handleDeleteMedia = async mediaId => {
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

    setMediaItems(prev => prev.filter(item => item.id !== mediaId))
    setDeletingMediaId('')
  }

  const handleSetPrimaryMedia = async mediaId => {
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

    setMediaItems(prev =>
      prev.map(item => ({
        ...item,
        is_primary: item.id === mediaId
      }))
    )
    setSettingPrimaryMediaId('')
  }

  if (isLoading) {
    return (
      <div className='flex items-center gap-2'>
        <CircularProgress size={22} />
        <Typography>Loading unit details...</Typography>
      </div>
    )
  }

  if (loadError) {
    return (
      <Alert severity='error' variant='tonal'>
        {loadError}
      </Alert>
    )
  }

  return (
    <Grid container spacing={6}>
      <Grid item xs={12}>
        <Card className='mp-dashboard-hero'>
          <CardContent className='flex flex-col gap-4 md:flex-row md:items-center md:justify-between'>
            <div>
              <Typography variant='h4'>{unit?.unitId || 'Unit Detail'}</Typography>
              <Typography className='text-textSecondary'>
                {unit?.plotId} • {unit?.category} • {formatKES(unit?.rent)}
              </Typography>
            </div>
            <div className='flex flex-wrap gap-3'>
              <Button component={Link} href='/units' variant='outlined'>
                Back to Units
              </Button>
              <Button component={Link} href={`/units/${unitId}/edit`} variant='contained'>
                Edit Unit
              </Button>
            </div>
          </CardContent>
        </Card>
      </Grid>

      <Grid item xs={12} md={8}>
        <Card className='mp-dashboard-section'>
          <CardContent>
            <Typography variant='h5' className='mbe-3'>
              Unit Profile
            </Typography>
            <div className='flex flex-wrap gap-2 mbe-3'>
              <Chip label={unit?.status || 'unknown'} variant='tonal' color='info' />
              <Chip label={unit?.stage || 'open'} variant='tonal' color='secondary' />
              <Chip label={unit?.isListed ? 'Listed' : 'Not Listed'} variant='tonal' color={unit?.isListed ? 'success' : 'default'} />
            </div>
            <Typography variant='body2' color='text.secondary' className='mbe-2'>
              Description
            </Typography>
            <Typography className='mbe-4'>{unit?.description || 'No description provided.'}</Typography>
            <Typography variant='body2' color='text.secondary' className='mbe-2'>
              Amenities
            </Typography>
            <div className='flex flex-wrap gap-2'>
              {toArray(unit?.amenities).length ? (
                toArray(unit?.amenities).map(item => (
                  <Chip key={String(item)} label={String(item)} size='small' variant='outlined' />
                ))
              ) : (
                <Typography color='text.secondary'>No amenities provided.</Typography>
              )}
            </div>
          </CardContent>
        </Card>
      </Grid>

      <Grid item xs={12} md={4}>
        <Card className='mp-dashboard-kpi'>
          <CardContent>
            <Typography variant='h5' className='mbe-2'>
              Photos
            </Typography>
            <Typography color='text.secondary'>{mediaItems.length} uploaded</Typography>
          </CardContent>
        </Card>
      </Grid>

      <Grid item xs={12}>
        <Card className='mp-dashboard-section'>
          <CardContent>
            {mediaActionError ? (
              <Alert className='mbe-4' severity='error' variant='tonal'>
                {mediaActionError}
              </Alert>
            ) : null}

            {mediaItems.length === 0 ? (
              <Typography color='text.secondary'>No photos uploaded for this unit yet.</Typography>
            ) : (
              <Grid container spacing={4}>
                {mediaItems.map(item => (
                  <Grid item xs={12} sm={6} md={4} key={item.id}>
                    <Card variant='outlined' className='mp-dashboard-kpi'>
                      <CardContent>
                        {item.url ? (
                          <div style={{ position: 'relative', width: '100%', height: 220, borderRadius: 8, overflow: 'hidden' }}>
                            <Image
                              src={item.url}
                              alt={item.caption || 'Unit photo'}
                              fill
                              sizes='(max-width: 900px) 100vw, 33vw'
                              unoptimized
                              style={{ objectFit: 'cover' }}
                            />
                          </div>
                        ) : (
                          <div className='flex items-center justify-center h-[220px] rounded bg-actionHover'>
                            <Typography color='text.secondary'>Preview unavailable</Typography>
                          </div>
                        )}
                        <div className='flex items-center justify-between mt-3'>
                          <Chip label={item.is_primary ? 'Primary' : 'Photo'} size='small' variant='tonal' color='info' />
                          <div className='flex items-center gap-1'>
                            <Button
                              variant='text'
                              size='small'
                              disabled={item.is_primary || settingPrimaryMediaId === item.id}
                              onClick={() => handleSetPrimaryMedia(item.id)}
                            >
                              {settingPrimaryMediaId === item.id ? 'Saving...' : item.is_primary ? 'Primary' : 'Set Primary'}
                            </Button>
                            <Button
                              variant='text'
                              color='error'
                              size='small'
                              disabled={deletingMediaId === item.id}
                              onClick={() => handleDeleteMedia(item.id)}
                            >
                              {deletingMediaId === item.id ? 'Deleting...' : 'Delete'}
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </Grid>
                ))}
              </Grid>
            )}
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  )
}

export default UnitsDetailPage
