'use client'

// React Imports
import { useMemo, useRef, useState } from 'react'

// Next Imports
import { useRouter } from 'next/navigation'

// MUI Imports
import Avatar from '@mui/material/Avatar'
import Alert from '@mui/material/Alert'
import Badge from '@mui/material/Badge'
import Button from '@mui/material/Button'
import ClickAwayListener from '@mui/material/ClickAwayListener'
import Divider from '@mui/material/Divider'
import Fade from '@mui/material/Fade'
import IconButton from '@mui/material/IconButton'
import MenuItem from '@mui/material/MenuItem'
import MenuList from '@mui/material/MenuList'
import Paper from '@mui/material/Paper'
import Popper from '@mui/material/Popper'
import Snackbar from '@mui/material/Snackbar'
import Typography from '@mui/material/Typography'
import { styled } from '@mui/material/styles'

// Lib Imports
import { DEFAULT_ROLE } from '@/libs/auth/roles'
import { createAuthPerfLogger } from '@/libs/auth/perf'
import { useAuthSession } from '@/contexts/auth-session-context'

// Styled component for badge content
const BadgeContentSpan = styled('span')({
  width: 8,
  height: 8,
  borderRadius: '50%',
  backgroundColor: 'var(--mui-palette-success-main)',
  boxShadow: '0 0 0 2px var(--mui-palette-background-paper)'
})

const createInitialUserState = () => ({
  name: 'Account',
  email: '',
  role: DEFAULT_ROLE,
  avatarUrl: ''
})

const toLabel = value => {
  if (!value) {
    return 'Tenant'
  }

  return value.charAt(0).toUpperCase() + value.slice(1)
}

const withTimeout = (promise, ms) => {
  if (!promise || typeof promise.then !== 'function') {
    return Promise.resolve({ timeout: false })
  }

  let timeoutId

  const timeout = new Promise(resolve => {
    timeoutId = setTimeout(() => resolve({ timeout: true }), ms)
  })

  return Promise.race([promise, timeout]).finally(() => {
    if (timeoutId) {
      clearTimeout(timeoutId)
    }
  })
}

