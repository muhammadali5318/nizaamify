type HelloProps = {
  name?: string
}

export default function Dummy({ name = 'World' }: HelloProps) {
  return <h1>Hello, {name}!</h1>
}
