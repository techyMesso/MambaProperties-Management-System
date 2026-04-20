const typography = fontFamily => ({
  fontFamily:
    typeof fontFamily === 'undefined' || fontFamily === ''
      ? [
          'DM Sans',
          'Circular',
          '-apple-system',
          'system-ui',
          'Roboto',
          '"Helvetica Neue"',
          'Arial',
          'sans-serif'
        ].join(',')
      : fontFamily,
  fontSize: 14,
  h1: {
    fontSize: '2rem',
    fontWeight: 700,
    lineHeight: 1.25,
    letterSpacing: '-0.0275rem'
  },
  h2: {
    fontSize: '1.75rem',
    fontWeight: 700,
    lineHeight: 1.43,
    letterSpacing: 'normal'
  },
  h3: {
    fontSize: '1.375rem',
    fontWeight: 600,
    lineHeight: 1.18,
    letterSpacing: '-0.0275rem'
  },
  h4: {
    fontSize: '1.3125rem',
    fontWeight: 700,
    lineHeight: 1.43,
    letterSpacing: 'normal'
  },
  h5: {
    fontSize: '1.25rem',
    fontWeight: 600,
    lineHeight: 1.2,
    letterSpacing: '-0.01125rem'
  },
  h6: {
    fontSize: '1rem',
    fontWeight: 600,
    lineHeight: 1.25
  },
  subtitle1: {
    fontSize: '1rem',
    fontWeight: 500,
    lineHeight: 1.25
  },
  subtitle2: {
    fontSize: '0.875rem',
    fontWeight: 500,
    lineHeight: 1.29
  },
  body1: {
    fontSize: '0.875rem',
    fontWeight: 400,
    lineHeight: 1.43
  },
  body2: {
    fontSize: '0.8125rem',
    fontWeight: 400,
    lineHeight: 1.23
  },
  button: {
    fontSize: '1rem',
    lineHeight: 1.25,
    fontWeight: 500,
    letterSpacing: 'normal',
    textTransform: 'none'
  },
  caption: {
    fontSize: '0.75rem',
    fontWeight: 600,
    lineHeight: 1.33,
    letterSpacing: 'normal'
  },
  overline: {
    fontSize: '0.5rem',
    fontWeight: 700,
    lineHeight: 1.25,
    letterSpacing: '0.32px',
    textTransform: 'uppercase'
  }
})

export default typography