const UserDropdown = () => {
  // States
  const [open, setOpen] = useState(false)
  const [isSigningOut, setIsSigningOut] = useState(false)
  const [showSignoutTimeout, setShowSignoutTimeout] = useState(false)

  // Refs
  const anchorRef = useRef(null)

  // Hooks
  const router = useRouter()
  const { user, role, supabase } = useAuthSession()

  const userState = useMemo(() => {
    if (!user) {
      return createInitialUserState()
    }

    const name = user.user_metadata?.full_name ?? user.email?.split('@')[0] ?? 'Account'
    const avatarPath = String(user.user_metadata?.avatar_path || '').trim()
    const metadataAvatar = String(user.user_metadata?.avatar_url || '').trim()
    const avatarUrl = avatarPath ? `/api/storage/documents/download?path=${encodeURIComponent(avatarPath)}&download=0` : metadataAvatar

    return {
      name,
      email: user.email ?? '',
      role: role || DEFAULT_ROLE,
      avatarUrl
    }
  }, [role, user])

  const handleDropdownOpen = () => {
    setOpen(prev => !prev)
  }

  const handleDropdownClose = (event, url) => {
    if (url) {
      router.push(url)
    }

    if (anchorRef.current && anchorRef.current.contains(event?.target)) {
      return
    }

    setOpen(false)
  }

  const handleLogout = async event => {
    const perf = createAuthPerfLogger('auth.logout')

    event.preventDefault()

    setIsSigningOut(true)

    perf.mark('signout-request-dispatched')

    let timedOut = false

    try {
      if (supabase) {
        const result = await withTimeout(supabase.auth.signOut({ scope: 'local' }), 2500)

        timedOut = Boolean(result?.timeout)
      }

      perf.mark('signout-request-complete')
    } catch {
      perf.mark('signout-request-failed')
    } finally {
      setOpen(false)

      router.replace('/login')

      router.refresh()

      if (timedOut && typeof window !== 'undefined') {
        setShowSignoutTimeout(true)
        window.setTimeout(() => {
          if (window.location.pathname !== '/login') {
            window.location.assign('/login')
          }
        }, 300)
      }

      perf.mark('login-redirected')
      perf.done()
      setIsSigningOut(false)
    }
  }

  return (
    <>
      <IconButton
        ref={anchorRef}
        className='mis-2'
        onClick={handleDropdownOpen}
        aria-label='Open account menu'
        aria-haspopup='menu'
        aria-expanded={open ? 'true' : undefined}
        aria-controls={open ? 'user-menu' : undefined}
      >
        <Badge
          overlap='circular'
          badgeContent={<BadgeContentSpan />}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        >
          <Avatar alt={userState.name} src={userState.avatarUrl || undefined} className='bs-[38px] is-[38px]'>
            {userState.name.charAt(0).toUpperCase()}
          </Avatar>
        </Badge>
      </IconButton>
      <Popper
        open={open}
        transition
        disablePortal
        placement='bottom-end'
        anchorEl={anchorRef.current}
        className='min-is-[240px] !mbs-4 z-[1]'
      >
        {({ TransitionProps, placement }) => (
          <Fade
            {...TransitionProps}
            style={{
              transformOrigin: placement === 'bottom-end' ? 'right top' : 'left top'
            }}
          >
            <Paper
              className='shadow-lg'
              sx={{
                overflow: 'hidden',
                borderRadius: '20px',
                border: '1px solid var(--mui-palette-divider)',
                boxShadow: 'var(--mui-customShadows-md)'
              }}
            >
              <ClickAwayListener onClickAway={event => handleDropdownClose(event)}>
                <MenuList id='user-menu' aria-label='Account menu'>
                  <div
                    className='flex items-center plb-3 pli-4 gap-3'
                    tabIndex={-1}
                    style={{ background: 'rgb(var(--mui-palette-primary-mainChannel) / 0.06)' }}
                  >
                    <Avatar
                      alt={userState.name}
                      src={userState.avatarUrl || undefined}
                      sx={{ width: 42, height: 42, boxShadow: 'var(--mui-customShadows-xs)' }}
                    >
                      {userState.name.charAt(0).toUpperCase()}
                    </Avatar>
                    <div className='flex items-start flex-col'>
                      <Typography className='font-medium' color='text.primary'>
                        {userState.name}
                      </Typography>
                      <Typography
                        variant='caption'
                        sx={{
                          marginTop: '0.125rem',
                          borderRadius: '999px',
                          padding: '0.15rem 0.5rem',
                          backgroundColor: 'var(--palette-surface-light)',
                          color: 'var(--mui-palette-text-secondary)'
                        }}
                      >
                        {toLabel(userState.role)}
                      </Typography>
                    </div>
                  </div>
                  <Divider className='mlb-1' />
                  <MenuItem className='gap-3' onClick={event => handleDropdownClose(event, '/account-settings')}>
                    <i className='ri-user-settings-line' />
                    <Typography color='text.primary'>Account Settings</Typography>
                  </MenuItem>
                  {userState.role !== 'tenant' && (
                    <MenuItem className='gap-3' onClick={event => handleDropdownClose(event, '/tenants')}>
                      <i className='ri-group-line' />
                      <Typography color='text.primary'>Tenant Directory</Typography>
                    </MenuItem>
                  )}
                  {['admin', 'landlord', 'agent'].includes(userState.role) && (
                    <MenuItem className='gap-3' onClick={event => handleDropdownClose(event, '/reports')}>
                      <i className='ri-bar-chart-2-line' />
                      <Typography color='text.primary'>Financial Reports</Typography>
                    </MenuItem>
                  )}
                  {userState.role === 'admin' && (
                    <MenuItem className='gap-3' onClick={event => handleDropdownClose(event, '/admin')}>
                      <i className='ri-shield-check-line' />
                      <Typography color='text.primary'>System Admin</Typography>
                    </MenuItem>
                  )}
                  <div className='flex items-center plb-2 pli-4'>
                    <Button
                      fullWidth
                      variant='contained'
                      color='primary'
                      size='small'
                      endIcon={<i className='ri-logout-box-r-line' />}
                      onClick={handleLogout}
                      disabled={isSigningOut}
                      sx={{ '& .MuiButton-endIcon': { marginInlineStart: 1.5 } }}
                    >
                      {isSigningOut ? 'Signing out...' : 'Logout'}
                    </Button>
                  </div>
                </MenuList>
              </ClickAwayListener>
            </Paper>
          </Fade>
        )}
      </Popper>
      <Snackbar
        open={showSignoutTimeout}
        autoHideDuration={4000}
        onClose={() => setShowSignoutTimeout(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity='warning' variant='filled' onClose={() => setShowSignoutTimeout(false)}>
          Sign-out timed out. Redirecting to login.
        </Alert>
      </Snackbar>
    </>
  )
}

export default UserDropdown
