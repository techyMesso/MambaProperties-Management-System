'use client'

import { useEffect, useMemo, useState } from 'react'

import Link from 'next/link'

import { useParams } from 'next/navigation'

import Alert from '@mui/material/Alert'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Chip from '@mui/material/Chip'
import CircularProgress from '@mui/material/CircularProgress'
import Grid from '@mui/material/Grid'
import Typography from '@mui/material/Typography'

import tableStyles from '@core/styles/table.module.css'

const formatKES = value => {
  const amount = Number(value)

  if (!Number.isFinite(amount)) {
    return 'KES 0'
  }

  return `KES ${Math.round(amount).toLocaleString('en-KE')}`
}

const toArray = value => (Array.isArray(value) ? value : [])

const PropertyDetailsPage = () => {
  const params = useParams()
  const propertyId = String(params?.id || '')

  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [property, setProperty] = useState(null)
  const [units, setUnits] = useState([])

  useEffect(() => {
    if (!propertyId) {
      setLoadError('Missing property id.')
      setIsLoading(false)

      return
    }

    let isMounted = true

    const load = async () => {
      setIsLoading(true)
      setLoadError('')

      const [propertyResponse, unitsResponse] = await Promise.all([
        fetch(`/api/modules/properties/${propertyId}`, {
          method: 'GET',
          cache: 'no-store'
        }),
        fetch('/api/modules/units', {
          method: 'GET',
          cache: 'no-store'
        })
      ])

      const propertyBody = await propertyResponse.json().catch(() => ({}))
      const unitsBody = await unitsResponse.json().catch(() => ({}))

      if (!isMounted) {
        return
      }

      if (!propertyResponse.ok) {
        setLoadError(propertyBody?.error || 'Unable to load property.')
        setIsLoading(false)

        return
      }

      const propertyRow = propertyBody?.row || null
      const allUnits = toArray(unitsBody?.rows)
      const relatedUnits = allUnits.filter(row => String(row?.plotId || '').trim() === String(propertyRow?.plotId || '').trim())

      setProperty(propertyRow)
      setUnits(relatedUnits)
      setIsLoading(false)
    }

    load()

    return () => {
      isMounted = false
    }
  }, [propertyId])

  const occupancy = useMemo(() => {
    const total = units.length
    const occupied = units.filter(unit => String(unit?.status || '').toLowerCase() === 'occupied').length
    const vacant = Math.max(0, total - occupied)

    return { total, occupied, vacant }
  }, [units])

  const rentSummary = useMemo(() => units.reduce((total, row) => total + (Number(row?.rent) || 0), 0), [units])

  if (isLoading) {
    return (
      <div className='flex items-center gap-2'>
        <CircularProgress size={22} />
        <Typography>Loading property details...</Typography>
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
              <Typography variant='h4'>{property?.name || property?.plotId || 'Property Detail'}</Typography>
              <Typography className='text-textSecondary'>
                {property?.plotId} • {property?.location || 'No location'} • Manager: {property?.manager || 'Unassigned'}
              </Typography>
            </div>
            <div className='flex flex-wrap gap-3'>
              <Button component={Link} href='/properties' variant='outlined'>
                Back to Properties
              </Button>
              <Button component={Link} href={`/properties/${propertyId}/edit`} variant='contained'>
                Edit Property
              </Button>
            </div>
          </CardContent>
        </Card>
      </Grid>

      <Grid item xs={12} sm={6} md={3}>
        <Card className='mp-dashboard-kpi'>
          <CardContent>
            <Typography color='text.secondary'>Total Units</Typography>
            <Typography variant='h4'>{occupancy.total}</Typography>
          </CardContent>
        </Card>
      </Grid>
      <Grid item xs={12} sm={6} md={3}>
        <Card className='mp-dashboard-kpi'>
          <CardContent>
            <Typography color='text.secondary'>Occupied</Typography>
            <Typography variant='h4'>{occupancy.occupied}</Typography>
          </CardContent>
        </Card>
      </Grid>
      <Grid item xs={12} sm={6} md={3}>
        <Card className='mp-dashboard-kpi'>
          <CardContent>
            <Typography color='text.secondary'>Vacant</Typography>
            <Typography variant='h4'>{occupancy.vacant}</Typography>
          </CardContent>
        </Card>
      </Grid>
      <Grid item xs={12} sm={6} md={3}>
        <Card className='mp-dashboard-kpi'>
          <CardContent>
            <Typography color='text.secondary'>Potential Rent</Typography>
            <Typography variant='h4'>{formatKES(rentSummary)}</Typography>
          </CardContent>
        </Card>
      </Grid>

      <Grid item xs={12}>
        <Card className='mp-dashboard-section'>
          <CardContent>
            <div className='flex items-center justify-between mbe-4'>
              <Typography variant='h5'>Units in {property?.plotId}</Typography>
              <Chip
                label={String(property?.availabilityStatus || 'vacant')}
                size='small'
                variant='tonal'
                color={String(property?.availabilityStatus || '').toLowerCase() === 'occupied' ? 'warning' : 'success'}
              />
            </div>

            <div className='overflow-x-auto'>
              <table className={tableStyles.table}>
                <thead>
                  <tr>
                    <th>Unit ID</th>
                    <th>Category</th>
                    <th>Rent</th>
                    <th>Status</th>
                    <th>Stage</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {units.length === 0 ? (
                    <tr>
                      <td colSpan={6}>
                        <Typography color='text.secondary'>No units found for this property.</Typography>
                      </td>
                    </tr>
                  ) : (
                    units.map(unit => (
                      <tr key={unit.id || unit.unitId}>
                        <td>{unit.unitId}</td>
                        <td>{unit.category}</td>
                        <td>{formatKES(unit.rent)}</td>
                        <td>{unit.status}</td>
                        <td>{unit.stage || 'open'}</td>
                        <td>
                          <div className='flex flex-wrap gap-2'>
                            <Button component={Link} href={unit.id ? `/units/${unit.id}` : '#'} size='small' variant='text' disabled={!unit.id}>
                              View
                            </Button>
                            <Button
                              component={Link}
                              href={unit.id ? `/units/${unit.id}/edit` : '#'}
                              size='small'
                              variant='text'
                              disabled={!unit.id}
                            >
                              Edit
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  )
}

export default PropertyDetailsPage
