'use client'

// MUI Imports
import Box from '@mui/material/Box'
import IconButton from '@mui/material/IconButton'
import Typography from '@mui/material/Typography'

// Hook Imports
import useVerticalNav from '@menu/hooks/useVerticalNav'

const NavSearch = () => {
  // Hooks
  const { isBreakpointReached } = useVerticalNav()

  return isBreakpointReached ? (
    <IconButton className='text-textPrimary' aria-label='Search records'>
      <i className='ri-search-line' />
    </IconButton>
  ) : (
    <Box
      className='flex items-center gap-2 rounded-full px-2 py-1'
      sx={{
        minWidth: 240,
        border: '1px solid var(--mui-palette-divider)',
        backgroundColor: 'var(--mui-palette-background-paper)',
        boxShadow: 'var(--mui-customShadows-sm)'
      }}
    >
      <IconButton className='text-textPrimary' aria-label='Search records' size='small'>
        <i className='ri-search-line' />
      </IconButton>
      <Box className='min-is-0 flex-1'>
        <Typography className='truncate text-sm font-medium text-textPrimary'>Search records</Typography>
        <Typography className='truncate text-[11px] text-textSecondary'>Properties, tenants, invoices</Typography>
      </Box>
      <span className='rounded-full bg-actionHover px-2 py-1 text-[11px] text-textDisabled'>Ctrl K</span>
    </Box>
  )
}

export default NavSearch
