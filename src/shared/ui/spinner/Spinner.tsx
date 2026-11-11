import styles from './Spinner.module.css'

export interface SpinnerProps {
  size?: number
  label?: string
  className?: string
}

export function Spinner({ size = 20, label = 'Loading', className }: SpinnerProps) {
  return (
    <span
      role="status"
      aria-label={label}
      className={[styles.spinner, className].filter(Boolean).join(' ')}
      style={{ width: size, height: size }}
    />
  )
}
