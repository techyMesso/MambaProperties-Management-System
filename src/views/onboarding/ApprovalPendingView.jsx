'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'

import Link from 'next/link'
import { useRouter } from 'next/navigation'

import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Chip from '@mui/material/Chip'
import CircularProgress from '@mui/material/CircularProgress'
import Container from '@mui/material/Container'
import Divider from '@mui/material/Divider'
import MenuItem from '@mui/material/MenuItem'
import Stack from '@mui/material/Stack'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'

import { USER_ROLES } from '@/libs/auth/roles'

const formatCurrency = amount => {
  const parsed = Number(amount)

  if (!Number.isFinite(parsed)) {
    return ''
  }

  return `KES ${parsed.toLocaleString('en-KE')}`
}

const KYC_STATUS_COLOR = {
  approved: 'success',
  pending: 'warning',
  rejected: 'error',
  resubmit: 'info'
}

const toText = value => String(value || '').trim()

const toDisplayDate = value => {
  const raw = toText(value)

  if (!raw) {
    return '-'
  }

  const parsed = new Date(raw)

  if (Number.isNaN(parsed.getTime())) {
    return raw
  }

  return parsed.toLocaleString('en-KE', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

const ApprovalPendingView = ({ initialState }) => {
  const router = useRouter()
  const [status, setStatus] = useState(initialState)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [refreshError, setRefreshError] = useState('')
  const [redirectCountdown, setRedirectCountdown] = useState(3)
  const [kycDocuments, setKycDocuments] = useState([])
  const [kycDocumentTypes, setKycDocumentTypes] = useState([])
  const [kycLoading, setKycLoading] = useState(false)
  const [kycError, setKycError] = useState('')
  const [kycSuccess, setKycSuccess] = useState('')
  const [uploadingKyc, setUploadingKyc] = useState(false)
  const [documentType, setDocumentType] = useState('national_id')
  const [selectedFile, setSelectedFile] = useState(null)

  const isApproved = Boolean(status?.isApproved)
  const isAdminApproved = Boolean(status?.isAdminApproved)
  const requestedRole = String(status?.requestedRole || USER_ROLES.LANDLORD).trim().toLowerCase()
  const canManageKyc = [USER_ROLES.LANDLORD, USER_ROLES.AGENT].includes(requestedRole)
  const hasVerifiedKyc = status?.profile?.kyc_verified === true

  const loadKycDocuments = useCallback(async ({ silent = false } = {}) => {
    if (!canManageKyc) {
      return
    }

    if (!silent) {
      setKycLoading(true)
    }

    setKycError('')

    try {
      const response = await fetch('/api/landlord/kyc-documents', {
        cache: 'no-store'
      })

      const payload = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(payload?.error || 'Unable to load KYC documents right now.')
      }

      const nextDocumentTypes = Array.isArray(payload?.documentTypes) ? payload.documentTypes : []

      setKycDocuments(Array.isArray(payload?.documents) ? payload.documents : [])
      setKycDocumentTypes(nextDocumentTypes)
      setDocumentType(current => (nextDocumentTypes.includes(current) ? current : nextDocumentTypes[0] || 'national_id'))
    } catch (error) {
      setKycError(error?.message || 'Unable to load KYC documents right now.')
    } finally {
      if (!silent) {
        setKycLoading(false)
      }
    }
  }, [canManageKyc])

  const refreshStatus = useCallback(async () => {
    setIsRefreshing(true)
    setRefreshError('')

    try {
      const response = await fetch('/api/account/approval-status', {
        cache: 'no-store'
      })

      const payload = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(payload?.error || 'Unable to refresh approval status right now.')
      }

      if (payload?.status) {
        setStatus(payload.status)
      }

      if (canManageKyc) {
        await loadKycDocuments({ silent: true })
      }
    } catch (error) {
      setRefreshError(error?.message || 'Unable to refresh approval status right now.')
    } finally {
      setIsRefreshing(false)
    }
  }, [canManageKyc, loadKycDocuments])

  useEffect(() => {
    if (isApproved) {
      return undefined
    }

    const intervalId = window.setInterval(() => {
      void refreshStatus()
    }, 10000)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [isApproved, refreshStatus])

  useEffect(() => {
    if (!canManageKyc) {
      return undefined
    }

    void loadKycDocuments()

    return undefined
  }, [canManageKyc, loadKycDocuments])

  useEffect(() => {
    if (!isApproved) {
      setRedirectCountdown(3)

      return undefined
    }

    setRedirectCountdown(3)

    const countdownInterval = window.setInterval(() => {
      setRedirectCountdown(current => {
        if (current <= 1) {
          window.clearInterval(countdownInterval)

          return 0
        }

        return current - 1
      })
    }, 1000)

    const redirectTimer = window.setTimeout(() => {
      router.replace(status?.dashboardPath || '/dashboard')
    }, 3000)

    return () => {
      window.clearInterval(countdownInterval)
      window.clearTimeout(redirectTimer)
    }
  }, [isApproved, router, status?.dashboardPath])

  const heroCopy = useMemo(() => {
    if (isApproved) {
      return {
        chip: 'Approved',
        chipColor: 'success',
        title: 'Your landlord account is ready.',
        body: 'Admin approval is complete and your dashboard access is now unlocked.'
      }
    }

    if (isAdminApproved) {
      return {
        chip: 'Payment activation pending',
        chipColor: 'info',
        title: 'Your account is approved, but access is still activating.',
        body: 'Admin approval is complete. Finish the paid plan setup or wait for payment activation before dashboard access unlocks.'
      }
    }

    return {
      chip: 'Awaiting admin review',
      chipColor: 'warning',
      title: 'We are reviewing your landlord subscription request.',
      body: `Your ${requestedRole === USER_ROLES.AGENT ? 'agent' : 'landlord'} onboarding is in progress. Complete the M-Pesa payment if prompted, then wait for admin approval before dashboard access unlocks.`
    }
  }, [isAdminApproved, isApproved, requestedRole])

  const handleKycUpload = async () => {
    if (!selectedFile) {
      setKycError('Choose a document file before uploading.')

      return
    }

    setUploadingKyc(true)
    setKycError('')
    setKycSuccess('')

    try {
      const uploadForm = new FormData()

      uploadForm.set('file', selectedFile)
      uploadForm.set('moduleKey', 'landlord-kyc')

      const uploadResponse = await fetch('/api/storage/documents/upload', {
        method: 'POST',
        body: uploadForm
      })

      const uploadPayload = await uploadResponse.json().catch(() => ({}))

      if (!uploadResponse.ok) {
        throw new Error(uploadPayload?.error || 'Unable to upload the selected document.')
      }

      const saveResponse = await fetch('/api/landlord/kyc-documents', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          documentType,
          filePath: uploadPayload?.path,
          fileName: uploadPayload?.fileName || selectedFile.name,
          fileSize: uploadPayload?.size || selectedFile.size,
          mimeType: uploadPayload?.mimeType || selectedFile.type
        })
      })

      const savePayload = await saveResponse.json().catch(() => ({}))

      if (!saveResponse.ok) {
        throw new Error(savePayload?.error || 'Unable to save the uploaded KYC document.')
      }

      setSelectedFile(null)
      setKycSuccess(savePayload?.message || 'Document uploaded successfully and sent for review.')
      await loadKycDocuments()
      await refreshStatus()
    } catch (error) {
      setKycError(error?.message || 'Unable to upload this KYC document right now.')
    } finally {
      setUploadingKyc(false)
    }
  }

  return (
    <Box sx={{ py: { xs: 8, md: 12 } }}>
      <Container maxWidth='md'>
        <Stack spacing={3}>
          <Stack spacing={1}>
            <Chip
              label={heroCopy.chip}
              color={heroCopy.chipColor}
              variant='tonal'
              sx={{ alignSelf: 'flex-start' }}
            />
            <Typography variant='h3'>{heroCopy.title}</Typography>
            <Typography color='text.secondary'>{heroCopy.body}</Typography>
          </Stack>

          {isApproved ? (
            <Alert severity='success' variant='tonal'>
              Approval complete. Redirecting to your dashboard in {redirectCountdown} second{redirectCountdown === 1 ? '' : 's'}.
            </Alert>
          ) : status?.hasPaidLandlordPlan ? (
            <Alert severity='success' variant='tonal'>
              Your landlord plan payment has been confirmed. The account is now waiting for admin approval.
            </Alert>
          ) : isAdminApproved ? (
            <Alert severity='info' variant='tonal'>
              Admin approval is complete, but dashboard access will stay locked until an active paid plan is detected.
            </Alert>
          ) : (
            <Alert severity='info' variant='tonal'>
              If the STK prompt has not appeared yet, check your phone and complete the payment. This page checks your status automatically every few seconds.
            </Alert>
          )}

          {refreshError ? (
            <Alert severity='warning' variant='tonal'>
              {refreshError}
            </Alert>
          ) : null}

          <Card>
            <CardContent>
              <Stack spacing={2}>
                <Stack direction='row' justifyContent='space-between' alignItems='center'>
                  <Typography variant='h5'>Current status</Typography>
                  <Button variant='text' onClick={refreshStatus} disabled={isRefreshing} startIcon={isRefreshing ? <CircularProgress size={16} color='inherit' /> : <i className='ri-refresh-line' />}>
                    {isRefreshing ? 'Checking...' : 'Check now'}
                  </Button>
                </Stack>
                <Typography color='text.secondary'>
                  Name: {status?.profile?.full_name || 'Account'} | Requested role: {requestedRole}
                </Typography>
                <Typography color='text.secondary'>Approval status: {status?.approvalStatus || 'pending'}</Typography>
                <Typography color='text.secondary'>Active plan modules: {status?.activeFeatureCount || 0}</Typography>
                <Typography color='text.secondary'>Pending plan modules: {status?.pendingFeatureCount || 0}</Typography>
                {status?.latestLandlordPayment ? (
                  <Typography color='text.secondary'>
                    Latest payment: {status.latestLandlordPayment.status}
                    {status.latestLandlordPayment.amount ? ` | ${formatCurrency(status.latestLandlordPayment.amount)}` : ''}
                  </Typography>
                ) : null}
              </Stack>
            </CardContent>
          </Card>

          {canManageKyc ? (
            <Card>
              <CardContent>
                <Stack spacing={3}>
                  <Stack spacing={1}>
                    <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent='space-between' spacing={2}>
                      <div>
                        <Typography variant='h5'>KYC Documents</Typography>
                        <Typography color='text.secondary'>
                          Upload an identity document first. Admin approval stays blocked until KYC is verified.
                        </Typography>
                      </div>
                      <Chip
                        label={hasVerifiedKyc ? 'KYC verified' : 'KYC pending'}
                        color={hasVerifiedKyc ? 'success' : 'warning'}
                        variant='tonal'
                        sx={{ alignSelf: 'flex-start' }}
                      />
                    </Stack>
                    {kycError ? (
                      <Alert severity='warning' variant='tonal'>
                        {kycError}
                      </Alert>
                    ) : null}
                    {kycSuccess ? (
                      <Alert severity='success' variant='tonal'>
                        {kycSuccess}
                      </Alert>
                    ) : null}
                  </Stack>

                  <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ xs: 'stretch', md: 'center' }}>
                    <TextField
                      select
                      fullWidth
                      label='Document type'
                      value={documentType}
                      onChange={event => setDocumentType(event.target.value)}
                      disabled={uploadingKyc || kycLoading}
                    >
                      {(kycDocumentTypes.length ? kycDocumentTypes : ['national_id', 'passport']).map(type => (
                        <MenuItem key={type} value={type}>
                          {String(type)
                            .split('_')
                            .map(part => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
                            .join(' ')}
                        </MenuItem>
                      ))}
                    </TextField>

                    <Button component='label' variant='outlined' disabled={uploadingKyc || kycLoading}>
                      {selectedFile ? 'Change file' : 'Choose file'}
                      <input
                        hidden
                        type='file'
                        accept='.pdf,.png,.jpg,.jpeg,.webp,.doc,.docx,.heic,.heif,.avif'
                        onChange={event => setSelectedFile(event.target.files?.[0] || null)}
                      />
                    </Button>

                    <Button variant='contained' disabled={uploadingKyc || kycLoading || !selectedFile} onClick={handleKycUpload}>
                      {uploadingKyc ? 'Uploading...' : 'Upload document'}
                    </Button>
                  </Stack>

                  <Typography color='text.secondary'>
                    Selected file: {selectedFile ? `${selectedFile.name} (${Math.max(1, Math.round(selectedFile.size / 1024))} KB)` : 'None'}
                  </Typography>

                  <Divider />

                  <Stack spacing={2}>
                    <Stack direction='row' justifyContent='space-between' alignItems='center'>
                      <Typography variant='h6'>Submitted documents</Typography>
                      <Button variant='text' onClick={() => loadKycDocuments()} disabled={kycLoading || uploadingKyc} startIcon={kycLoading ? <CircularProgress size={16} color='inherit' /> : <i className='ri-refresh-line' />}>
                        {kycLoading ? 'Refreshing...' : 'Refresh documents'}
                      </Button>
                    </Stack>

                    {kycLoading && !kycDocuments.length ? (
                      <Stack alignItems='center' py={3}>
                        <CircularProgress size={24} />
                      </Stack>
                    ) : kycDocuments.length === 0 ? (
                      <Alert severity='info' variant='tonal'>
                        No KYC documents uploaded yet. Start with your national ID or passport so admin can verify the account.
                      </Alert>
                    ) : (
                      kycDocuments.map(document => (
                        <Card key={document.id} variant='outlined'>
                          <CardContent>
                            <Stack spacing={1.5}>
                              <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent='space-between' spacing={1}>
                                <Typography variant='h6'>{document.documentLabel}</Typography>
                                <Chip
                                  label={toText(document.verificationStatus) || 'pending'}
                                  color={KYC_STATUS_COLOR[toText(document.verificationStatus).toLowerCase()] || 'default'}
                                  size='small'
                                  variant='tonal'
                                  sx={{ alignSelf: 'flex-start' }}
                                />
                              </Stack>
                              <Typography color='text.secondary'>File: {toText(document.fileName) || 'Uploaded document'}</Typography>
                              <Typography color='text.secondary'>Uploaded: {toDisplayDate(document.createdAt)}</Typography>
                              {document.verifiedAt ? (
                                <Typography color='text.secondary'>Reviewed: {toDisplayDate(document.verifiedAt)}</Typography>
                              ) : null}
                              {document.rejectionReason ? (
                                <Alert severity={document.verificationStatus === 'resubmit' ? 'info' : 'warning'} variant='tonal'>
                                  {document.rejectionReason}
                                </Alert>
                              ) : null}
                              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                                <Button
                                  component={Link}
                                  href={`/api/storage/documents/download?path=${encodeURIComponent(toText(document.filePath))}`}
                                  target='_blank'
                                  rel='noreferrer'
                                  variant='outlined'
                                >
                                  View document
                                </Button>
                              </Stack>
                            </Stack>
                          </CardContent>
                        </Card>
                      ))
                    )}
                  </Stack>
                </Stack>
              </CardContent>
            </Card>
          ) : null}

          {Array.isArray(status?.featureAccess) && status.featureAccess.length ? (
            <Card>
              <CardContent>
                <Stack spacing={2}>
                  <Typography variant='h5'>Selected modules</Typography>
                  {status.featureAccess.map(item => (
                    <Stack key={item.id} direction='row' spacing={2} alignItems='center' justifyContent='space-between'>
                      <Typography>{item.label}</Typography>
                      <Chip label={item.isActive ? 'paid' : 'pending'} color={item.isActive ? 'success' : 'warning'} size='small' />
                    </Stack>
                  ))}
                </Stack>
              </CardContent>
            </Card>
          ) : null}

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            {isApproved ? (
              <Button component={Link} href={status?.dashboardPath || '/dashboard'} variant='contained'>
                Go to dashboard
              </Button>
            ) : (
              <Button component={Link} href={`/pricing?audience=landlord&role=${requestedRole}&recommended=landlord_full_access`} variant='contained'>
                Back to pricing
              </Button>
            )}
            <Button component={Link} href='/login' variant='outlined'>
              Sign in again
            </Button>
          </Stack>
        </Stack>
      </Container>
    </Box>
  )
}

export default ApprovalPendingView
