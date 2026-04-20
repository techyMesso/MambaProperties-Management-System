const drawer = skin => ({
  MuiDrawer: {
    defaultProps: {
      ...(skin === 'bordered' && {
        PaperProps: {
          elevation: 0
        }
      })
    },
    styleOverrides: {
      paper: {
        borderInlineEnd: '1px solid var(--mui-palette-divider)',
        ...(skin !== 'bordered' && {
          boxShadow: 'var(--mui-customShadows-md)'
        })
      }
    }
  }
})

export default drawer
