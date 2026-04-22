import { Button, Stack } from '@mui/material'
import { StepProps } from '../../type'

const StepOne: React.FC<StepProps> = ({ onNext }) => {
  const handleNextClick = () => {
    // 👉 put validation / API / conditions here
    // eslint-disable-next-line no-console
    console.log('StepOne validation passed')

    onNext()
  }

  return (
    <>
      <div>StepOne</div>

      <Stack direction='row' justifyContent='flex-end' sx={{ mt: 3 }}>
        <Button variant='contained' onClick={handleNextClick}>
          Next
        </Button>
      </Stack>
    </>
  )
}

export default StepOne
