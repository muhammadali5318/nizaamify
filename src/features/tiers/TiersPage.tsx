import { useState } from 'react'
import Box from '@mui/material/Box'
import Stack from '@mui/material/Stack'
import IconButton from '@mui/material/IconButton'
import Typography from '@mui/material/Typography'
import EditIcon from '@mui/icons-material/Edit'
import ArchiveIcon from '@mui/icons-material/Archive'
import StarIcon from '@mui/icons-material/Star'
import StarBorderIcon from '@mui/icons-material/StarBorder'
import { useTranslation } from 'react-i18next'
import {
  Badge,
  Banner,
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  Tooltip
} from 'src/components/ui'
import { PageHeader } from 'src/components/layout'
import { useNotifier } from 'src/components/notistack/NotificationProvider'
import {
  useTiers,
  useDeactivateTier,
  useSetDefaultTier,
  tierErrorKey,
  type CustomerTier
} from './hooks'
import TierFormDialog from './TierFormDialog'

export default function TiersPage() {
  const { t } = useTranslation(['tiers', 'common'])
  const { data: tiers = [], isLoading, error } = useTiers()
  const deactivate = useDeactivateTier()
  const setDefault = useSetDefaultTier()
  const notify = useNotifier()

  const [dialog, setDialog] = useState<
    { kind: 'create' } | { kind: 'edit'; tier: CustomerTier } | null
  >(null)
  const [confirmArchive, setConfirmArchive] = useState<CustomerTier | null>(
    null
  )

  const defaultTier = tiers.find((tt) => tt.is_default)
  const defaultName = defaultTier?.name ?? ''

  const handleArchive = async () => {
    if (!confirmArchive) return
    try {
      const moved = await deactivate.mutateAsync(confirmArchive.id)
      if (moved > 0) {
        const key =
          moved === 1
            ? 'tiers:labels.moved_to_default_one'
            : 'tiers:labels.moved_to_default_other'
        notify.success(t(key, { count: moved, tierName: defaultName }))
      } else {
        notify.success(t('tiers:labels.no_customers_moved'))
      }
      setConfirmArchive(null)
    } catch (err) {
      const key = tierErrorKey(err)
      notify.error(key ? t(key) : t('tiers:errors.archive_failed'))
    }
  }

  const handleSetDefault = async (tier: CustomerTier) => {
    try {
      await setDefault.mutateAsync(tier.id)
      notify.success(t('tiers:messages.default_set'))
    } catch (err) {
      const key = tierErrorKey(err)
      notify.error(key ? t(key) : t('tiers:errors.save_failed'))
    }
  }

  return (
    <Box sx={{ maxWidth: 768, mx: 'auto', width: '100%' }}>
      <PageHeader
        title={t('tiers:title')}
        subtitle={t('tiers:subtitle')}
        actions={
          <Button
            variant='primary'
            onClick={() => setDialog({ kind: 'create' })}
          >
            {t('tiers:actions.new_tier')}
          </Button>
        }
      />

      {error && (
        <Banner variant='error'>{t('tiers:errors.save_failed')}</Banner>
      )}

      <Card noPadding>
        {isLoading ? (
          <Box sx={{ p: 3 }}>
            <EmptyState title={t('common:loading')} />
          </Box>
        ) : tiers.length === 0 ? (
          <Box sx={{ p: 3 }}>
            <EmptyState title='—' />
          </Box>
        ) : (
          <Stack
            divider={
              <Box sx={{ borderTop: '1px solid var(--border-subtle)' }} />
            }
          >
            {tiers.map((tier) => (
              <Stack
                key={tier.id}
                direction='row'
                alignItems='center'
                spacing={1.5}
                sx={{ p: 2 }}
              >
                <Box sx={{ flex: '1 1 auto', minWidth: 0 }}>
                  <Stack
                    direction='row'
                    spacing={0.75}
                    alignItems='center'
                    flexWrap='wrap'
                  >
                    <Typography variant='body1' sx={{ fontWeight: 600 }}>
                      {tier.name}
                    </Typography>
                    {tier.is_default && (
                      <Badge
                        variant='info'
                        label={t('tiers:labels.default_badge')}
                      />
                    )}
                  </Stack>
                  <Typography
                    variant='caption'
                    sx={{ color: 'var(--text-muted)', display: 'block' }}
                  >
                    {tier.customer_count === 1
                      ? t('tiers:labels.customers_count_one', {
                          count: tier.customer_count
                        })
                      : t('tiers:labels.customers_count_other', {
                          count: tier.customer_count
                        })}
                  </Typography>
                  {tier.notes && (
                    <Typography
                      variant='caption'
                      sx={{ color: 'var(--text-muted)', display: 'block' }}
                    >
                      {tier.notes}
                    </Typography>
                  )}
                </Box>
                <Tooltip title={t('tiers:actions.set_default')}>
                  <span>
                    <IconButton
                      size='small'
                      disabled={tier.is_default || setDefault.isPending}
                      onClick={() => void handleSetDefault(tier)}
                      aria-label={t('tiers:actions.set_default')}
                    >
                      {tier.is_default ? (
                        <StarIcon
                          fontSize='small'
                          sx={{ color: 'var(--warning-700)' }}
                        />
                      ) : (
                        <StarBorderIcon fontSize='small' />
                      )}
                    </IconButton>
                  </span>
                </Tooltip>
                <Tooltip title={t('tiers:actions.edit')}>
                  <IconButton
                    size='small'
                    onClick={() => setDialog({ kind: 'edit', tier })}
                    aria-label={t('tiers:actions.edit')}
                  >
                    <EditIcon fontSize='small' />
                  </IconButton>
                </Tooltip>
                <Tooltip title={t('tiers:actions.archive')}>
                  <span>
                    <IconButton
                      size='small'
                      disabled={tier.is_default}
                      onClick={() => setConfirmArchive(tier)}
                      aria-label={t('tiers:actions.archive')}
                    >
                      <ArchiveIcon fontSize='small' />
                    </IconButton>
                  </span>
                </Tooltip>
              </Stack>
            ))}
          </Stack>
        )}
      </Card>

      {dialog && (
        <TierFormDialog
          open
          mode={dialog}
          onClose={() => setDialog(null)}
          defaultExistsElsewhere={
            dialog.kind === 'edit'
              ? tiers.some((tt) => tt.is_default && tt.id !== dialog.tier.id)
              : true
          }
        />
      )}

      <ConfirmDialog
        open={!!confirmArchive}
        onClose={() => setConfirmArchive(null)}
        onConfirm={() => void handleArchive()}
        title={t('tiers:dialog.archive_confirm_title')}
        description={t('tiers:dialog.archive_confirm_body')}
        confirmLabel={t('tiers:actions.archive')}
        cancelLabel={t('tiers:actions.cancel')}
        loading={deactivate.isPending}
        destructive
      />
    </Box>
  )
}
