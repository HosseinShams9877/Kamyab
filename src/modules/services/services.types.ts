import type { ReminderChannel, ReminderRecipient } from "@/types/enums";

// Domain types for the services module (B-1 service definition, B-4 reminder
// rules). Isomorphic leaf: pure types, safe to import from client components.

/** A category option for the service form's dropdown (from the settings module). */
export type CategoryOption = {
  id: string;
  title: string;
};

/** One row in the services list (B-1). */
export type ServiceListItem = {
  id: string;
  name: string;
  categoryTitle: string;
  renewable: boolean;
  status: boolean;
  caseCount: number;
};

/** The editable core of a service (B-1) — what the service form reads/writes. */
export type ServiceDetail = {
  id: string;
  name: string;
  categoryId: string;
  description: string | null;
  renewable: boolean;
  status: boolean;
};

/** One reminder rule of a service (B-4). */
export type ReminderRuleRow = {
  id: string;
  daysBefore: number;
  channel: ReminderChannel;
  recipient: ReminderRecipient;
  active: boolean;
};

/** The four headline stats above the services list (B-1). */
export type ServiceStats = {
  total: number;
  active: number;
  renewable: number;
  reminderRules: number;
};