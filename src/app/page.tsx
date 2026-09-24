import { redirect } from "next/navigation";
import { getCurrentUser, roleRedirect } from "@/modules/auth";

// App entry. Sends an authenticated user to their role's landing page and
// everyone else to the login page. (The Phase 1 palette/utility scaffold that
// lived here has served its purpose; the app now boots into the real flow.)
export default async function Home() {
  const user = await getCurrentUser();
  redirect(user ? roleRedirect(user.role) : "/login");
}
