// Third-party Imports
import 'react-perfect-scrollbar/dist/css/styles.css'

// Font Imports
import { DM_Sans, Outfit } from 'next/font/google'

// Style Imports
import '@/app/globals.css'

// Generated Icon CSS Imports
import '@assets/iconify-icons/generated-icons.css'

const dmSans = DM_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-dm-sans',
  display: 'swap'
})

const outfit = Outfit({
  subsets: ['latin'],
  weight: ['400', '600', '700', '800'],
  variable: '--font-outfit',
  display: 'swap'
})

export const metadata = {
  title: 'Mambaproperties | Rental & Estate Management',
  description:
    'Manage estates, rent collection, MPesa workflows, maintenance, and tenant operations in one platform.'
}

const RootLayout = ({ children }) => {
  // Vars
  const direction = 'ltr'

  return (
    <html
      id='__next'
      dir={direction}
      suppressHydrationWarning
      className={`${dmSans.variable} ${outfit.variable}`}
    >
      <body className='flex is-full min-bs-full flex-auto flex-col'>{children}</body>
    </html>
  )
}

export default RootLayout
