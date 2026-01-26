import React from 'react'
import { Box } from '@mui/material'

/**
 * A reusable image-based icon component that safely renders local SVGs or other image files.
 *
 * @param {string} src - The source path of the image.
 * @param {string} [alt] - Alt text for accessibility.
 * @param {number} [size=20] - The icon size in pixels.
 * @param {number} [borderRadius=0] - Optional border radius.
 * @param {string} [bgColor] - Optional background color (e.g. for colored icon circles).
 * @param {number} [padding=0] - Optional inner padding for icon centering.
 */
export interface ImgIconProps {
  src: string
  alt?: string
  size?: number
  borderRadius?: number
  bgColor?: string
  padding?: number
}

export const ImgIcon: React.FC<ImgIconProps> = ({
  src,
  alt = '',
  size = 20,
  borderRadius = 0,
  bgColor,
  padding = 0
}) => {
  return (
    <Box
      component='img'
      src={src}
      alt={alt}
      sx={{
        width: size,
        height: size,
        borderRadius,
        backgroundColor: bgColor,
        padding,
        objectFit: 'contain',
        display: 'block'
      }}
    />
  )
}

export default ImgIcon
