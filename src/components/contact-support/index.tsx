interface ContactSupportProps {
  email?: string
}

const ContactSupport = ({ email = 'ops@monai.tech' }: ContactSupportProps) => {
  return (
    <span className='font-weight--700 info-main'>
      Contact support:{' '}
      <a
        target='_blank'
        href={`mailto:${email}`}
        className='cursor-pointer info-main no-underline'
        rel='noreferrer'
      >
        {email}
      </a>
    </span>
  )
}

export default ContactSupport
