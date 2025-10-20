import React from 'react'
import { Breadcrumbs, Link, Typography } from '@mui/material'
import { Link as RouterLink } from 'react-router'

interface BreadcrumbItem {
  label: string
  to?: string
}

interface PageBreadcrumbsProps {
  items: BreadcrumbItem[]
}

const PageBreadcrumbs: React.FC<PageBreadcrumbsProps> = ({ items }) => {
  return (
    <Breadcrumbs aria-label='breadcrumb'>
      {items.map((item, index) =>
        item.to ? (
          <Link
            key={index}
            component={RouterLink}
            to={item.to}
            underline='hover'
            color='text.primary'
          >
            <Typography variant='body2'>{item.label}</Typography>
          </Link>
        ) : (
          <Typography key={index} variant='body2' color='text.disabled'>
            {item.label}
          </Typography>
        )
      )}
    </Breadcrumbs>
  )
}

export default PageBreadcrumbs
