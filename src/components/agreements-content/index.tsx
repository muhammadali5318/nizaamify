import React, { useEffect, useMemo, useState } from 'react'
import { Box, Chip, Stack, Typography } from '@mui/material'
import { useLocation } from 'react-router'
import styles from './AgreementContent.module.scss'
import RegistrationWrapper from '../registration-wrapper/RegistrationWrapper'
import AgreementsHeader from './AgreementsHeader'

// local HTML files imported as raw strings (Vite ?raw)
import termsHtml from 'src/agreements/TermsOfService.html?raw'
import privacyHtml from 'src/agreements/PrivacyPolicy.html?raw'
import disclaimerHtml from 'src/agreements/LiabilityDisclaimer.html?raw'
import dpaHtml from 'src/agreements/MonaiTechDataProcessingAgreement.html?raw'
import cookieHtml from 'src/agreements/CookiePolicy.html?raw'

const DOC_DISPLAY: Record<string, { chipLabel: string; title: string }> = {
  terms: {
    chipLabel: 'Terms & Conditions',
    title: 'Monai Tech Terms of Service'
  },
  privacy: {
    chipLabel: 'Privacy Policy',
    title: 'Monai Tech Privacy Policy'
  },
  cookiePolicy: {
    chipLabel: 'Cookie Policy',
    title: 'Monai Tech Cookie Policy'
  },
  disclaimer: {
    chipLabel: 'Liability Disclaimer',
    title: 'Monai Tech Liability Disclaimer'
  },
  dataProcessingAgreement: {
    chipLabel: 'Data Processing Agreement',
    title: 'Monai Tech Data Processing Agreement (DPA)'
  }
}

const DOC_MAP: Record<string, string> = {
  terms: termsHtml,
  privacy: privacyHtml,
  disclaimer: disclaimerHtml,
  dataProcessingAgreement: dpaHtml,
  cookiePolicy: cookieHtml
}

const DEFAULT_DOC = 'terms'

function buildSrcDoc(rawHtml: string) {
  if (!rawHtml)
    return '<!doctype html><html><body><p>No content</p></body></html>'

  // small style to ensure the iframe body is the scroll surface and has consistent padding behavior
  const injectedStyles = `
    <style>
      html, body { height: 100%; margin: 0; padding: 0; }
      body { box-sizing: border-box; min-height: 100vh; overflow: auto; -webkit-overflow-scrolling: touch; padding: 16px; }
      /* make sure embedded content like images/tables won't overflow horizontally */
      img, table { max-width: 100%; height: auto; }
    </style>
  `

  // Quick check for a <head> tag
  const headOpen = /<head[^>]*>/i.test(rawHtml)
  if (headOpen) {
    // insert base, meta and our small style block
    return rawHtml.replace(
      /<head([^>]*)>/i,
      `<head$1><base target="_blank"><meta name="viewport" content="width=device-width,initial-scale=1">${injectedStyles}`
    )
  }

  // If no head, wrap in a minimal doc — keep rawHtml as body content
  return `<!doctype html>
<html>
<head>
  <base target="_blank">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  ${injectedStyles}
</head>
<body>
  ${rawHtml}
</body>
</html>`
}

const AgreementContent: React.FC = () => {
  const location = useLocation()
  const [srcDoc, setSrcDoc] = useState<string | null>(null)

  const search = useMemo(
    () => new URLSearchParams(location.search),
    [location.search]
  )
  const docKey = (search.get('doc') || DEFAULT_DOC).toString()

  useEffect(() => {
    const raw = DOC_MAP[docKey]
    if (!raw) {
      setSrcDoc(buildSrcDoc('<p>Document not found</p>'))
      return
    }
    setSrcDoc(buildSrcDoc(raw))
  }, [docKey])

  const display = DOC_DISPLAY[docKey] || DOC_DISPLAY[DEFAULT_DOC]

  return (
    <RegistrationWrapper>
      <Box display='flex' flexDirection='column' height='100vh' width='100%'>
        <Stack className={styles.wrapper}>
          <Box width={'100%'} height={'100%'} position={'relative'}>
            <AgreementsHeader />
            <Stack
              spacing={1.5}
              alignItems='center'
              position='absolute'
              top='50%'
              left='50%'
              sx={{ transform: 'translate(-50%, -50%)' }}
            >
              <Chip label={display.chipLabel} color='info' variant='outlined' />
              <Typography
                textAlign='center'
                color='#fff'
                fontWeight={700}
                sx={{
                  fontSize: {
                    xs: '1.5rem',
                    sm: '3rem'
                  },
                  lineHeight: 1.2
                }}
              >
                {display.title}
              </Typography>
            </Stack>
          </Box>
        </Stack>

        <Box
          component='main'
          flex='1 1 0'
          sx={{
            overflow: 'hidden', // parent won't scroll; iframe will
            bgcolor: 'background.paper',
            p: 2,
            display: 'flex',
            flexDirection: 'column'
          }}
        >
          {srcDoc ? (
            <iframe
              title={`agreement-${docKey}`}
              srcDoc={srcDoc}
              className={styles.docIframe}
              sandbox='allow-same-origin allow-popups allow-forms'
            />
          ) : (
            <Typography>Loading document…</Typography>
          )}
        </Box>
      </Box>
    </RegistrationWrapper>
  )
}

export default AgreementContent
