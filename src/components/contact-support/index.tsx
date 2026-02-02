interface ContactSupportProps {
  email?: string
}

const ContactSupport = ({ email = 'ops@monai.tech' }: ContactSupportProps) => {
  return (
    <span className='font-weight--700 info-main cursor-pointer'>
      Contact support: {email}
    </span>
  )
}

export default ContactSupport
