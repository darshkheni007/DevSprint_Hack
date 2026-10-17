"use client";

import { useFormStatus } from "react-dom";
import type { ReactNode } from "react";
import type { ActionState } from "@/lib/actions/types";

/** Submit button that reflects the enclosing <form> pending state. */
export function SubmitButton({
  children,
  variant = "primary",
  className = "",
  pendingText = "Working…",
  name,
  value,
}: {
  children: ReactNode;
  variant?: "primary" | "secondary" | "danger" | "ghost";
  className?: string;
  pendingText?: string;
  name?: string;
  value?: string;
}) {
  const { pending } = useFormStatus();
  const variantClass =
    variant === "secondary"
      ? "btn-secondary"
      : variant === "danger"
        ? "btn-danger"
        : variant === "ghost"
          ? "btn-ghost"
          : "btn-primary";
  return (
    <button
      type="submit"
      disabled={pending}
      {...(name ? { name, value } : {})}
      className={`${variantClass} ${className}`}
    >
      {pending ? pendingText : children}
    </button>
  );
}

/** Renders an action result message (success or error) plus field errors. */
export function ActionFeedback({ state }: { state: ActionState }) {
  if (!state.message) return null;
  return (
    <div
      role="status"
      className={`rounded-lg border px-3 py-2 text-sm ${
        state.ok
          ? "border-success-500/30 bg-success-50 text-success-700"
          : "border-danger-500/30 bg-danger-50 text-danger-700"
      }`}
    >
      {state.message}
    </div>
  );
}

export function Field({
  label,
  htmlFor,
  error,
  hint,
  children,
  className = "",
}: {
  label: string;
  htmlFor?: string;
  error?: string[];
  hint?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <label className="label" htmlFor={htmlFor}>
        {label}
      </label>
      {children}
      {hint ? <p className="mt-1 text-xs text-ink-400">{hint}</p> : null}
      {error && error.length > 0 ? (
        <p className="field-error">{error.join(" ")}</p>
      ) : null}
    </div>
  );
}
