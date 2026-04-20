'use client'

// Next Imports
import { useMemo } from 'react'

import Link from 'next/link'

// Third-party Imports
import classnames from 'classnames'

// Hook Imports
import useVerticalNav from '@menu/hooks/useVerticalNav'

// Util Imports
import { verticalLayoutClasses } from '@layouts/utils/layoutClasses'
import { canAccessPath, DEFAULT_ROLE, getHomeForRole } from '@/libs/auth/roles'
import { useAuthSession } from '@/contexts/auth-session-context'

const FooterContent = () => {
  // Hooks
  const { isBreakpointReached } = useVerticalNav()
  const { loading, role } = useAuthSession()
  const effectiveRole = role || DEFAULT_ROLE

  const quickLinks = useMemo(() => {
    if (loading) {
      return []
    }

    const links = []
    const seen = new Set()

    const addLink = (href, label) => {
      if (!href || seen.has(href)) {
        return
      }

      seen.add(href)
      links.push({ href, label })
    }

    addLink(getHomeForRole(effectiveRole), 'Role Home')

    if (canAccessPath('/reports', effectiveRole)) {
      addLink('/reports', 'Reports')
    }

    if (canAccessPath('/admin-dashboard', effectiveRole)) {
      addLink('/admin-dashboard', 'Admin Dashboard')
    }

    return links
  }, [effectiveRole, loading])

  return (
    <div
      className={classnames(verticalLayoutClasses.footerContent, 'flex items-center justify-between flex-wrap gap-4')}
    >
      <p>
        <span>{`© ${new Date().getFullYear()} Mambaproperties.`}</span>
        <span>{` Built for landlords, managers, and tenants.`}</span>
      </p>
      {!isBreakpointReached && (
        <div className='flex items-center gap-4'>
          {quickLinks.map(link => (
            <Link key={link.href} href={link.href} className='text-primary font-medium'>
              {link.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

export default FooterContent
