// Config Imports
import themeConfig from '@configs/themeConfig'

const iconButton = {
  MuiIconButton: {
    styleOverrides: {
      root: {
        borderRadius: '999px',
        transition: 'transform 160ms ease, box-shadow 160ms ease, background-color 160ms ease',
        '& .MuiSvgIcon-root, & i, & svg': {
          fontSize: 'inherit'
        }
      },
      sizeSmall: ({ theme }) => ({
        padding: theme.spacing(1.75),
        fontSize: '1.25rem'
      }),
      sizeMedium: ({ theme }) => ({
        padding: theme.spacing(2),
        fontSize: '1.375rem'
      }),
      sizeLarge: ({ theme }) => ({
        padding: theme.spacing(2.25),
        fontSize: '1.5rem'
      })
    },
    variants: [
      {
        props: { color: 'default' },
        style: {
          backgroundColor: '#f2f2f2',
          color: 'var(--mui-palette-text-primary)',
          '&:not(.Mui-disabled):hover, &:not(.Mui-disabled):active': {
            backgroundColor: '#ffffff',
            boxShadow: 'rgba(0,0,0,0.08) 0px 4px 12px',
            transform: 'translateY(-1px)'
          },
          ...(themeConfig.disableRipple && {
            '&.Mui-focusVisible:not(.Mui-disabled)': {
              backgroundColor: '#ffffff'
            }
          }),
          '&.Mui-focusVisible': {
            boxShadow: 'rgb(255 255 255) 0px 0px 0px 4px, 0 0 0 2px var(--mui-palette-text-primary)',
            transform: 'scale(0.92)'
          },
          '&.Mui-disabled': {
            opacity: 0.45,
            color: 'var(--mui-palette-action-active)'
          }
        }
      },
      {
        props: { color: 'primary' },
        style: {
          backgroundColor: 'rgb(var(--mui-palette-primary-mainChannel) / 0.12)',
          '&:not(.Mui-disabled):hover, &:not(.Mui-disabled):active': {
            backgroundColor: 'rgb(var(--mui-palette-primary-mainChannel) / 0.18)',
            boxShadow: 'rgba(0,0,0,0.08) 0px 4px 12px',
            transform: 'translateY(-1px)'
          },
          ...(themeConfig.disableRipple && {
            '&.Mui-focusVisible:not(.Mui-disabled)': { backgroundColor: 'var(--mui-palette-primary-lighterOpacity)' }
          }),
          '&.Mui-focusVisible': {
            boxShadow: 'rgb(255 255 255) 0px 0px 0px 4px, 0 0 0 2px var(--mui-palette-primary-main)',
            transform: 'scale(0.92)'
          },
          '&.Mui-disabled': {
            opacity: 0.45,
            color: 'var(--mui-palette-primary-main)'
          }
        }
      },
      {
        props: { color: 'secondary' },
        style: {
          '&:not(.Mui-disabled):hover, &:not(.Mui-disabled):active': {
            backgroundColor: 'var(--mui-palette-secondary-lighterOpacity)'
          },
          ...(themeConfig.disableRipple && {
            '&.Mui-focusVisible:not(.Mui-disabled)': { backgroundColor: 'var(--mui-palette-secondary-lighterOpacity)' }
          }),
          '&.Mui-disabled': {
            opacity: 0.45,
            color: 'var(--mui-palette-secondary-main)'
          }
        }
      },
      {
        props: { color: 'error' },
        style: {
          '&:not(.Mui-disabled):hover, &:not(.Mui-disabled):active': {
            backgroundColor: 'var(--mui-palette-error-lighterOpacity)'
          },
          ...(themeConfig.disableRipple && {
            '&.Mui-focusVisible:not(.Mui-disabled)': { backgroundColor: 'var(--mui-palette-error-lighterOpacity)' }
          }),
          '&.Mui-disabled': {
            opacity: 0.45,
            color: 'var(--mui-palette-error-main)'
          }
        }
      },
      {
        props: { color: 'warning' },
        style: {
          '&:not(.Mui-disabled):hover, &:not(.Mui-disabled):active': {
            backgroundColor: 'var(--mui-palette-warning-lighterOpacity)'
          },
          ...(themeConfig.disableRipple && {
            '&.Mui-focusVisible:not(.Mui-disabled)': { backgroundColor: 'var(--mui-palette-warning-lighterOpacity)' }
          }),
          '&.Mui-disabled': {
            opacity: 0.45,
            color: 'var(--mui-palette-warning-main)'
          }
        }
      },
      {
        props: { color: 'info' },
        style: {
          '&:not(.Mui-disabled):hover, &:not(.Mui-disabled):active': {
            backgroundColor: 'var(--mui-palette-info-lighterOpacity)'
          },
          ...(themeConfig.disableRipple && {
            '&.Mui-focusVisible:not(.Mui-disabled)': { backgroundColor: 'var(--mui-palette-info-lighterOpacity)' }
          }),
          '&.Mui-disabled': {
            opacity: 0.45,
            color: 'var(--mui-palette-info-main)'
          }
        }
      },
      {
        props: { color: 'success' },
        style: {
          '&:not(.Mui-disabled):hover, &:not(.Mui-disabled):active': {
            backgroundColor: 'var(--mui-palette-success-lighterOpacity)'
          },
          ...(themeConfig.disableRipple && {
            '&.Mui-focusVisible:not(.Mui-disabled)': { backgroundColor: 'var(--mui-palette-success-lighterOpacity)' }
          }),
          '&.Mui-disabled': {
            opacity: 0.45,
            color: 'var(--mui-palette-success-main)'
          }
        }
      }
    ]
  }
}

export default iconButton
