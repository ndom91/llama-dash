import { ChevronDown, ChevronUp } from 'lucide-react'
import { useRef } from 'react'
import type { ChangeEvent, InputHTMLAttributes } from 'react'
import { cn } from '../lib/cn'

type NumberInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'prefix'> & {
  prefix?: string
  inputClassName?: string
}

export function NumberInput({ prefix, className, inputClassName, disabled, onChange, ...props }: NumberInputProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  const step = (direction: 1 | -1) => {
    if (disabled) return
    const input = inputRef.current
    if (!input) return
    if (direction > 0) input.stepUp()
    else input.stepDown()
    onChange?.({ target: input, currentTarget: input } as ChangeEvent<HTMLInputElement>)
  }

  return (
    <span
      className={cn(
        'flex h-9 items-stretch overflow-hidden rounded border border-border bg-surface-3 font-mono text-xs transition-[border-color,box-shadow] duration-100 focus-within:border-accent focus-within:shadow-focus',
        disabled && 'cursor-not-allowed opacity-50',
        className,
      )}
    >
      {prefix ? (
        <span className="flex items-center border-r border-border bg-surface-1 px-3 text-fg-dim">{prefix}</span>
      ) : null}
      <input
        {...props}
        ref={inputRef}
        type="number"
        disabled={disabled}
        onChange={onChange}
        className={cn(
          'min-w-0 flex-1 appearance-none bg-transparent px-3 text-fg outline-none disabled:cursor-not-allowed [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none',
          inputClassName,
        )}
      />
      <span className="grid w-8 shrink-0 border-l border-border bg-surface-2">
        <button
          type="button"
          tabIndex={-1}
          disabled={disabled}
          className="flex items-center justify-center border-b border-border text-fg-dim transition-colors hover:bg-surface-3 hover:text-fg disabled:cursor-not-allowed"
          onClick={() => step(1)}
          aria-label="Increment value"
        >
          <ChevronUp className="h-3 w-3" strokeWidth={2} aria-hidden="true" />
        </button>
        <button
          type="button"
          tabIndex={-1}
          disabled={disabled}
          className="flex items-center justify-center text-fg-dim transition-colors hover:bg-surface-3 hover:text-fg disabled:cursor-not-allowed"
          onClick={() => step(-1)}
          aria-label="Decrement value"
        >
          <ChevronDown className="h-3 w-3" strokeWidth={2} aria-hidden="true" />
        </button>
      </span>
    </span>
  )
}
