import { CopyButton } from '../../components/CopyButton'

type Props = {
  text: string
}

export function PlaygroundCopyButton({ text }: Props) {
  return <CopyButton text={text} />
}
