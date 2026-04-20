// Next Imports
import Link from 'next/link'

// MUI Imports
import Badge from '@mui/material/Badge'
import IconButton from '@mui/material/IconButton'

// Third-party Imports
import classnames from 'classnames'

// Component Imports
import NavToggle from './NavToggle'
import NavSearch from '@components/layout/shared/search'
import ModeDropdown from '@components/layout/shared/ModeDropdown'
import UserDropdown from '@components/layout/shared/UserDropdown'

// Util Imports
import { verticalLayoutClasses } from '@layouts/utils/layoutClasses'

const NavbarContent = () => {
  return (
    <div className={classnames(verticalLayoutClasses.navbarContent, 'flex items-center justify-between gap-4 is-full')}>
      <div className='flex items-center gap-2 sm:gap-4'>
        <NavToggle />
        <NavSearch />
      </div>
      <div className='flex items-center gap-2'>
        <Link
          className='flex items-center mie-1 text-sm font-semibold rounded-full px-4 py-2 transition'
          href='/marketplace'
          style={{
            color: 'var(--mui-palette-text-primary)',
            background: 'var(--palette-surface-light)',
            border: '1px solid var(--mui-palette-divider)',
            boxShadow: 'var(--mui-customShadows-xs)'
          }}
        >
          Housing Marketplace
        </Link>
        <div
          className='flex items-center justify-center rounded-full'
          style={{
            border: '1px solid var(--mui-palette-divider)',
            background: 'var(--mui-palette-background-paper)',
            boxShadow: 'var(--mui-customShadows-xs)'
          }}
        >
          <ModeDropdown />
        </div>
        <Badge
          color='primary'
          variant='dot'
          overlap='circular'
          sx={{
            '& .MuiBadge-badge': {
              backgroundColor: '#ff385c',
              boxShadow: '0 0 0 2px var(--mui-palette-background-paper)'
            }
          }}
        >
          <IconButton className='text-textPrimary' aria-label='notifications'>
            <i className='ri-notification-2-line' />
          </IconButton>
        </Badge>
        <UserDropdown />
      </div>
    </div>
  )
}

export default NavbarContent
