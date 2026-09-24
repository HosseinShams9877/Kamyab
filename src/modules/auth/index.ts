// Public API of the auth module. Import auth functionality from "@/modules/auth"
// only — never reach into auth.service / auth.session / auth.repository etc.
// directly from another module or from app/ handlers.

export {
  authenticate,
  getCurrentUser,
  requireUser,
  roleRedirect,
} from "./auth.service";

export { loginSchema } from "./auth.schema";

export {
  setSessionCookie,
  clearSessionCookie,
  readSessionCookie,
} from "./auth.session";

export type { LoginInput } from "./auth.schema";
export type { AuthResult, CurrentUser } from "./auth.types";

// Module UI. Server code (app/ pages, layouts) imports these through the barrel;
// the components themselves are client leaves that import only the isomorphic
// auth.schema, never this barrel.
export { LoginForm } from "./components/login-form";
export { LogoutButton } from "./components/logout-button";
