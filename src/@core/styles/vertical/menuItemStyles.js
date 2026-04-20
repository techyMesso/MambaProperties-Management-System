// MUI Imports
// Util Imports
import { menuClasses } from '@menu/utils/menuClasses'

const menuItemStyles = theme => {
  return {
    root: {
      marginBlockStart: theme.spacing(1.5),
      [`&.${menuClasses.subMenuRoot}.${menuClasses.open} > .${menuClasses.button}, &.${menuClasses.subMenuRoot} > .${menuClasses.button}.${menuClasses.active}`]:
        {
          backgroundColor: 'var(--mui-palette-action-selected) !important'
        },
      [`&.${menuClasses.disabled} > .${menuClasses.button}`]: {
        color: 'var(--mui-palette-text-disabled)',
        [`& .${menuClasses.icon}`]: {
          color: 'inherit'
        }
      },
      [`&:not(.${menuClasses.subMenuRoot}) > .${menuClasses.button}.${menuClasses.active}`]: {
        color: 'var(--mui-palette-primary-main)',
        border: '1px solid rgb(var(--mui-palette-primary-mainChannel) / 0.24)',
        backgroundColor: 'var(--mui-palette-primary-lightOpacity)',
        [`& .${menuClasses.icon}`]: {
          color: 'inherit'
        }
      }
    },
    button: ({ active }) => ({
      paddingBlock: theme.spacing(2),
      '&:has(.MuiChip-root)': {
        paddingBlock: theme.spacing(1.75)
      },
      paddingInlineStart: theme.spacing(5.5),
      paddingInlineEnd: theme.spacing(3.5),
      borderStartEndRadius: 50,
      borderEndEndRadius: 50,
      borderStartStartRadius: 14,
      borderEndStartRadius: 14,
      ...(!active && {
        '&:hover, &:focus-visible': {
          backgroundColor: 'var(--mui-palette-action-hover)'
        },
        '&[aria-expanded="true"]': {
          backgroundColor: 'var(--mui-palette-action-selected)'
        }
      })
    }),
    icon: ({ level }) => ({
      ...(level === 0 && {
        fontSize: '1.375rem',
        marginInlineEnd: theme.spacing(2)
      }),
      ...(level > 0 && {
        fontSize: '0.75rem',
        color: 'var(--mui-palette-text-secondary)',
        marginInlineEnd: theme.spacing(3.5)
      }),
      ...(level === 1 && {
        marginInlineStart: theme.spacing(1.5)
      }),
      ...(level > 1 && {
        marginInlineStart: theme.spacing(1.5 + 2.5 * (level - 1))
      }),
      '& > i, & > svg': {
        fontSize: 'inherit'
      }
    }),
    prefix: {
      marginInlineEnd: theme.spacing(2)
    },
    suffix: {
      marginInlineStart: theme.spacing(2)
    },
    subMenuExpandIcon: {
      fontSize: '1.375rem',
      marginInlineStart: theme.spacing(2),
      '& i, & svg': {
        fontSize: 'inherit'
      }
    },
    subMenuContent: {
      backgroundColor: 'transparent'
    }
  }
}

export default menuItemStyles
