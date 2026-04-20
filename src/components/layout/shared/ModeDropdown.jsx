'use client'

// React Imports
import { useState } from 'react'

// MUI Imports
import Box from '@mui/material/Box'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'

// Hook Imports
import { useSettings } from '@core/hooks/useSettings'

const ModeDropdown = () => {
  // States
  const [tooltipOpen, setTooltipOpen] = useState(false)

  // Hooks
  const { settings, updateSettings } = useSettings()

  const handleToggle = mode => {
    if (settings.mode !== mode) {
      updateSettings({ mode })
    }
  }

  const activeMode = settings.mode === 'dark' ? 'dark' : 'light'

  const modes = [
    { key: 'light', label: 'Light', icon: 'ri-sun-line' },
    { key: 'dark', label: 'Dark', icon: 'ri-moon-clear-line' }
  ]

  return (
    <Tooltip
      title={`${activeMode} mode`}
      onOpen={() => setTooltipOpen(true)}
      onClose={() => setTooltipOpen(false)}
      open={tooltipOpen}
      PopperProps={{ className: 'capitalize' }}
    >
      <Box className='mp-mode-toggle' role='group' aria-label='Theme mode switcher' data-mode={activeMode}>
        <span className='mp-mode-toggle-thumb' aria-hidden='true' />
        {modes.map(mode => (
          <button
            key={mode.key}
            type='button'
            className={`mp-mode-toggle-option${activeMode === mode.key ? ' is-active' : ''}`}
            onClick={() => handleToggle(mode.key)}
            aria-pressed={activeMode === mode.key}
            aria-label={`Switch to ${mode.label.toLowerCase()} mode`}
          >
            <span className='mp-mode-toggle-icon' aria-hidden='true'>
              <i className={mode.icon} />
            </span>
            <Typography component='span' className='mp-mode-toggle-label'>
              {mode.label}
            </Typography>
          </button>
        ))}
      </Box>
    </Tooltip>
  )
}

export default ModeDropdown
