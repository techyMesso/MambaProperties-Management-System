import Alert from '@mui/material/Alert'
import Grid from '@mui/material/Grid'

import TenantEditFormClient from '@components/TenantEditFormClient'
import { getModuleDefinition } from '@/libs/property/modules'
import { createClient as createServerSupabaseClient } from '@/libs/supabase/server'

const toInitialValues = row => ({
  tenant: row?.tenant || '',
  phone: row?.phone || '',
  occupation: row?.occupation || '',
  unit: row?.unit || '',
  paymentStatus: row?.paymentStatus || 'pending',
  portalEmail: ''
})

const TenantsEditPage = async ({ params }) => {
  const resolvedParams = params ? await params : {}
  const tenantId = String(resolvedParams?.id || '')
  const definition = getModuleDefinition('tenants')

  let loadError = ''
  let initialValues = null

  if (!tenantId) {
    loadError = 'Missing tenant id.'
  } else if (!definition) {
    loadError = 'Tenant module is not configured.'
  } else {
    const supabase = await createServerSupabaseClient()

    if (!supabase) {
      loadError = 'Supabase is not configured.'
    } else {
      const {
        data: { user }
      } = await supabase.auth.getUser()

      if (!user?.id) {
        loadError = 'You need to sign in to edit tenants.'
      } else {
        const { data, error } = await supabase.from(definition.table).select(definition.select).eq('id', tenantId).maybeSingle()

        if (error) {
          loadError = error.message || 'Unable to load tenant.'
        } else if (!data) {
          loadError = 'Tenant not found.'
        } else {
          initialValues = toInitialValues(data)
        }
      }
    }
  }

  return (
    <Grid container spacing={6}>
      <Grid item xs={12}>
        {loadError ? <Alert severity='error' variant='tonal'>{loadError}</Alert> : <TenantEditFormClient tenantId={tenantId} initialValues={initialValues} />}
      </Grid>
    </Grid>
  )
}

export default TenantsEditPage
