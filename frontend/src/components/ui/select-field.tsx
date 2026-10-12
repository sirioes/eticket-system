import type { ChangeEvent, ReactNode } from "react";
import { INPUT_CLASS } from "@/components/ui/input-class";

interface SelectFieldProps {
  id: string;
  label: string;
  value: string;
  disabled?: boolean;
  invalid?: boolean;
  describedBy?: string;
  onChange: (event: ChangeEvent<HTMLSelectElement>) => void;
  children: ReactNode;
  className?: string;
}

export function SelectField({
  id,
  label,
  value,
  disabled = false,
  invalid = false,
  describedBy,
  onChange,
  children,
  className = "",
}: SelectFieldProps) {
  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <div className="relative">
        <select
          id={id}
          value={value}
          disabled={disabled}
          aria-invalid={invalid}
          aria-describedby={describedBy}
          onChange={onChange}
          className={`${INPUT_CLASS} appearance-none pr-11`}
        >
          {children}
        </select>
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          className="pointer-events-none absolute top-1/2 right-4 size-5 -translate-y-1/2 text-teal"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </div>
    </div>
  );
}
