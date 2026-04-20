'use client'

import { useRouter } from 'next/navigation'

import Grid from '@mui/material/Grid'

import TenantForm from '@components/TenantForm'

const TenantsCreatePage = () => {
  const router = useRouter()

  const handleSubmit = async values => {
    const { portalEmail, ...payload } = values || {}

    const response = await fetch('/api/modules/tenants', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        values: payload
      })
    })

    const body = await response.json().catch(() => ({}))

    if (!response.ok) {
      return {
        ok: false,
        error: body?.error || 'Unable to create tenant.'
      }
    }

    if (portalEmail) {
      const portalResponse = await fetch('/api/tenants/portal-access', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          tenantId: body?.recordId,
          tenantEmail: portalEmail
        })
      })

      if (!portalResponse.ok) {
        const portalBody = await portalResponse.json().catch(() => ({}))

        return {
          ok: false,
          error: portalBody?.error || 'Tenant created, but portal access could not be granted.'
        }
      }
    }

    router.push('/tenants')
    router.refresh()

    return {
      ok: true
    }
  }

  return (
    <Grid container spacing={6}>
      <Grid item xs={12}>
        <TenantForm
          title='Add Tenant'
          description='Create a tenant profile and optionally assign a unit code.'
          submitLabel='Create Tenant'
          cancelHref='/tenants'
          onSubmit={handleSubmit}
        />
      </Grid>
    </Grid>
  )
}

export default TenantsCreatePage
