'use client';

import * as React from 'react';
import { AlertCircle } from 'lucide-react';

import { cn } from '@/lib/utils';

/**
 * Form controls.
 *
 * Label above the control, optional helper under it, error text at the bottom —
 * never a placeholder standing in for a label. Ids are generated so the label,
 * helper and error are all wired to the input for screen readers.
 */
interface FieldProps {
  label: string;
  id?: string;
  hint?: React.ReactNode;
  error?: string | null;
  required?: boolean;
  className?: string;
  children: (props: { id: string; 'aria-describedby'?: string; 'aria-invalid'?: boolean }) => React.ReactNode;
}

export function Field({ label, id, hint, error, required, className, children }: FieldProps) {
  const generated = React.useId();
  const fieldId = id ?? generated;
  const hintId = hint ? `${fieldId}-hint` : undefined;
  const errorId = error ? `${fieldId}-error` : undefined;
  const describedBy = [errorId, hintId].filter(Boolean).join(' ') || undefined;

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label htmlFor={fieldId} className="text-[13px] font-medium text-ink">
        {label}
        {required ? (
          <span className="ml-1 text-critical" aria-hidden="true">
            *
          </span>
        ) : null}
        {required ? <span className="sr-only"> (required)</span> : null}
      </label>
      {children({ id: fieldId, 'aria-describedby': describedBy, 'aria-invalid': Boolean(error) })}
      {error ? (
        <p id={errorId} role="alert" className="flex items-start gap-1.5 text-[12.5px] text-critical">
          <AlertCircle className="mt-px size-3.5 shrink-0" aria-hidden="true" />
          {error}
        </p>
      ) : null}
      {hint ? (
        <p id={hintId} className="text-[12.5px] leading-relaxed text-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...props }, ref) {
    return (
      <input
        ref={ref}
        className={cn('field aria-invalid:border-critical', className)}
        {...props}
      />
    );
  },
);

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(function Textarea({ className, rows = 4, ...props }, ref) {
  return (
    <textarea ref={ref} rows={rows} className={cn('field resize-y', className)} {...props} />
  );
});

/** Native checkbox — the platform control already fits this design language. */
export function Checkbox({
  label,
  hint,
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string }) {
  const id = React.useId();
  return (
    <div className={cn('flex items-start gap-2.5', className)}>
      <input
        id={id}
        type="checkbox"
        className="mt-0.5 size-4 shrink-0 accent-[var(--tint-accent)]"
        {...props}
      />
      <div className="min-w-0">
        <label htmlFor={id} className="text-[13.5px] font-medium text-ink">
          {label}
        </label>
        {hint ? <p className="text-[12.5px] leading-relaxed text-muted">{hint}</p> : null}
      </div>
    </div>
  );
}

/** Toggle with `role="switch"`, keyboard operable and self-labelling. */
export function Toggle({
  checked,
  onChange,
  label,
  hint,
  disabled,
  id,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  hint?: string;
  disabled?: boolean;
  id?: string;
}) {
  const generated = React.useId();
  const controlId = id ?? generated;
  const hintId = hint ? `${controlId}-hint` : undefined;

  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <label htmlFor={controlId} className="text-[13.5px] font-medium text-ink">
          {label}
        </label>
        {hint ? (
          <p id={hintId} className="mt-0.5 text-[12.5px] leading-relaxed text-muted">
            {hint}
          </p>
        ) : null}
      </div>
      <button
        id={controlId}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-describedby={hintId}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative mt-0.5 h-5 w-9 shrink-0 rounded-full border transition-colors duration-150',
          checked ? 'border-accent bg-accent' : 'border-hairline-strong bg-surface-strong',
          disabled && 'cursor-not-allowed opacity-50',
        )}
      >
        <span
          className={cn(
            'absolute top-0.5 size-3.5 rounded-full bg-card shadow-raised transition-transform duration-150 ease-out-quint',
            checked ? 'translate-x-4.5' : 'translate-x-0.5',
          )}
          aria-hidden="true"
        />
      </button>
    </div>
  );
}
