const SystemSettingsPage = () => {
  return (
    <div className='grid gap-6'>
      <div className='mp-dashboard-hero rounded-xl border border-[var(--mui-palette-divider)] p-6'>
        <h4 className='text-xl font-semibold'>System Settings</h4>
        <p className='text-textSecondary mt-1'>
          Configure backup and restore controls, security policy defaults, and enforcement standards for the whole platform.
        </p>
      </div>

      <div className='grid gap-4 md:grid-cols-2'>
        <div className='rounded-xl border border-[var(--mui-palette-divider)] p-5'>
          <h6 className='font-semibold'>Backup & Restore</h6>
          <p className='text-textSecondary mt-2 text-sm'>
            Define backup cadence, retention policy, and disaster-recovery test intervals.
          </p>
          <ul className='mt-3 list-disc pl-5 text-sm text-textSecondary'>
            <li>Daily database snapshot target</li>
            <li>30/90-day archive retention windows</li>
            <li>Quarterly restore simulation checklist</li>
          </ul>
        </div>

        <div className='rounded-xl border border-[var(--mui-palette-divider)] p-5'>
          <h6 className='font-semibold'>2FA & Access Policy</h6>
          <p className='text-textSecondary mt-2 text-sm'>
            Enforce multi-factor policies for admins, landlord operators, and high-risk finance actions.
          </p>
          <ul className='mt-3 list-disc pl-5 text-sm text-textSecondary'>
            <li>Admin 2FA required</li>
            <li>Step-up auth for payouts and suspensions</li>
            <li>Session timeout and trusted-device limits</li>
          </ul>
        </div>
      </div>
    </div>
  )
}

export default SystemSettingsPage
