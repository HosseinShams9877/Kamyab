import type { PathType } from "@/types/enums";

// Domain types for the paths module (B-2 ordered path stages, B-3 validity
// durations). Isomorphic leaf: pure types, safe to import from client components.

export type { PathType };

/** One stage of an initial or renewal path (B-2). Order is implicit from position. */
export type PathStageRow = {
  id: string;
  title: string;
  order: number;
};

/** A service's full path definition: the two ordered stage lists (B-2). */
export type ServicePaths = {
  initial: PathStageRow[];
  renewal: PathStageRow[];
};

/** One validity duration of a renewable service (B-3). */
export type DurationRow = {
  id: string;
  title: string;
  monthCount: number;
  isDefault: boolean;
  /** True when at least one case/period already uses it — delete is then blocked. */
  inUse: boolean;
  /** Inactive durations are hidden from case registration but kept for history (B-3). */
  active: boolean;
};
