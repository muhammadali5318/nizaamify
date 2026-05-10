import { useState } from 'react'
import Box from '@mui/material/Box'
import Container from '@mui/material/Container'
import Stack from '@mui/material/Stack'
import Step from '@mui/material/Step'
import StepLabel from '@mui/material/StepLabel'
import Stepper from '@mui/material/Stepper'
import Typography from '@mui/material/Typography'
import StorefrontIcon from '@mui/icons-material/Storefront'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from 'src/lib/supabase'
import { useSession } from 'src/features/auth/AuthProvider'
import { paths } from 'src/paths'
import LanguageSelector from 'src/components/language-selector/LanguageSelector'
import {
  onboardingSchema,
  shopStepSchema,
  type OnboardingValues
} from './schemas'
import { Banner, Button, Card, Field, Input, Textarea } from 'src/components/ui'
import { PK_PHONE_HINT } from 'src/lib/phone'

const STEPS = ['shop', 'owner'] as const

export default function OnboardingPage() {
  const { t } = useTranslation(['onboarding', 'common'])
  const { user } = useSession()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [activeStep, setActiveStep] = useState(0)
  const [serverError, setServerError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    trigger,
    formState: { errors, isSubmitting }
  } = useForm<OnboardingValues>({
    resolver: zodResolver(onboardingSchema(t)),
    mode: 'onTouched',
    defaultValues: {
      shop_name: '',
      shop_address: '',
      shop_phone: '',
      shop_type: '',
      owner_name: '',
      owner_phone: '',
      owner_cnic: '',
      owner_address: ''
    }
  })

  const handleNext = async () => {
    const stepFields: Array<keyof OnboardingValues> =
      activeStep === 0
        ? (Object.keys(shopStepSchema(t).shape) as Array<
            keyof OnboardingValues
          >)
        : []
    const ok = await trigger(stepFields, { shouldFocus: true })
    if (ok) setActiveStep((s) => s + 1)
  }

  const onSubmit = async (values: OnboardingValues) => {
    setServerError(null)
    const { error } = await supabase.rpc('complete_onboarding', {
      p_shop_name: values.shop_name,
      p_shop_address: values.shop_address,
      p_shop_phone: values.shop_phone,
      p_shop_type: values.shop_type ?? '',
      p_owner_name: values.owner_name,
      p_owner_phone: values.owner_phone,
      p_owner_cnic: values.owner_cnic ?? '',
      p_owner_address: values.owner_address
    })
    if (error) {
      setServerError(t('onboarding:errors.submit_failed'))
      return
    }
    await queryClient.invalidateQueries({ queryKey: ['profile'] })
    await queryClient.invalidateQueries({ queryKey: ['shop'] })
    navigate(paths.dashboard, { replace: true })
  }

  return (
    <Box sx={{ minHeight: '100vh', backgroundColor: 'var(--surface-subtle)' }}>
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', p: 2 }}>
        <LanguageSelector />
      </Box>
      <Container maxWidth='sm' sx={{ py: 2 }}>
        <Card variant='elevated' sx={{ p: { xs: 3, sm: 4 } }}>
          <Stack spacing={1.5} alignItems='center' mb={3}>
            <StorefrontIcon sx={{ fontSize: 40, color: 'var(--text-brand)' }} />
            <Typography
              variant='display'
              component='h1'
              sx={{ textAlign: 'center', color: 'var(--text-primary)' }}
            >
              {t('onboarding:title')}
            </Typography>
            <Typography
              variant='body1'
              sx={{ textAlign: 'center', color: 'var(--text-secondary)' }}
            >
              {t('onboarding:subtitle')}
            </Typography>
            {user?.email && (
              <Typography variant='caption' sx={{ color: 'var(--text-muted)' }}>
                {t('onboarding:welcome', { email: user.email })}
              </Typography>
            )}
          </Stack>

          <Stepper activeStep={activeStep} alternativeLabel sx={{ mb: 3 }}>
            {STEPS.map((s) => (
              <Step key={s}>
                <StepLabel>{t(`onboarding:step.${s}`)}</StepLabel>
              </Step>
            ))}
          </Stepper>

          <form onSubmit={handleSubmit(onSubmit)} noValidate>
            <Stack spacing={2.5}>
              {serverError && <Banner variant='error'>{serverError}</Banner>}

              {activeStep === 0 && (
                <>
                  <Typography variant='h3'>
                    {t('onboarding:shop.section_title')}
                  </Typography>
                  <Field
                    label={t('onboarding:shop.name_label')}
                    error={errors.shop_name?.message}
                  >
                    <Input {...register('shop_name')} />
                  </Field>
                  <Field
                    label={t('onboarding:shop.address_label')}
                    error={errors.shop_address?.message}
                  >
                    <Textarea {...register('shop_address')} minRows={2} />
                  </Field>
                  <Field
                    label={t('onboarding:shop.phone_label')}
                    error={errors.shop_phone?.message}
                  >
                    <Input
                      placeholder={PK_PHONE_HINT}
                      {...register('shop_phone')}
                    />
                  </Field>
                  <Field
                    label={t('onboarding:shop.type_label')}
                    error={errors.shop_type?.message}
                  >
                    <Input
                      placeholder={t('onboarding:shop.type_placeholder')}
                      {...register('shop_type')}
                    />
                  </Field>
                </>
              )}

              {activeStep === 1 && (
                <>
                  <Typography variant='h3'>
                    {t('onboarding:owner.section_title')}
                  </Typography>
                  <Field
                    label={t('onboarding:owner.name_label')}
                    error={errors.owner_name?.message}
                  >
                    <Input {...register('owner_name')} />
                  </Field>
                  <Field
                    label={t('onboarding:owner.phone_label')}
                    error={errors.owner_phone?.message}
                  >
                    <Input
                      placeholder={PK_PHONE_HINT}
                      {...register('owner_phone')}
                    />
                  </Field>
                  <Field
                    label={t('onboarding:owner.cnic_label')}
                    error={
                      errors.owner_cnic
                        ? t('onboarding:errors.cnic_invalid')
                        : undefined
                    }
                  >
                    <Input
                      placeholder={t('onboarding:owner.cnic_placeholder')}
                      {...register('owner_cnic')}
                    />
                  </Field>
                  <Field
                    label={t('onboarding:owner.address_label')}
                    error={errors.owner_address?.message}
                  >
                    <Textarea {...register('owner_address')} minRows={2} />
                  </Field>
                </>
              )}

              <Stack
                direction='row'
                spacing={1.5}
                justifyContent='flex-end'
                mt={1}
              >
                {activeStep > 0 && (
                  <Button
                    variant='secondary'
                    onClick={() => setActiveStep((s) => s - 1)}
                    disabled={isSubmitting}
                  >
                    {t('onboarding:actions.back')}
                  </Button>
                )}
                {activeStep < STEPS.length - 1 ? (
                  <Button variant='primary' onClick={handleNext}>
                    {t('onboarding:actions.next')}
                  </Button>
                ) : (
                  <Button
                    type='submit'
                    variant='primary'
                    loading={isSubmitting}
                  >
                    {t('onboarding:actions.submit')}
                  </Button>
                )}
              </Stack>
            </Stack>
          </form>
        </Card>
      </Container>
    </Box>
  )
}
