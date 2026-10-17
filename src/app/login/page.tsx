import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getCurrentActor } from "@/lib/current-user";
import { roleHomePath } from "@/lib/nav";
import { Icon } from "@/components/icons";
import { LoginForm } from "@/components/forms";
import { Role } from "@/lib/constants";
import { DEMO_ACCOUNTS, DEMO_PASSWORD } from "@/lib/demo-accounts";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage() {
  const actor = await getCurrentActor();
  if (actor) redirect(roleHomePath(actor.role as Role));
  const showDemo = process.env.NODE_ENV !== "production";

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Brand panel */}
      <div className="relative hidden flex-col justify-between bg-ink-900 p-10 text-white lg:flex">
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-500">
            <Icon name="building" className="h-5 w-5" />
          </span>
          <span className="text-sm font-semibold">Smart Campus Management System</span>
        </div>
        <div className="max-w-md">
          <h1 className="text-3xl font-semibold leading-tight">
            One secure platform for campus administration and academics.
          </h1>
          <p className="mt-4 text-sm text-ink-200">
            Separate dashboards for Administrators, Faculty and Students, with smart
            timetable generation, attendance, examinations, analytics, library and an
            AI assistant.
          </p>
          <ul className="mt-8 space-y-3 text-sm text-ink-200">
            {[
              "Role-based access with server-side enforcement",
              "Conflict-free timetable generation reviewed before publishing",
              "Attendance and marks with clear ownership rules",
            ].map((line) => (
              <li key={line} className="flex items-center gap-2">
                <Icon name="check" className="h-4 w-4 text-brand-400" />
                {line}
              </li>
            ))}
          </ul>
        </div>
        <p className="text-xs text-ink-400">Demo environment · fictional data only</p>
      </div>

      {/* Form panel */}
      <div className="flex items-center justify-center bg-ink-50 px-4 py-10">
        <div className="w-full max-w-sm">
          <div className="mb-6 flex items-center gap-2 lg:hidden">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-white">
              <Icon name="building" className="h-4 w-4" />
            </span>
            <span className="text-sm font-semibold text-ink-900">Smart Campus</span>
          </div>
          <h1 className="text-xl font-semibold text-ink-900">Sign in to your account</h1>
          <p className="mt-1 text-sm text-ink-500">
            Use your email, roll number or institutional ID.
          </p>
          <div className="mt-6 card p-5">
            <LoginForm />
          </div>

          {showDemo ? (
            <div className="mt-5 rounded-lg border border-ink-200 bg-white p-3 text-xs text-ink-600">
              <p className="font-semibold text-ink-700">Demo accounts (local only)</p>
              <p className="mt-1">
                Password for all demo accounts:{" "}
                <span className="font-mono font-semibold">{DEMO_PASSWORD}</span>
              </p>
              <ul className="mt-2 space-y-1">
                {DEMO_ACCOUNTS.map((a) => (
                  <li key={a.role} className="flex justify-between gap-2">
                    <span className="text-ink-500">{a.role}</span>
                    <span className="font-mono">{a.loginId}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
