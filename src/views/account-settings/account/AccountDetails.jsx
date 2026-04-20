'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

import Alert from '@mui/material/Alert'
import Avatar from '@mui/material/Avatar'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Chip from '@mui/material/Chip'
import CircularProgress from '@mui/material/CircularProgress'
import Divider from '@mui/material/Divider'
import Grid from '@mui/material/Grid'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'

import { createBrowserSupabaseClient } from '@/libs/supabase'
import { BUCKET_NAME } from '@/libs/constants'

const EMPTY_FORM = {
  fullName: '',
  email: '',
  phone: '',
  idNumber: '',
  occupation: '',
  role: '',
  avatarPath: '',
  avatarUrl: ''
}

const EMPTY_PASSWORD = {
  currentPassword: '',
  newPassword: '',
  confirmPassword: ''
}

const EMPTY_MFA_ENROLLMENT = {
  factorId: '',
  qrCode: '',
  secret: '',
  friendlyName: ''
}

const AVATAR_MAX_EDGE_PX = 1024
const AVATAR_TARGET_BYTES = 450 * 1024

const toText = value => String(value || '').trim()

const normalizeRoleLabel = value => {
  const role = toText(value).toLowerCase()

  if (!role) {
    return 'User'
  }

  return `${role.slice(0, 1).toUpperCase()}${role.slice(1)}`
}

const withCacheBust = value => {
  const url = toText(value)

  if (!url) {
    return ''
  }

  return `${url}${url.includes('?') ? '&' : '?'}t=${Date.now()}`
}

const toImageFileName = fileName => {
  const safeName = toText(fileName) || 'profile-photo'
  const base = safeName.replace(/\.[^.]+$/, '')

  return `${base || 'profile-photo'}.webp`
}

const sanitizeFileName = value => {
  const normalized = String(value || 'avatar.webp')
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')

  return normalized || 'avatar.webp'
}

const canvasToBlob = (canvas, type, quality) =>
  new Promise(resolve => {
    canvas.toBlob(blob => resolve(blob), type, quality)
  })

const optimizeAvatarFile = async file => {
  if (!(file instanceof File) || !String(file.type || '').startsWith('image/')) {
    return file
  }

  if (file.size <= AVATAR_TARGET_BYTES && (file.type === 'image/jpeg' || file.type === 'image/webp')) {
    return file
  }

  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return file
  }

  let bitmap = null

  try {
    bitmap = await createImageBitmap(file)
  } catch {
    return file
  }

  try {
    const sourceWidth = bitmap.width
    const sourceHeight = bitmap.height
    const maxSide = Math.max(sourceWidth, sourceHeight)
    const scale = maxSide > AVATAR_MAX_EDGE_PX ? AVATAR_MAX_EDGE_PX / maxSide : 1
    const width = Math.max(1, Math.round(sourceWidth * scale))
    const height = Math.max(1, Math.round(sourceHeight * scale))

    const canvas = document.createElement('canvas')

    canvas.width = width
    canvas.height = height

    const context = canvas.getContext('2d', { alpha: false })

    if (!context) {
      return file
    }

    context.drawImage(bitmap, 0, 0, width, height)

    let quality = 0.86
    let outputBlob = await canvasToBlob(canvas, 'image/webp', quality)

    if (!outputBlob) {
      return file
    }

    while (outputBlob.size > AVATAR_TARGET_BYTES && quality > 0.55) {
      quality -= 0.08
      outputBlob = await canvasToBlob(canvas, 'image/webp', quality)

      if (!outputBlob) {
        return file
      }
    }

    if (!outputBlob || outputBlob.size >= file.size) {
      return file
    }

    return new File([outputBlob], toImageFileName(file.name), {
      type: 'image/webp',
      lastModified: Date.now()
    })
  } finally {
    bitmap.close()
  }
}

