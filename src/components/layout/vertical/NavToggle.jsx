'use client'

// MUI Imports
import IconButton from '@mui/material/IconButton'

// Hook Imports
import useVerticalNav from '@menu/hooks/useVerticalNav'

const NavToggle = () => {
  // Hooks
  const { toggleVerticalNav, isBreakpointReached } = useVerticalNav()

  const handleClick = () => {
    toggleVerticalNav()
  }

  return (
    <>
      {/* <IconButton aria-label='Open navigation menu'><i className='ri-menu-line text-xl' /></IconButton> */}
      {/* Comment following code and uncomment above code in order to toggle menu on desktop screens as well */}
      {isBreakpointReached && (
        <IconButton aria-label='Open navigation menu' onClick={handleClick} className='text-textPrimary'>
          <i className='ri-menu-line text-xl' />
        </IconButton>
      )}
    </>
  )
}

export default NavToggle
