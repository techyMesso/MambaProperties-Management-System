'use client'

import { useRouter } from 'next/navigation'

import TenantForm from '@components/TenantForm'

const TenantEditFormClient = ({ tenantId, initialValues }) => {
  const router = useRouter()

  const handleSubmit = async values => {
    const { portalEmail, ...payload } = values || {}

    const response = await fetch(`/api/modules/tenants/${tenantId}`, {
      method: 'PUT',
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
        error: body?.error || 'Unable to update tenant.'
      }
    }

    if (portalEmail) {
      const portalResponse = await fetch('/api/tenants/portal-access', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          tenantId,
          tenantEmail: portalEmail
        })
      })

      if (!portalResponse.ok) {
        const portalBody = await portalResponse.json().catch(() => ({}))

        return {
          ok: false,
          error: portalBody?.error || 'Tenant updated, but portal access could not be granted.'
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
    <TenantForm
      title='Edit Tenant'
      description='Update tenant details and linked unit.'
      submitLabel='Save Changes'
      cancelHref='/tenants'
      initialValues={initialValues}
      onSubmit={handleSubmit}
    />
  )
}

export default TenantEditFormClient
