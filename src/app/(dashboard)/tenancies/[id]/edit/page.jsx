'use client'

import { useEffect, useState } from 'react'

import { useParams, useRouter } from 'next/navigation'

import Alert from '@mui/material/Alert'
import CircularProgress from '@mui/material/CircularProgress'
import Grid from '@mui/material/Grid'
import Typography from '@mui/material/Typography'

import TenancyForm from '@components/TenancyForm'
import { uploadTenancyAgreement } from '@/libs/property/uploadTenancyAgreement'

const TenanciesEditPage = () => {
  const params = useParams()
  const router = useRouter()
  const tenancyId = String(params?.id || '')

  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [initialValues, setInitialValues] = useState(null)
  const [tenants, setTenants] = useState([])
  const [units, setUnits] = useState([])

  useEffect(() => {
    if (!tenancyId) {
      setLoadError('Missing tenancy id.')
      setIsLoading(false)

      return
    }

    let isMounted = true

    const loadPageData = async () => {
      setIsLoading(true)
      setLoadError('')

      const [tenancyResponse, tenantResponse, unitResponse] = await Promise.all([
        fetch(`/api/modules/tenancies/${tenancyId}`, {
          method: 'GET',
          cache: 'no-store'
        }),
        fetch('/api/modules/tenants', {
          method: 'GET',
          cache: 'no-store'
        }),
        fetch('/api/modules/units', {
          method: 'GET',
          cache: 'no-store'
        })
      ])

      const tenancyBody = await tenancyResponse.json().catch(() => ({}))
      const tenantBody = await tenantResponse.json().catch(() => ({}))
      const unitBody = await unitResponse.json().catch(() => ({}))

      if (!isMounted) {
        return
      }

      if (!tenancyResponse.ok) {
        setLoadError(tenancyBody?.error || 'Unable to load tenancy.')
        setIsLoading(false)

        return
      }

      const row = tenancyBody?.row || {}

      setInitialValues({
        agreementId: row.agreementId || '',
        tenant: row.tenant || '',
        unit: row.unit || '',
        moveIn: row.moveIn || '',
        moveOut: row.moveOut || '',
        status: row.status || 'pending'
      })
      setTenants((tenantBody?.rows || []).map(item => String(item?.tenant || '').trim()).filter(Boolean))
      setUnits((unitBody?.rows || []).map(item => String(item?.unitId || '').trim()).filter(Boolean))
      setIsLoading(false)
    }

    loadPageData()

    return () => {
      isMounted = false
    }
  }, [tenancyId])

  const handleSubmit = async (values, agreementFile) => {
    const response = await fetch(`/api/modules/tenancies/${tenancyId}`, {
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
        error: body?.error || 'Unable to update tenancy.'
      }
    }

    if (agreementFile instanceof File && agreementFile.size) {
      try {
        await uploadTenancyAgreement({
          agreementId: values.agreementId,
          tenantName: values.tenant,
          file: agreementFile
        })
      } catch {
        // Update succeeded; agreement upload can be retried.
      }
    }

    router.push('/tenancies')
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
            <Typography>Loading tenancy mapping...</Typography>
          </div>
        ) : loadError ? (
          <Alert severity='error' variant='tonal'>
            {loadError}
          </Alert>
        ) : (
          <TenancyForm
            title='Edit Tenant-House Mapping'
            description='Update tenancy dates, status, and upload a new agreement file if needed.'
            submitLabel='Save Changes'
            cancelHref='/tenancies'
            initialValues={initialValues}
            tenantOptions={tenants}
            unitOptions={units}
            initialAgreementFileName={initialValues?.agreementId ? `${initialValues.agreementId} agreement` : ''}
            onSubmit={handleSubmit}
          />
        )}
      </Grid>
    </Grid>
  )
}

export default TenanciesEditPage
