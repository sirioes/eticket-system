"use client";

import { useState, type Ref } from "react";
import { INPUT_CLASS } from "@/components/ui/input-class";

interface PasswordInputProps {
  id: string;
  label: string;
  autoComplete: "current-password" | "new-password";
  disabled: boolean;
  invalid: boolean;
  ref?: Ref<HTMLInputElement>;
  className?: string;
}

export function PasswordInput({
  id,
  label,
  autoComplete,
  disabled,
  invalid,
  ref,
  className = "",
}: PasswordInputProps) {
  const [visible, setVisible] = useState(false);

  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <div className="relative">
        <input
          ref={ref}
          id={id}
          name={id}
          type={visible ? "text" : "password"}
          autoComplete={autoComplete}
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          maxLength={128}
          disabled={disabled}
          aria-invalid={invalid}
          className={`${INPUT_CLASS} pr-12`}
        />
        <button
          type="button"
          onClick={() => setVisible((value) => !value)}
          aria-label={`Tampilkan ${label.toLowerCase()}`}
          aria-pressed={visible}
          aria-controls={id}
          disabled={disabled}
          className="absolute inset-y-1.5 right-1.5 grid w-9 place-items-center rounded-lg text-teal transition-colors duration-200 hover:bg-teal/10 disabled:opacity-60"
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            className="size-5"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7Z" />
            <circle cx="12" cy="12" r="3" />
            <path
              d="M4 4l16 16"
              pathLength={1}
              strokeDasharray={1}
              strokeDashoffset={visible ? 1 : 0}
              className="transition-[stroke-dashoffset] duration-300 ease-smooth"
            />
          </svg>
        </button>
      </div>
    </div>
  );
}