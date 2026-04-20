'use client'

// React Imports
import { useMemo } from 'react'

// MUI Imports
import Box from '@mui/material/Box'
import CircularProgress from '@mui/material/CircularProgress'
import { useTheme } from '@mui/material/styles'

// Third-party Imports
import PerfectScrollbar from 'react-perfect-scrollbar'

// Component Imports
import { Menu, SubMenu, MenuItem, MenuSection } from '@menu/vertical-menu'

// Hook Imports
import useVerticalNav from '@menu/hooks/useVerticalNav'

// Styled Component Imports
import StyledVerticalNavExpandIcon from '@menu/styles/vertical/StyledVerticalNavExpandIcon'

// Style Imports
import menuItemStyles from '@core/styles/vertical/menuItemStyles'
import menuSectionStyles from '@core/styles/vertical/menuSectionStyles'

// Lib Imports
import { canAccessPath, DEFAULT_ROLE } from '@/libs/auth/roles'
import { useAuthSession } from '@/contexts/auth-session-context'

const RenderExpandIcon = ({ open, transitionDuration }) => (
  <StyledVerticalNavExpandIcon open={open} transitionDuration={transitionDuration}>
    <i className='ri-arrow-right-s-line' />
  </StyledVerticalNavExpandIcon>
)

const VerticalMenu = ({ scrollMenu }) => {
  const theme = useTheme()
  const { isBreakpointReached, transitionDuration } = useVerticalNav()
  const ScrollWrapper = isBreakpointReached ? 'div' : PerfectScrollbar
  const { loading, role } = useAuthSession()

  const allowed = useMemo(() => {
    if (loading) {
      return null
    }

    const effectiveRole = role || DEFAULT_ROLE
    const canView = path => canAccessPath(path, effectiveRole)
    const isAdmin = effectiveRole === 'admin'

    return {
      isAdmin,
      dashboards: {
        roleHome: canView('/dashboard'),
        adminDashboard: canView('/admin-dashboard'),
        landlordDashboard: canView('/landlord-dashboard'),
        agentDashboard: canView('/agent-dashboard'),
        tenantDashboard: canView('/tenant-dashboard')
      },
      propertyOps: {
        properties: canView('/properties'),
        units: canView('/units'),
        tenants: canView('/tenants'),
        tenancies: canView('/tenancies'),
        marketplace: canView('/marketplace')
      },
      finance: {
        payments: canView('/payments'),
        invoices: canView('/invoices'),
        reports: canView('/reports')
      },
      service: {
        maintenance: canView('/maintenance'),
        messaging: canView('/messaging'),
        documents: canView('/documents')
      },
      administration: {
        adminConsole: canView('/admin'),
        accountSettings: true,
        landing: true
      },
      adminTabs: {
        landlordLeads: canView('/landlord-leads'),
        onboardingPipeline: canView('/onboarding-pipeline'),
        landlordVerification: canView('/landlord-verification'),
        subscriptionsPlans: canView('/subscriptions-plans'),
        feesCommissions: canView('/fees-commissions'),
        incomeAnalytics: canView('/income-analytics'),
        userManagement: canView('/user-management'),
        paymentsMonitoring: canView('/payments-monitoring'),
        auditSecurity: canView('/audit-security'),
        reportsAnalytics: canView('/reports'),
        documentsReview: canView('/documents-review'),
        systemSettings: canView('/system-settings')
      }
    }
  }, [loading, role])

  return (
    <ScrollWrapper
      {...(isBreakpointReached
        ? {
            className: 'bs-full overflow-y-auto overflow-x-hidden',
            onScroll: container => scrollMenu(container, false)
          }
        : {
            options: { wheelPropagation: false, suppressScrollX: true },
            onScrollY: container => scrollMenu(container, true)
          })}
    >
      {!allowed ? (
        <Box className='flex justify-center items-center py-6'>
          <CircularProgress size={24} />
        </Box>
      ) : (
        <Menu
          menuItemStyles={menuItemStyles(theme)}
          renderExpandIcon={({ open }) => <RenderExpandIcon open={open} transitionDuration={transitionDuration} />}
          renderExpandedMenuItemIcon={{ icon: <i className='ri-circle-line' /> }}
          menuSectionStyles={menuSectionStyles(theme)}
        >
          {allowed.isAdmin ? (
            <>
              <MenuSection label='Growth & Acquisition'>
                {allowed.dashboards.adminDashboard && (
                  <MenuItem href='/admin-dashboard' icon={<i className='ri-shield-star-line' />}>
                    Admin Dashboard
                  </MenuItem>
                )}
                {allowed.adminTabs.landlordLeads && (
                  <MenuItem href='/landlord-leads' icon={<i className='ri-user-add-line' />}>
                    Landlord Leads
                  </MenuItem>
                )}
                {allowed.adminTabs.onboardingPipeline && (
                  <MenuItem href='/onboarding-pipeline' icon={<i className='ri-route-line' />}>
                    Onboarding Pipeline
                  </MenuItem>
                )}
                {allowed.adminTabs.landlordVerification && (
                  <MenuItem href='/landlord-verification' icon={<i className='ri-user-search-line' />}>
                    Landlord Verification
                  </MenuItem>
                )}
                {allowed.adminTabs.userManagement && (
                  <MenuItem href='/user-management' icon={<i className='ri-group-line' />}>
                    User Management
                  </MenuItem>
                )}
              </MenuSection>

              <MenuSection label='Revenue Operations'>
                {allowed.adminTabs.subscriptionsPlans && (
                  <MenuItem href='/subscriptions-plans?action=Plan%20Upgrade' icon={<i className='ri-vip-crown-line' />}>
                    Subscriptions & Plans
                  </MenuItem>
                )}
                {allowed.adminTabs.feesCommissions && (
                  <MenuItem href='/fees-commissions?action=Fee%20Rule' icon={<i className='ri-percent-line' />}>
                    Fees & Commissions
                  </MenuItem>
                )}
                {allowed.adminTabs.incomeAnalytics && (
                  <MenuItem href='/income-analytics' icon={<i className='ri-line-chart-line' />}>
                    Income Analytics
                  </MenuItem>
                )}
                {allowed.adminTabs.reportsAnalytics && (
                  <MenuItem href='/reports' icon={<i className='ri-bar-chart-box-line' />}>
                    Reports & Analytics
                  </MenuItem>
                )}
              </MenuSection>

              <MenuSection label='Risk & Compliance'>
                {allowed.adminTabs.paymentsMonitoring && (
                  <MenuItem href='/payments-monitoring' icon={<i className='ri-bank-card-line' />}>
                    Payments Monitoring
                  </MenuItem>
                )}
                {allowed.adminTabs.auditSecurity && (
                  <MenuItem href='/audit-security?status=pending' icon={<i className='ri-shield-check-line' />}>
                    Audit Logs & Security
                  </MenuItem>
                )}
                {allowed.adminTabs.documentsReview && (
                  <MenuItem href='/documents-review?status=pending%20review' icon={<i className='ri-folder-shield-2-line' />}>
                    Documents Review
                  </MenuItem>
                )}
                {allowed.adminTabs.systemSettings && (
                  <MenuItem href='/system-settings' icon={<i className='ri-settings-3-line' />}>
                    System Settings
                  </MenuItem>
                )}
              </MenuSection>

              <MenuSection label='Role Views'>
                {allowed.dashboards.landlordDashboard && (
                  <MenuItem href='/landlord-dashboard' icon={<i className='ri-building-line' />}>
                    Landlord View
                  </MenuItem>
                )}
                {allowed.dashboards.agentDashboard && (
                  <MenuItem href='/agent-dashboard' icon={<i className='ri-briefcase-4-line' />}>
                    Agent View
                  </MenuItem>
                )}
              </MenuSection>

              <MenuSection label='Administration'>
                <SubMenu label='System Control' icon={<i className='ri-shield-keyhole-line' />}>
                  {allowed.administration.adminConsole && <MenuItem href='/admin'>Admin Console</MenuItem>}
                  {allowed.administration.accountSettings && <MenuItem href='/account-settings'>Account Settings</MenuItem>}
                </SubMenu>
                {allowed.administration.landing && (
                  <MenuItem href='/' icon={<i className='ri-rocket-line' />}>
                    Public Landing Page
                  </MenuItem>
                )}
              </MenuSection>
            </>
          ) : (
            <>
              {(allowed.dashboards.roleHome ||
                allowed.dashboards.adminDashboard ||
                allowed.dashboards.landlordDashboard ||
                allowed.dashboards.agentDashboard ||
                allowed.dashboards.tenantDashboard) && (
                <MenuSection label='Dashboards'>
                  {allowed.dashboards.roleHome && (
                    <MenuItem href='/dashboard' icon={<i className='ri-home-5-line' />}>
                      Role Home
                    </MenuItem>
                  )}
                  {allowed.dashboards.adminDashboard && (
                    <MenuItem href='/admin-dashboard' icon={<i className='ri-shield-star-line' />}>
                      Admin Dashboard
                    </MenuItem>
                  )}
                  {allowed.dashboards.landlordDashboard && (
                    <MenuItem href='/landlord-dashboard' icon={<i className='ri-building-line' />}>
                      Landlord Dashboard
                    </MenuItem>
                  )}
                  {allowed.dashboards.agentDashboard && (
                    <MenuItem href='/agent-dashboard' icon={<i className='ri-briefcase-4-line' />}>
                      Agent Dashboard
                    </MenuItem>
                  )}
                  {allowed.dashboards.tenantDashboard && (
                    <MenuItem href='/tenant-dashboard' icon={<i className='ri-user-star-line' />}>
                      Tenant Dashboard
                    </MenuItem>
                  )}
                </MenuSection>
              )}

              {(allowed.propertyOps.properties ||
                allowed.propertyOps.units ||
                allowed.propertyOps.tenants ||
                allowed.propertyOps.tenancies ||
                allowed.propertyOps.marketplace) && (
                <MenuSection label='Property Operations'>
                  {allowed.propertyOps.properties && (
                    <MenuItem href='/properties' icon={<i className='ri-community-line' />}>
                      Plots & Estates
                    </MenuItem>
                  )}
                  {allowed.propertyOps.units && (
                    <MenuItem href='/units' icon={<i className='ri-building-2-line' />}>
                      Houses & Units
                    </MenuItem>
                  )}
                  {allowed.propertyOps.tenants && (
                    <MenuItem href='/tenants' icon={<i className='ri-group-line' />}>
                      Tenants
                    </MenuItem>
                  )}
                  {allowed.propertyOps.tenancies && (
                    <MenuItem href='/tenancies' icon={<i className='ri-file-list-3-line' />}>
                      Tenant-House Mapping
                    </MenuItem>
                  )}
                  {allowed.propertyOps.marketplace && (
                    <MenuItem href='/marketplace' icon={<i className='ri-store-2-line' />}>
                      Marketplace
                    </MenuItem>
                  )}
                </MenuSection>
              )}

              {(allowed.finance.payments || allowed.finance.invoices || allowed.finance.reports) && (
                <MenuSection label='Finance'>
                  {allowed.finance.payments && (
                    <MenuItem href='/payments' icon={<i className='ri-bank-card-line' />}>
                      Rent Payments
                    </MenuItem>
                  )}
                  {allowed.finance.invoices && (
                    <MenuItem href='/invoices' icon={<i className='ri-bill-line' />}>
                      Invoices & Receipts
                    </MenuItem>
                  )}
                  {allowed.finance.reports && (
                    <MenuItem href='/reports' icon={<i className='ri-bar-chart-box-line' />}>
                      Reports & Analytics
                    </MenuItem>
                  )}
                </MenuSection>
              )}

              {(allowed.service.maintenance || allowed.service.messaging || allowed.service.documents) && (
                <MenuSection label='Service & Files'>
                  {allowed.service.maintenance && (
                    <MenuItem href='/maintenance' icon={<i className='ri-tools-line' />}>
                      Maintenance
                    </MenuItem>
                  )}
                  {allowed.service.messaging && (
                    <MenuItem href='/messaging' icon={<i className='ri-message-3-line' />}>
                      Messaging
                    </MenuItem>
                  )}
                  {allowed.service.documents && (
                    <MenuItem href='/documents' icon={<i className='ri-folder-2-line' />}>
                      Documents
                    </MenuItem>
                  )}
                </MenuSection>
              )}

              <MenuSection label='Administration'>
                <SubMenu label='System Control' icon={<i className='ri-shield-keyhole-line' />}>
                  {allowed.administration.adminConsole && <MenuItem href='/admin'>Admin Console</MenuItem>}
                  {allowed.administration.accountSettings && <MenuItem href='/account-settings'>Account Settings</MenuItem>}
                </SubMenu>
                {allowed.administration.landing && (
                  <MenuItem href='/' icon={<i className='ri-rocket-line' />}>
                    Public Landing Page
                  </MenuItem>
                )}
              </MenuSection>
            </>
          )}
        </Menu>
      )}
    </ScrollWrapper>
  )
}

export default VerticalMenu
