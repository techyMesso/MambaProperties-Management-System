'use client'

// Next Imports
import Link from 'next/link'
import Image from 'next/image'
import { useSearchParams } from 'next/navigation'

// MUI Imports
import Button from '@mui/material/Button'
import Typography from '@mui/material/Typography'

// Component Imports
import Illustrations from '@components/Illustrations'

// Hook Imports
import { useImageVariant } from '@core/hooks/useImageVariant'

const NotFound = ({ mode }) => {
  // Vars
  const darkImg = '/images/pages/misc-mask-dark.png'
  const lightImg = '/images/pages/misc-mask-light.png'

  // Hooks
  const searchParams = useSearchParams()
  const miscBackground = useImageVariant(mode, lightImg, darkImg)

  const code = searchParams.get('code')
  const isForbidden = code === '403'

  return (
    <div className='flex items-center justify-center min-bs-[100dvh] relative p-6 overflow-x-hidden'>
      <div className='flex items-center flex-col text-center gap-10'>
        <div className='flex flex-col gap-2 is-[90vw] sm:is-[unset]'>
          <Typography className='font-medium text-8xl' color='text.primary'>
            {isForbidden ? '403' : '404'}
          </Typography>
          <Typography variant='h4'>{isForbidden ? 'Access Denied' : 'Page Not Found'}</Typography>
          <Typography>
            {isForbidden
              ? 'Your account role does not have permission to open this page.'
              : "We couldn't find the page you are looking for."}
          </Typography>
        </div>
        <Image
          alt='error-illustration'
          src='/images/illustrations/characters/5.png'
          className='object-cover bs-[400px] md:bs-[450px] lg:bs-[500px]'
          width={500}
          height={500}
        />
        <Button href='/' component={Link} variant='contained'>
          Back to Home
        </Button>
      </div>
      <Illustrations maskImg={{ src: miscBackground }} />
    </div>
  )
}

export default NotFound