const AccountDetails = () => {
  const supabase = useMemo(() => createBrowserSupabaseClient(), [])
  const router = useRouter()
  const searchParams = useSearchParams()
  const [formValues, setFormValues] = useState(EMPTY_FORM)
  const [initialValues, setInitialValues] = useState(EMPTY_FORM)
  const [tenantMappings, setTenantMappings] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [savingPassword, setSavingPassword] = useState(false)
  const [passwordForm, setPasswordForm] = useState(EMPTY_PASSWORD)
  const [errorMessage, setErrorMessage] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [warningMessage, setWarningMessage] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [passwordSuccess, setPasswordSuccess] = useState('')
  const [securityStatus, setSecurityStatus] = useState(null)
  const [securityLoading, setSecurityLoading] = useState(true)
  const [mfaFactors, setMfaFactors] = useState([])

  const [mfaAssurance, setMfaAssurance] = useState({
    currentLevel: '',
    nextLevel: ''
  })

  const [mfaEnrollment, setMfaEnrollment] = useState(EMPTY_MFA_ENROLLMENT)
  const [mfaCode, setMfaCode] = useState('')
  const [mfaBusy, setMfaBusy] = useState(false)
  const [mfaError, setMfaError] = useState('')
  const [mfaSuccess, setMfaSuccess] = useState('')

  const isTenant = formValues.role === 'tenant'
  const avatarLetter = toText(formValues.fullName || formValues.email || 'A').charAt(0).toUpperCase()
  const securityPrompt = toText(searchParams?.get('security'))

  const hasChanges = useMemo(
    () =>
      ['fullName', 'phone', 'idNumber', 'occupation'].some(field => toText(formValues[field]) !== toText(initialValues[field])),
    [formValues, initialValues]
  )

  const verifiedMfaFactors = useMemo(
    () => mfaFactors.filter(factor => toText(factor?.status).toLowerCase() === 'verified'),
    [mfaFactors]
  )

  const mfaRequired = Boolean(securityStatus?.mfaRequired)
  const hasVerifiedMfaFactor = Boolean(securityStatus?.hasVerifiedFactor || verifiedMfaFactors.length > 0)
  const mfaRequiredButMissing = mfaRequired && !hasVerifiedMfaFactor

  const mfaQrCodeUrl = useMemo(() => {
    const qrCode = toText(mfaEnrollment.qrCode)

    if (!qrCode) {
      return ''
    }

    return `data:image/svg+xml;utf-8,${encodeURIComponent(qrCode)}`
  }, [mfaEnrollment.qrCode])

  const loadProfile = useCallback(async () => {
    setLoading(true)
    setErrorMessage('')
    setSuccessMessage('')
    setWarningMessage('')

    try {
      const response = await fetch('/api/account/profile', {
        method: 'GET',
        cache: 'no-store'
      })

      const body = await response.json().catch(() => ({}))

      if (!response.ok) {
        setErrorMessage(body?.error || 'Unable to load account settings.')
        setLoading(false)

        return
      }

      const nextValues = {
        fullName: toText(body?.profile?.fullName),
        email: toText(body?.profile?.email),
        phone: toText(body?.profile?.phone),
        idNumber: toText(body?.profile?.idNumber),
        occupation: toText(body?.profile?.occupation),
        role: toText(body?.profile?.role),
        avatarPath: toText(body?.profile?.avatarPath),
        avatarUrl: toText(body?.profile?.avatarUrl)
      }

      setFormValues(nextValues)
      setInitialValues(nextValues)
      setTenantMappings(Array.isArray(body?.tenantMappings) ? body.tenantMappings : [])
      setWarningMessage(toText(body?.warning))
      setLoading(false)
    } catch {
      setErrorMessage('Unable to load account settings.')
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadProfile()
  }, [loadProfile])

  const loadSecurityStatus = useCallback(async () => {
    setSecurityLoading(true)

    try {
      const [securityResponse, factorResult, assuranceResult] = await Promise.all([
        fetch('/api/account/security-status', {
          method: 'GET',
          cache: 'no-store'
        }),
        supabase?.auth?.mfa?.listFactors?.(),
        supabase?.auth?.mfa?.getAuthenticatorAssuranceLevel?.()
      ])

      const securityBody = await securityResponse.json().catch(() => ({}))

      if (!securityResponse.ok) {
        setSecurityStatus(null)
        setMfaFactors([])
        setMfaAssurance({
          currentLevel: '',
          nextLevel: ''
        })
        setSecurityLoading(false)

        return
      }

      setSecurityStatus(securityBody?.security || null)
      setMfaFactors(Array.isArray(factorResult?.data?.all) ? factorResult.data.all : [])
      setMfaAssurance({
        currentLevel: toText(assuranceResult?.data?.currentLevel),
        nextLevel: toText(assuranceResult?.data?.nextLevel)
      })
      setSecurityLoading(false)
    } catch {
      setSecurityStatus(null)
      setMfaFactors([])
      setMfaAssurance({
        currentLevel: '',
        nextLevel: ''
      })
      setSecurityLoading(false)
    }
  }, [supabase])

  useEffect(() => {
    loadSecurityStatus()
  }, [loadSecurityStatus])

  const handleFieldChange = (field, value) => {
    setFormValues(prev => ({
      ...prev,
      [field]: value
    }))
  }

  const handlePasswordFieldChange = (field, value) => {
    setPasswordForm(prev => ({
      ...prev,
      [field]: value
    }))
  }

  const handleReset = () => {
    setFormValues(initialValues)
    setSuccessMessage('')
    setWarningMessage('')
    setErrorMessage('')
  }

  const handleSubmit = async event => {
    event.preventDefault()

    setSaving(true)
    setErrorMessage('')
    setSuccessMessage('')
    setWarningMessage('')

    try {
      const response = await fetch('/api/account/profile', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          fullName: formValues.fullName,
          phone: formValues.phone,
          idNumber: formValues.idNumber,
          occupation: formValues.occupation
        })
      })

      const body = await response.json().catch(() => ({}))

      if (!response.ok) {
        setErrorMessage(body?.error || 'Unable to update account settings.')
        setSaving(false)

        return
      }

      const savedValues = {
        ...formValues,
        fullName: toText(body?.profile?.fullName || formValues.fullName),
        phone: toText(body?.profile?.phone || formValues.phone),
        idNumber: toText(body?.profile?.idNumber || formValues.idNumber),
        occupation: toText(body?.profile?.occupation || formValues.occupation),
        avatarPath: toText(body?.profile?.avatarPath || formValues.avatarPath),
        avatarUrl: toText(body?.profile?.avatarUrl || formValues.avatarUrl)
      }

      setFormValues(savedValues)
      setInitialValues(savedValues)
      setSuccessMessage('Account settings updated successfully.')
      setWarningMessage(toText(body?.warning))
      setSaving(false)
    } catch {
      setErrorMessage('Unable to update account settings.')
      setSaving(false)
    }
  }

  const handleUploadAvatar = async event => {
    const selectedFile = event.target.files?.[0]

    event.target.value = ''

    if (!selectedFile) {
      return
    }

    setUploadingAvatar(true)
    setErrorMessage('')
    setSuccessMessage('')
    setWarningMessage('')

    let file = selectedFile

    try {
      file = await optimizeAvatarFile(selectedFile)
    } catch {
      file = selectedFile
    }

    const uploadForm = new FormData()

    uploadForm.set('file', file)

    try {
      let response = null

      if (supabase) {
        const {
          data: { user }
        } = await supabase.auth.getUser()

        if (user?.id) {
          const safeFileName = sanitizeFileName(file.name || 'avatar.webp')
          const storagePath = `${user.id}/profile-avatar/${Date.now()}-${crypto.randomUUID()}-${safeFileName}`

          const uploadResult = await supabase.storage.from(BUCKET_NAME).upload(storagePath, file, {
            contentType: toText(file.type) || 'application/octet-stream',
            cacheControl: '3600',
            upsert: false
          })

          if (!uploadResult.error) {
            response = await fetch('/api/account/profile/avatar', {
              method: 'PATCH',
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                avatarPath: storagePath,
                previousAvatarPath: toText(formValues.avatarPath)
              })
            })
          }
        }
      }

      if (!response) {
        response = await fetch('/api/account/profile/avatar', {
          method: 'POST',
          body: uploadForm
        })
      }

      const body = await response.json().catch(() => ({}))

      if (!response.ok) {
        setErrorMessage(body?.error || 'Unable to upload profile photo.')
        setUploadingAvatar(false)

        return
      }

      const nextAvatarPath = toText(body?.avatarPath)
      const nextAvatarUrl = withCacheBust(toText(body?.avatarUrl))

      setFormValues(prev => ({
        ...prev,
        avatarPath: nextAvatarPath,
        avatarUrl: nextAvatarUrl
      }))
      setInitialValues(prev => ({
        ...prev,
        avatarPath: nextAvatarPath,
        avatarUrl: nextAvatarUrl
      }))
      setSuccessMessage('Profile photo updated.')
      setWarningMessage(toText(body?.warning))
      setUploadingAvatar(false)
    } catch {
      setErrorMessage('Unable to upload profile photo.')
      setUploadingAvatar(false)
    }
  }

  const handlePasswordSubmit = async event => {
    event.preventDefault()

    const currentPassword = toText(passwordForm.currentPassword)
    const newPassword = toText(passwordForm.newPassword)
    const confirmPassword = toText(passwordForm.confirmPassword)

    setPasswordError('')
    setPasswordSuccess('')

    if (!currentPassword) {
      setPasswordError('Current password is required.')

      return
    }

    if (newPassword.length < 12 || !/[a-z]/.test(newPassword) || !/[A-Z]/.test(newPassword) || !/\d/.test(newPassword)) {
      setPasswordError('New password must be at least 12 characters and include uppercase, lowercase, and a number.')

      return
    }

    if (confirmPassword && confirmPassword !== newPassword) {
      setPasswordError('Password confirmation does not match.')

      return
    }

    setSavingPassword(true)

    try {
      const response = await fetch('/api/account/password', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          currentPassword,
          newPassword: newPassword,
          confirmPassword
        })
      })

      const body = await response.json().catch(() => ({}))

      if (!response.ok) {
        setPasswordError(body?.error || 'Unable to update password.')
        setSavingPassword(false)

        return
      }

      setPasswordForm(EMPTY_PASSWORD)
      setPasswordSuccess('Password updated successfully.')
      setSavingPassword(false)
    } catch {
      setPasswordError('Unable to update password.')
      setSavingPassword(false)
    }
  }

  const handleStartMfaEnrollment = async () => {
    if (!supabase?.auth?.mfa?.enroll) {
      setMfaError('Authenticator enrollment is not available right now.')

      return
    }

    setMfaBusy(true)
    setMfaError('')
    setMfaSuccess('')

    try {
      const staleFactors = mfaFactors.filter(
        factor => toText(factor?.factor_type).toLowerCase() === 'totp' && toText(factor?.status).toLowerCase() !== 'verified'
      )

      for (const factor of staleFactors) {
        if (factor?.id) {
          await supabase.auth.mfa.unenroll({
            factorId: factor.id
          })
        }
      }

      const friendlyName = `${normalizeRoleLabel(securityStatus?.role || formValues.role)} Authenticator`

      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: 'totp',
        friendlyName
      })

      if (error) {
        setMfaError(error.message || 'Unable to start authenticator setup.')
        setMfaBusy(false)

        return
      }

      setMfaEnrollment({
        factorId: toText(data?.id),
        qrCode: toText(data?.totp?.qr_code),
        secret: toText(data?.totp?.secret),
        friendlyName
      })
      setMfaSuccess('Authenticator setup started. Scan the QR code and enter the 6-digit code to finish.')
      setMfaCode('')
      setMfaBusy(false)
      await loadSecurityStatus()
    } catch {
      setMfaError('Unable to start authenticator setup.')
      setMfaBusy(false)
    }
  }

  const handleVerifyMfaEnrollment = async event => {
    event.preventDefault()

    const verificationCode = toText(mfaCode).replace(/\s+/g, '')

    setMfaError('')
    setMfaSuccess('')

    if (!mfaEnrollment.factorId) {
      setMfaError('Start authenticator setup first.')

      return
    }

    if (!/^\d{6}$/.test(verificationCode)) {
      setMfaError('Enter the 6-digit code from your authenticator app.')

      return
    }

    setMfaBusy(true)

    try {
      const { error } = await supabase.auth.mfa.challengeAndVerify({
        factorId: mfaEnrollment.factorId,
        code: verificationCode
      })

      if (error) {
        setMfaError(error.message || 'Unable to verify authenticator code.')
        setMfaBusy(false)

        return
      }

      setMfaEnrollment(EMPTY_MFA_ENROLLMENT)
      setMfaCode('')
      setMfaSuccess('Multi-factor authentication is now active on this account.')
      setMfaBusy(false)
      await loadSecurityStatus()

      const nextPath = toText(searchParams?.get('next'))

      if (nextPath && !nextPath.startsWith('/account-settings')) {
        router.push(nextPath)
      }
    } catch {
      setMfaError('Unable to verify authenticator code.')
      setMfaBusy(false)
    }
  }

  const handleRemoveMfaFactor = async factorId => {
    if (!factorId || !supabase?.auth?.mfa?.unenroll) {
      return
    }

    const confirmed = window.confirm(
      'Remove this authenticator? Protected dashboards will be blocked again until you set up MFA.'
    )

    if (!confirmed) {
      return
    }

    setMfaBusy(true)
    setMfaError('')
    setMfaSuccess('')

    try {
      const { error } = await supabase.auth.mfa.unenroll({
        factorId
      })

      if (error) {
        setMfaError(error.message || 'Unable to remove authenticator.')
        setMfaBusy(false)

        return
      }

      setMfaEnrollment(EMPTY_MFA_ENROLLMENT)
      setMfaCode('')
      setMfaSuccess('Authenticator removed.')
      setMfaBusy(false)
      await loadSecurityStatus()
    } catch {
      setMfaError('Unable to remove authenticator.')
      setMfaBusy(false)
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className='flex items-center gap-3 py-8'>
          <CircularProgress size={20} />
          <Typography>Loading account settings...</Typography>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardContent>
        <div className='flex flex-wrap items-center justify-between gap-3 mbe-6'>
          <div>
            <Typography variant='h5'>Account Settings</Typography>
            <Typography variant='body2' color='text.secondary'>
              {isTenant
                ? 'Keep your tenant account profile current for payment prompts and landlord communication.'
                : 'Keep your profile updated for team operations and communication.'}
            </Typography>
          </div>
          <Chip label={normalizeRoleLabel(formValues.role)} color='primary' variant='tonal' />
        </div>

        {errorMessage ? (
          <Alert className='mbe-4' severity='error' variant='tonal'>
            {errorMessage}
          </Alert>
        ) : null}

        {successMessage ? (
          <Alert className='mbe-4' severity='success' variant='tonal'>
            {successMessage}
          </Alert>
        ) : null}

        {warningMessage ? (
          <Alert className='mbe-4' severity='warning' variant='tonal'>
            {warningMessage}
          </Alert>
        ) : null}

        <div className='flex flex-wrap items-center gap-4 mbe-6'>
          <Avatar src={toText(formValues.avatarUrl) || undefined} alt={formValues.fullName} sx={{ width: 72, height: 72 }}>
            {avatarLetter}
          </Avatar>
          <div className='flex flex-wrap items-center gap-2'>
            <Button component='label' size='small' variant='contained' disabled={uploadingAvatar}>
              {uploadingAvatar ? 'Uploading...' : 'Upload Profile Photo'}
              <input hidden type='file' accept='image/jpeg,image/png,image/webp' onChange={handleUploadAvatar} />
            </Button>
            <Typography variant='body2' color='text.secondary'>
              JPG, PNG, WEBP up to 10MB.
            </Typography>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <Grid container spacing={4}>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                required
                label='Full Name'
                value={formValues.fullName}
                onChange={event => handleFieldChange('fullName', event.target.value)}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField fullWidth disabled label='Email Address' value={formValues.email} />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label='Phone Number'
                placeholder='+254712345678'
                value={formValues.phone}
                onChange={event => handleFieldChange('phone', event.target.value)}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label='ID / Passport Number'
                value={formValues.idNumber}
                onChange={event => handleFieldChange('idNumber', event.target.value)}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label='Occupation'
                value={formValues.occupation}
                onChange={event => handleFieldChange('occupation', event.target.value)}
              />
            </Grid>

            {isTenant ? (
              <Grid item xs={12}>
                <Card variant='outlined' className='mp-dashboard-kpi'>
                  <CardContent>
                    <Typography variant='subtitle1'>Linked Tenant Accounts</Typography>
                    <Typography variant='body2' color='text.secondary' className='mbe-3'>
                      These mappings are created by landlords and define where your invoices and rent prompts come from.
                    </Typography>
                    {tenantMappings.length === 0 ? (
                      <Typography color='text.secondary'>No tenant mapping found yet. Ask your landlord to map your account.</Typography>
                    ) : (
                      <div className='flex flex-wrap gap-2'>
                        {tenantMappings.map(item => {
                          const tenantName = toText(item?.tenantName || 'Tenant')
                          const unitCode = toText(item?.unitCode || 'Unassigned unit')

                          return <Chip key={item.id || `${tenantName}-${unitCode}`} label={`${tenantName} - ${unitCode}`} variant='outlined' />
                        })}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </Grid>
            ) : null}

            <Grid item xs={12} className='flex gap-3 flex-wrap'>
              <Button variant='contained' type='submit' disabled={saving || !hasChanges}>
                {saving ? 'Saving...' : 'Save Changes'}
              </Button>
              <Button variant='outlined' color='secondary' type='button' disabled={saving || !hasChanges} onClick={handleReset}>
                Reset
              </Button>
            </Grid>
          </Grid>
        </form>

        <Divider className='my-6' />

        <Typography variant='h6' className='mbe-2'>
          Security
        </Typography>
        <Typography variant='body2' color='text.secondary' className='mbe-4'>
          Update your password to keep your account secure.
        </Typography>

        {securityPrompt === 'mfa-required' ? (
          <Alert className='mbe-3' severity='warning' variant='tonal'>
            Let&apos;s protect this account before continuing. Set up an authenticator app to unlock privileged dashboards.
          </Alert>
        ) : null}

        {passwordError ? (
          <Alert className='mbe-3' severity='error' variant='tonal'>
            {passwordError}
          </Alert>
        ) : null}
        {passwordSuccess ? (
          <Alert className='mbe-3' severity='success' variant='tonal'>
            {passwordSuccess}
          </Alert>
        ) : null}

        <form onSubmit={handlePasswordSubmit}>
          <Grid container spacing={4}>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                required
                type='password'
                label='Current Password'
                value={passwordForm.currentPassword}
                onChange={event => handlePasswordFieldChange('currentPassword', event.target.value)}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                required
                type='password'
                label='New Password'
                value={passwordForm.newPassword}
                onChange={event => handlePasswordFieldChange('newPassword', event.target.value)}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                required
                type='password'
                label='Confirm New Password'
                value={passwordForm.confirmPassword}
                onChange={event => handlePasswordFieldChange('confirmPassword', event.target.value)}
              />
            </Grid>
            <Grid item xs={12}>
              <Typography variant='body2' color='text.secondary'>
                Use at least 12 characters with uppercase, lowercase, and a number.
              </Typography>
            </Grid>
            <Grid item xs={12}>
              <Button variant='contained' type='submit' disabled={savingPassword}>
                {savingPassword ? 'Updating...' : 'Update Password'}
              </Button>
            </Grid>
          </Grid>
        </form>

        {mfaRequired || verifiedMfaFactors.length > 0 ? (
          <>
            <Divider className='my-6' />

            <div className='flex flex-wrap items-start justify-between gap-3 mbe-4'>
              <div>
                <Typography variant='h6'>Multi-Factor Authentication</Typography>
                <Typography variant='body2' color='text.secondary'>
                  {mfaRequired
                    ? 'Privileged accounts must use an authenticator app before accessing protected dashboards.'
                    : 'Add an authenticator app for an extra layer of account security.'}
                </Typography>
              </div>
              {securityLoading ? (
                <Chip label='Checking...' variant='tonal' />
              ) : hasVerifiedMfaFactor ? (
                <Chip label='MFA active' color='success' variant='tonal' />
              ) : (
                <Chip label={mfaRequired ? 'MFA required' : 'Not configured'} color='warning' variant='tonal' />
              )}
            </div>

            {mfaError ? (
              <Alert className='mbe-3' severity='error' variant='tonal'>
                {mfaError}
              </Alert>
            ) : null}

            {mfaSuccess ? (
              <Alert className='mbe-3' severity='success' variant='tonal'>
                {mfaSuccess}
              </Alert>
            ) : null}

            {mfaRequiredButMissing ? (
              <Alert className='mbe-3' severity='warning' variant='tonal'>
                This account is approved for a protected role, but MFA is not finished yet. Protected dashboards stay blocked until
                a verified authenticator is active.
              </Alert>
            ) : null}

            <Grid container spacing={4}>
              <Grid item xs={12} md={6}>
                <Card variant='outlined'>
                  <CardContent>
                    <Typography variant='subtitle1' className='mbe-2'>
                      Security Status
                    </Typography>
                    <Typography variant='body2' color='text.secondary' className='mbe-2'>
                      Role: {normalizeRoleLabel(securityStatus?.role || formValues.role)}
                    </Typography>
                    <Typography variant='body2' color='text.secondary' className='mbe-2'>
                      Verified authenticators: {verifiedMfaFactors.length}
                    </Typography>
                    <Typography variant='body2' color='text.secondary' className='mbe-2'>
                      Current assurance level: {toText(mfaAssurance.currentLevel || 'aal1').toUpperCase()}
                    </Typography>
                    <Typography variant='body2' color='text.secondary'>
                      Next assurance level: {toText(mfaAssurance.nextLevel || 'aal2').toUpperCase()}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>

              <Grid item xs={12} md={6}>
                <Card variant='outlined'>
                  <CardContent>
                    <Typography variant='subtitle1' className='mbe-2'>
                      Authenticator App
                    </Typography>
                    <Typography variant='body2' color='text.secondary' className='mbe-3'>
                      Use Google Authenticator, Microsoft Authenticator, 1Password, or another TOTP app.
                    </Typography>
                    <Button variant='contained' onClick={handleStartMfaEnrollment} disabled={mfaBusy}>
                      {mfaBusy ? 'Working...' : hasVerifiedMfaFactor ? 'Add another authenticator' : 'Set up authenticator'}
                    </Button>
                  </CardContent>
                </Card>
              </Grid>

              {mfaEnrollment.factorId ? (
                <>
                  <Grid item xs={12} md={6}>
                    <Card variant='outlined'>
                      <CardContent>
                        <Typography variant='subtitle1' className='mbe-2'>
                          Scan QR Code
                        </Typography>
                        {mfaQrCodeUrl ? (
                          <img
                            src={mfaQrCodeUrl}
                            alt='Authenticator QR code'
                            style={{ maxWidth: '100%', width: 220, borderRadius: 12, background: '#fff', padding: 12 }}
                          />
                        ) : (
                          <Typography color='text.secondary'>QR code unavailable. Use the manual secret below.</Typography>
                        )}
                        <Typography variant='body2' color='text.secondary' className='mbe-2 mt-4'>
                          Manual secret
                        </Typography>
                        <TextField fullWidth value={mfaEnrollment.secret} inputProps={{ readOnly: true }} />
                      </CardContent>
                    </Card>
                  </Grid>

                  <Grid item xs={12} md={6}>
                    <Card variant='outlined'>
                      <CardContent>
                        <Typography variant='subtitle1' className='mbe-2'>
                          Verify Authenticator
                        </Typography>
                        <Typography variant='body2' color='text.secondary' className='mbe-3'>
                          Enter the 6-digit code from your app to finish setup.
                        </Typography>
                        <form onSubmit={handleVerifyMfaEnrollment}>
                          <TextField
                            fullWidth
                            label='Authenticator code'
                            placeholder='123456'
                            value={mfaCode}
                            onChange={event => setMfaCode(event.target.value)}
                            className='mbe-3'
                          />
                          <Button variant='contained' type='submit' disabled={mfaBusy}>
                            {mfaBusy ? 'Verifying...' : 'Verify and activate MFA'}
                          </Button>
                        </form>
                      </CardContent>
                    </Card>
                  </Grid>
                </>
              ) : null}

              {verifiedMfaFactors.length > 0 ? (
                <Grid item xs={12}>
                  <Card variant='outlined'>
                    <CardContent>
                      <Typography variant='subtitle1' className='mbe-3'>
                        Verified Authenticators
                      </Typography>
                      <div className='flex flex-col gap-3'>
                        {verifiedMfaFactors.map(factor => (
                          <div
                            key={factor.id}
                            className='flex flex-wrap items-center justify-between gap-3 rounded border border-solid border-[var(--mui-palette-divider)] p-3'
                          >
                            <div>
                              <Typography>{toText(factor.friendly_name || 'Authenticator')}</Typography>
                              <Typography variant='body2' color='text.secondary'>
                                {toText(factor.factor_type).toUpperCase()} - Verified
                              </Typography>
                            </div>
                            <Button variant='outlined' color='warning' disabled={mfaBusy} onClick={() => handleRemoveMfaFactor(factor.id)}>
                              Remove
                            </Button>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </Grid>
              ) : null}
            </Grid>
          </>
        ) : null}
      </CardContent>
    </Card>
  )
}

export default AccountDetails
