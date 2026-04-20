const paper = {
  MuiPaper: {
    styleOverrides: {
      root: ({ theme }) => ({
        backgroundImage: 'none',
        borderRadius: theme.shape.customBorderRadius.md
      }),
      rounded: ({ theme }) => ({
        borderRadius: theme.shape.customBorderRadius.lg
      }),
      outlined: {
        borderColor: 'var(--mui-palette-divider)'
      }
    }
  }
}

export default paper
