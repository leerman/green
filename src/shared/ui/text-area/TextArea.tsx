import { useCallback, useLayoutEffect, useRef, type Ref, type TextareaHTMLAttributes } from 'react'
import styles from './TextArea.module.css'

export interface TextAreaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  /** Grow with the content up to `maxHeight` pixels. */
  autoGrow?: boolean
  maxHeight?: number
  ref?: Ref<HTMLTextAreaElement>
}

export function TextArea({
  autoGrow = false,
  maxHeight = 200,
  className,
  value,
  ref,
  ...rest
}: TextAreaProps) {
  const innerRef = useRef<HTMLTextAreaElement | null>(null)

  useLayoutEffect(() => {
    const el = innerRef.current
    if (!autoGrow || !el) return
    el.style.height = 'auto'
    const next = Math.min(el.scrollHeight + 2, maxHeight)
    el.style.height = `${next}px`
    el.style.overflowY = el.scrollHeight + 2 > maxHeight ? 'auto' : 'hidden'
  }, [autoGrow, maxHeight, value])

  // Stable callback so React does not detach and re-attach the ref on every render.
  const setRef = useCallback(
    (el: HTMLTextAreaElement | null) => {
      innerRef.current = el
      if (typeof ref === 'function') ref(el)
      else if (ref) ref.current = el
    },
    [ref],
  )

  return (
    <textarea
      ref={setRef}
      rows={1}
      value={value}
      className={[styles.textarea, className].filter(Boolean).join(' ')}
      {...rest}
    />
  )
}
