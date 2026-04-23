import type { ReactNode } from "react";

interface FormFieldProps {
  label: string;
  hint?: string;
  children: ReactNode;
}

export function FormField({ label, hint, children }: FormFieldProps) {
  return (
    <label className="form-field">
      <span className="form-label">{label}</span>
      {children}
      {hint ? <span className="form-hint">{hint}</span> : null}
    </label>
  );
}
