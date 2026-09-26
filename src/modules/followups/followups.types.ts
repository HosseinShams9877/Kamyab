import type { RenewalEffect } from "@/types/enums";

// Isomorphic types for the followups domain (C-11 record-result + B-6). No Prisma,
// no server-only imports — shared by the service, the API route, and the client
// record-result form / case follow-up timeline.

/** An active follow-up result, for the record-result picker (settings-owned, B-6). */
export type FollowUpResultOption = {
  id: string;
  title: string;
  effectOnRenewal: RenewalEffect;
};

/** A follow-up as shown in the case timeline (newest first). A follow-up is
 *  immutable (B-6): a mistake is corrected by adding a new one, never editing. */
export type FollowUpRow = {
  id: string;
  resultTitle: string;
  effectOnRenewal: RenewalEffect;
  note: string | null;
  taskTitle: string | null;
  createdByName: string;
  createdAt: string; // Jalali YYYY/MM/DD
};

/** The most recent follow-up recorded against a period, for the "last follow-up"
 *  line on a period card (C-9). Keyed by periodId in the case page. */
export type LatestPeriodFollowUp = {
  name: string; // who recorded it
  date: string; // Jalali YYYY/MM/DD
  note: string | null;
};
