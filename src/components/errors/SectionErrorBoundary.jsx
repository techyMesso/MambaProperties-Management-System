'use client'

import { Component } from 'react'

import Alert from '@mui/material/Alert'

class SectionErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch() {
    // No-op: UI fallback only.
  }

  render() {
    if (this.state.hasError) {
      return (
        <Alert severity='error' variant='tonal'>
          This section failed to load. Refresh the page to retry.
        </Alert>
      )
    }

    return this.props.children
  }
}

export default SectionErrorBoundary

