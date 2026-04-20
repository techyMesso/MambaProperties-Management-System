// Layout Imports
import LayoutWrapper from '@layouts/LayoutWrapper'
import VerticalLayout from '@layouts/VerticalLayout'

// Component Imports
import Providers from '@components/Providers'
import Navigation from '@components/layout/vertical/Navigation'
import Navbar from '@components/layout/vertical/Navbar'
import VerticalFooter from '@components/layout/vertical/Footer'
import DashboardRoutePrefetch from '@components/layout/shared/DashboardRoutePrefetch'
import RealtimeDashboardSync from '@components/layout/shared/RealtimeDashboardSync'

const Layout = ({ children }) => {
  // Vars
  const direction = 'ltr'

  return (
    <Providers direction={direction}>
      <DashboardRoutePrefetch />
      <RealtimeDashboardSync />
      <a href='#main-content' className='mp-skip-link'>
        Skip to main content
      </a>
      <LayoutWrapper
        verticalLayout={
          <VerticalLayout navigation={<Navigation />} navbar={<Navbar />} footer={<VerticalFooter />}>
            {children}
          </VerticalLayout>
        }
      />
    </Providers>
  )
}

export default Layout
