import { useSessionStore } from '@/entities/session'
import { Button, type ButtonProps } from '@/shared/ui'

/** Ends the session. Stopping the poller and clearing chats is done by app/session-lifecycle. */
export function LogoutButton(props: Omit<ButtonProps, 'onClick'>) {
  const clear = useSessionStore((s) => s.clear)
  return (
    <Button variant="ghost" size="small" onClick={clear} {...props}>
      {props.children ?? 'Log out'}
    </Button>
  )
}
