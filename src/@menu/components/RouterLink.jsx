'use client'

// React Imports
import { forwardRef } from 'react'

// Next Imports
import Link from 'next/link'

export const RouterLink = forwardRef((props, ref) => {
  // Props
  const { href, className, prefetch = true, ...other } = props

  return (
    <Link ref={ref} href={href} prefetch={prefetch} className={className} {...other}>
      {props.children}
    </Link>
  )
})
