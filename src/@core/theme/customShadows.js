const customShadows = mode => {
  const isLight = mode === 'light'

  return {
    xs: isLight
      ? 'rgb(0 0 0 / 0.02) 0px 0px 0px 1px, rgb(0 0 0 / 0.04) 0px 2px 6px, rgb(0 0 0 / 0.08) 0px 4px 8px'
      : 'rgb(0 0 0 / 0.38) 0px 0px 0px 1px, rgb(0 0 0 / 0.32) 0px 6px 18px',
    sm: isLight
      ? 'rgb(0 0 0 / 0.02) 0px 0px 0px 1px, rgb(0 0 0 / 0.04) 0px 2px 6px, rgb(0 0 0 / 0.1) 0px 4px 8px'
      : 'rgb(0 0 0 / 0.4) 0px 0px 0px 1px, rgb(0 0 0 / 0.34) 0px 8px 20px',
    md: isLight
      ? 'rgb(0 0 0 / 0.02) 0px 0px 0px 1px, rgb(0 0 0 / 0.05) 0px 4px 12px, rgb(0 0 0 / 0.12) 0px 12px 24px'
      : 'rgb(0 0 0 / 0.42) 0px 0px 0px 1px, rgb(0 0 0 / 0.36) 0px 12px 28px',
    lg: isLight
      ? 'rgb(0 0 0 / 0.03) 0px 0px 0px 1px, rgb(0 0 0 / 0.06) 0px 10px 24px, rgb(0 0 0 / 0.14) 0px 18px 36px'
      : 'rgb(0 0 0 / 0.46) 0px 0px 0px 1px, rgb(0 0 0 / 0.4) 0px 18px 40px',
    xl: isLight
      ? 'rgb(0 0 0 / 0.04) 0px 0px 0px 1px, rgb(0 0 0 / 0.08) 0px 18px 40px, rgb(0 0 0 / 0.16) 0px 24px 48px'
      : 'rgb(0 0 0 / 0.5) 0px 0px 0px 1px, rgb(0 0 0 / 0.44) 0px 24px 56px'
  }
}

export default customShadows
