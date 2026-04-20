'use client'

import Image from 'next/image'

// MUI Components
import useMediaQuery from '@mui/material/useMediaQuery'
import { styled, useTheme } from '@mui/material/styles'

// Hook Imports
import { useImageVariant } from '@core/hooks/useImageVariant'

// Styled Components
const MaskImg = styled('img')({
  inlineSize: '100%',
  position: 'absolute',
  insetBlockEnd: 0,
  zIndex: -1
})

const Illustrations = props => {
  // Props
  const { image1, image2, maskImg, mode } = props

  // Vars
  const darkImg = '/images/pages/misc-mask-dark.png'
  const lightImg = '/images/pages/misc-mask-light.png'

  // Hook
  const theme = useTheme()
  const hidden = useMediaQuery(theme.breakpoints.down('md'))
  const maskBackground = useImageVariant(mode, lightImg, darkImg)

  function isImageObj(obj) {
    return obj && typeof obj === 'object' && 'src' in obj
  }

  if (!hidden) {
    return (
      <>
        {typeof image1 === 'undefined' || isImageObj(image1) ? (
          <Image
            alt={image1?.alt || 'tree-1'}
            src={image1?.src || '/images/illustrations/objects/tree-1.png'}
            className={image1?.className || 'absolute inline-start-0 block-end-0'}
            width={image1?.width || 200}
            height={image1?.height || 200}
            loading='lazy'
            style={{ opacity: 0, animation: 'fadeIn 0.5s ease-in-out forwards' }}
          />
        ) : (
          image1
        )}
        {typeof maskImg === 'undefined' || isImageObj(maskImg) ? (
          <MaskImg
            alt={maskImg?.alt || 'mask'}
            src={maskImg?.src || maskBackground}
            className={maskImg?.className}
            width={maskImg?.width}
            height={maskImg?.height}
            loading='lazy'
          />
        ) : (
          maskImg
        )}
        {typeof image2 === 'undefined' || isImageObj(image2) ? (
          <Image
            alt={image2?.alt || 'tree-2'}
            src={image2?.src || '/images/illustrations/objects/tree-2.png'}
            className={image2?.className || 'absolute inline-end-0 block-end-0'}
            width={image2?.width || 200}
            height={image2?.height || 200}
            loading='lazy'
            style={{ opacity: 0, animation: 'fadeIn 0.5s ease-in-out forwards' }}
          />
        ) : (
          image2
        )}
      </>
    )
  } else {
    return null
  }
}

export default Illustrations
