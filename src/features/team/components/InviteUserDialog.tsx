import { useState } from 'react'
import {
  Alert,
  Box,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  MenuItem,
  Radio,
  RadioGroup,
  Stack,
  Tooltip,
  Typography
} from '@mui/material'
import ContentCopyIcon from '@mui/icons-material/ContentCopyOutlined'
import { useTranslation } from 'react-i18next'
import { Button, Field, Input, Card } from 'src/components/ui'
import { useCreateInvitation } from 'src/features/team/hooks'
import { mapErrorToI18nKey } from 'src/lib/errorMap'

interface InviteUserDialogProps {
  open: boolean
  onClose: () => void
}

export function InviteUserDialog({ open, onClose }: InviteUserDialogProps) {
  const { t } = useTranslation('team')
  const createInvitation = useCreateInvitation()
  const [email, setEmail] = useState('')
  const [preset, setPreset] = useState<'manager' | 'salesperson'>('salesperson')
  const [code, setCode] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const reset = () => {
    setEmail('')
    setPreset('salesperson')
    setCode(null)
    setError(null)
    setCopied(false)
  }

  const handleClose = () => {
    reset()
    onClose()
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    try {
      const result = await createInvitation.mutateAsync({
        email: email.trim(),
        preset
      })
      setCode(result.confirmation_code)
    } catch (err) {
      setError(mapErrorToI18nKey(err))
    }
  }

  const handleCopy = async () => {
    if (!code) return
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard API can fail (no permission); user can read manually
    }
  }

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth='sm'
      fullWidth
      aria-labelledby='invite-dialog-title'
    >
      <DialogTitle id='invite-dialog-title'>
        {code ? t('invite.success_title') : t('invite.dialog_title')}
      </DialogTitle>

      {!code ? (
        // ----- Form view -----
        <Box component='form' onSubmit={handleSubmit}>
          <DialogContent sx={{ pt: 1 }}>
            <Stack gap={2.5}>
              <Field
                label={t('invite.field_email')}
                helperText={t('invite.field_email_help')}
                required
              >
                <Input
                  type='email'
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder='name@example.com'
                />
              </Field>

              <Field label={t('invite.field_preset')} required>
                <RadioGroup
                  value={preset}
                  onChange={(e) =>
                    setPreset(e.target.value as 'manager' | 'salesperson')
                  }
                >
                  <PresetOption
                    value='salesperson'
                    label={t('members.preset_salesperson')}
                    help={t('invite.preset_salesperson_help')}
                  />
                  <PresetOption
                    value='manager'
                    label={t('members.preset_manager')}
                    help={t('invite.preset_manager_help')}
                  />
                </RadioGroup>
              </Field>

              {error && <Alert severity='error'>{t(`common:${error}`)}</Alert>}
            </Stack>
          </DialogContent>
          <DialogActions sx={{ p: 2, gap: 1 }}>
            <Button variant='secondary' onClick={handleClose}>
              {t('common:actions.cancel')}
            </Button>
            <Button
              type='submit'
              loading={createInvitation.isPending}
              disabled={!email.trim()}
            >
              {t('invite.submit')}
            </Button>
          </DialogActions>
        </Box>
      ) : (
        // ----- Success view: 4-digit code reveal -----
        <>
          <DialogContent sx={{ pt: 1 }}>
            <Stack gap={2.5}>
              <Typography
                variant='body2'
                sx={{ color: 'var(--text-secondary)' }}
              >
                {t('invite.success_body')}
              </Typography>
              <Card variant='muted' sx={{ p: 2, textAlign: 'center' }}>
                <Typography
                  variant='caption'
                  sx={{
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                    color: 'var(--text-secondary)'
                  }}
                >
                  {t('invite.code_label')}
                </Typography>
                <Stack
                  direction='row'
                  alignItems='center'
                  justifyContent='center'
                  gap={1}
                  sx={{ mt: 1 }}
                >
                  <Typography
                    sx={{
                      fontSize: '2.5rem',
                      fontWeight: 700,
                      fontFamily:
                        'ui-monospace, SFMono-Regular, Menlo, Monaco, monospace',
                      letterSpacing: '0.25em',
                      color: 'var(--text-brand)',
                      userSelect: 'all'
                    }}
                  >
                    {code}
                  </Typography>
                  <Tooltip title={copied ? '✓' : t('invite.copy_code')}>
                    <IconButton
                      onClick={() => void handleCopy()}
                      aria-label={t('invite.copy_code')}
                    >
                      <ContentCopyIcon fontSize='small' />
                    </IconButton>
                  </Tooltip>
                </Stack>
              </Card>
            </Stack>
          </DialogContent>
          <DialogActions sx={{ p: 2 }}>
            <Button onClick={handleClose}>{t('invite.done')}</Button>
          </DialogActions>
        </>
      )}
    </Dialog>
  )
}

function PresetOption({
  value,
  label,
  help
}: {
  value: string
  label: string
  help: string
}) {
  return (
    <MenuItem
      component='label'
      sx={{
        py: 1,
        cursor: 'pointer',
        '&:hover': {
          backgroundColor:
            'color-mix(in srgb, var(--text-primary) 4%, transparent)'
        }
      }}
    >
      <Stack direction='row' alignItems='flex-start' gap={1.5}>
        <Radio value={value} sx={{ p: 0.5, mt: 0.5 }} />
        <Stack gap={0.25}>
          <Typography variant='body2' sx={{ fontWeight: 600 }}>
            {label}
          </Typography>
          <Typography variant='caption' sx={{ color: 'var(--text-secondary)' }}>
            {help}
          </Typography>
        </Stack>
      </Stack>
    </MenuItem>
  )
}

export default InviteUserDialog
