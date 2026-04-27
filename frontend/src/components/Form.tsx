import { clsx } from "clsx";
import { type InputHTMLAttributes, type SelectHTMLAttributes, type TextareaHTMLAttributes, forwardRef } from "react";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }>(
  function Input({ className, invalid, ...rest }, ref) {
    return <input ref={ref} className={clsx("input", invalid && "input-error", className)} {...rest} />;
  },
);

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }
>(function Textarea({ className, invalid, ...rest }, ref) {
  return <textarea ref={ref} className={clsx("input", invalid && "input-error", className)} {...rest} />;
});

export const Select = forwardRef<
  HTMLSelectElement,
  SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean }
>(function Select({ className, invalid, children, ...rest }, ref) {
  return (
    <select ref={ref} className={clsx("input pr-8 bg-white", invalid && "input-error", className)} {...rest}>
      {children}
    </select>
  );
});

interface FieldProps {
  label: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
  className?: string;
  hint?: string;
}

export function Field({ label, required, error, children, className, hint }: FieldProps) {
  return (
    <div className={className}>
      <label className={clsx("label", required && "req")}>{label}</label>
      {children}
      {error ? (
        <p className="helper-error">{error}</p>
      ) : hint ? (
        <p className="text-xs text-ink-600 mt-1">{hint}</p>
      ) : null}
    </div>
  );
}
