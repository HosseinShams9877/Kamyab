import { redirect } from "next/navigation";
import { getCurrentUser, roleRedirect, LoginForm } from "@/modules/auth";
import { getInstituteName } from "@/modules/settings";

// C-1 login page — the only page reachable without a session. The institute name
// is read from settings (rule 1: not hardcoded). An already-authenticated user
// is bounced to their role's landing page instead of seeing the form again.
export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) redirect(roleRedirect(user.role));

  const instituteName = await getInstituteName();

  return (
    <main className="flex min-h-screen items-center justify-center bg-page px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <h1 className="text-xl font-bold text-primary">{instituteName}</h1>
          <p className="mt-1 text-sm text-text-secondary">سامانه مدیریت عملیات</p>
        </div>
        <div className="rounded-card border border-border bg-card p-6 shadow-card">
          <h2 className="mb-5 text-center text-base font-bold text-text">
            ورود به سامانه
          </h2>
          <LoginForm />
        </div>
      </div>
    </main>
  );
}
