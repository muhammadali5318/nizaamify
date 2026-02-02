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

  const injectedStyles = `
    <style>
      html, body { height: auto; margin: 0; padding: 0; }
      body { box-sizing: border-box; min-height: 100vh; overflow: visible; -webkit-overflow-scrolling: touch;
             padding: 0 300px; /* large gutters live inside iframe doc */
           }
      img, table { max-width: 100%; height: auto; }
      /* responsive gutters */
      @media (max-width: 1200px) { body { padding: 0 200px; } }
      @media (max-width: 992px)  { body { padding: 0 120px; } }
      @media (max-width: 768px)  { body { padding: 0 48px; } }
      @media (max-width: 600px)  { body { padding: 0 16px; } }
    </style>
  `

  // script that posts height to parent and keeps observing changes
  const injectedScript = `
    <script>
      (function () {
        function computeHeight() {
          try {
            var doc = document.documentElement;
            var body = document.body;
            var h = Math.max(
              doc.scrollHeight, body.scrollHeight,
              doc.offsetHeight, body.offsetHeight,
              doc.clientHeight
            );
            return h;
          } catch (e) {
            return null;
          }
        }

        function postHeight() {
          var h = computeHeight();
          if (h !== null) {
            // send the height to parent; parent will verify the source
            window.parent.postMessage({ type: 'agreement-doc-height', height: h }, '*');
          }
        }

        // post initial height after load (and after a short delay to allow layout)
        function onReady() {
          postHeight();
          // for images that may load after DOMContentLoaded
          Array.from(document.images || []).forEach(function(img) {
            if (!img.complete) {
              img.addEventListener('load', postHeight, { once: true });
              img.addEventListener('error', postHeight, { once: true });
            }
          });
        }

        if (document.readyState === 'complete' || document.readyState === 'interactive') {
          setTimeout(onReady, 50);
        } else {
          window.addEventListener('DOMContentLoaded', function() { setTimeout(onReady, 50); });
          window.addEventListener('load', function() { setTimeout(postHeight, 50); });
        }

        // ResizeObserver to detect layout changes (preferred)
        try {
          var ro = new ResizeObserver(function() { postHeight(); });
          ro.observe(document.documentElement);
          ro.observe(document.body);
        } catch (e) {
          // ResizeObserver may not exist in some environments; fallback below
        }

        // MutationObserver to detect DOM changes that change height
        try {
          var mo = new MutationObserver(function() { postHeight(); });
          mo.observe(document.body, { childList: true, subtree: true, attributes: true, characterData: true });
        } catch (e) {}

        // As extra fallback, poll a few times (short-lived) for dynamic changes
        var polls = 0;
        var pollInterval = setInterval(function() {
          postHeight();
          polls++;
          if (polls > 40) clearInterval(pollInterval); // stops after ~2s (40 * 50ms)
        }, 50);

        // also listen to window resize inside iframe
        window.addEventListener('resize', postHeight);
      })();
    </script>
  `

  // Quick check for a <head> tag
  const headOpen = /<head[^>]*>/i.test(rawHtml)
  if (headOpen) {
    return rawHtml.replace(
      /<head([^>]*)>/i,
      `<head$1><base target="_blank"><meta name="viewport" content="width=device-width,initial-scale=1">${injectedStyles}${injectedScript}`
    )
  }

  return `<!doctype html>
<html>
<head>
  <base target="_blank">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  ${injectedStyles}
  ${injectedScript}
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
            py: 2,
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
