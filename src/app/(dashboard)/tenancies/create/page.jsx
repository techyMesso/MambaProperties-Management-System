'use client'

import { useEffect, useMemo, useState } from 'react'

import { useRouter, useSearchParams } from 'next/navigation'

import Alert from '@mui/material/Alert'
import Grid from '@mui/material/Grid'

import TenancyForm from '@components/TenancyForm'
import { uploadTenancyAgreement } from '@/libs/property/uploadTenancyAgreement'

const TenanciesCreatePage = () => {
  const router = useRouter()
  const searchParams = useSearchParams()

  const prefilledTenant = String(searchParams?.get('tenant') || '').trim()
  const prefilledUnit = String(searchParams?.get('unit') || '').trim()

  const [tenants, setTenants] = useState([])
  const [units, setUnits] = useState([])
  const [loadError, setLoadError] = useState('')

  useEffect(() => {
    let isMounted = true

    const loadOptions = async () => {
      setLoadError('')

      const [tenantResponse, unitResponse] = await Promise.all([
        fetch('/api/modules/tenants', {
          method: 'GET',
          cache: 'no-store'
        }),
        fetch('/api/modules/units', {
          method: 'GET',
          cache: 'no-store'
        })
      ])

      const tenantBody = await tenantResponse.json().catch(() => ({}))
      const unitBody = await unitResponse.json().catch(() => ({}))

      if (!isMounted) {
        return
      }

      if (!tenantResponse.ok || !unitResponse.ok) {
        setLoadError(tenantBody?.error || unitBody?.error || 'Unable to load tenant/unit options.')

        return
      }

      setTenants((tenantBody?.rows || []).map(row => String(row?.tenant || '').trim()).filter(Boolean))
      setUnits((unitBody?.rows || []).map(row => String(row?.unitId || '').trim()).filter(Boolean))
    }

    loadOptions()

    return () => {
      isMounted = false
    }
  }, [])

  const initialValues = useMemo(
    () => ({
      tenant: prefilledTenant,
      unit: prefilledUnit
    }),
    [prefilledTenant, prefilledUnit]
  )

  const handleSubmit = async (values, agreementFile) => {
    const response = await fetch('/api/modules/tenancies', {
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
        error: body?.error || 'Unable to create tenancy mapping.'
      }
    }

    const recordId = body?.recordId
    let agreementId = String(values?.agreementId || '').trim()

    if (!agreementId && recordId) {
      const readResponse = await fetch(`/api/modules/tenancies/${recordId}`, {
        method: 'GET',
        cache: 'no-store'
      })

      const readBody = await readResponse.json().catch(() => ({}))

      if (readResponse.ok) {
        agreementId = String(readBody?.row?.agreementId || '').trim()
      }
    }

    if (agreementFile instanceof File && agreementFile.size) {
      try {
        await uploadTenancyAgreement({
          agreementId,
          tenantName: values.tenant,
          file: agreementFile
        })
      } catch {
        // Mapping was created successfully; agreement upload can be retried from edit flow.
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
        {loadError ? (
          <Alert className='mbe-4' severity='error' variant='tonal'>
            {loadError}
          </Alert>
        ) : null}
        <TenancyForm
          title='Create Tenant-House Mapping'
          description='Link a tenant to a specific unit and optionally upload agreement documentation.'
          submitLabel='Create Mapping'
          cancelHref='/tenancies'
          initialValues={initialValues}
          tenantOptions={tenants}
          unitOptions={units}
          onSubmit={handleSubmit}
        />
      </Grid>
    </Grid>
  )
}

export default TenanciesCreatePage
