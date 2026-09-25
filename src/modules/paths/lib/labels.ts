// Presentation data for the paths module: Persian labels for the two path types
// (B-2). Pure and isomorphic — safe to import from client components. Rule 3:
// used by this module only, so it lives in the module's own lib/ folder.

import type { PathType } from "@/types/enums";

export const PATH_TYPE_LABELS: Record<PathType, string> = {
  INITIAL: "مسیر ثبت اولیه",
  RENEWAL: "مسیر تمدید",
};
