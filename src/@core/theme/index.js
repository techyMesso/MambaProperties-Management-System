// Theme Options Imports
import overrides from './overrides'
import colorSchemes from './colorSchemes'
import spacing from './spacing'
import shadows from './shadows'
import customShadows from './customShadows'
import typography from './typography'

const appFontFamily = ['DM Sans', 'Circular', '-apple-system', 'system-ui', 'Roboto', '"Helvetica Neue"', 'Arial', 'sans-serif'].join(
  ', '
)

const theme = (mode, direction) => {
  return {
    direction,
    components: overrides(),
    colorSchemes: colorSchemes(),
    ...spacing,
    shape: {
      borderRadius: 20,
      customBorderRadius: {
        xs: 4,
        sm: 8,
        md: 14,
        lg: 20,
        xl: 32
      }
    },
    shadows: shadows(mode),
    typography: typography(appFontFamily),
    customShadows: customShadows(mode),
    mainColorChannels: {
      light: '34 34 34',
      dark: '245 245 245',
      lightShadow: '34 34 34',
      darkShadow: '10 10 10'
    }
  }
}

export default theme
