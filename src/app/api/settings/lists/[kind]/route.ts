import { NextResponse } from "next/server";
import { getCurrentUser } from "@/modules/auth";
import { can } from "@/modules/permissions";
import {
  LIST_KINDS,
  listCreateSchema,
  createListItem,
  SettingsRuleError,
} from "@/modules/settings";
import type { ListKind } from "@/modules/settings";

// Create a managed-list item (B-5/B-6/B-7). Duplicate titles are rejected by
// the service (unique constraint) → 409 with a field error.

export async function POST(
  request: Request,
  { params }: { params: Promise<{ kind: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });
  if (!can(user, "settings.edit")) {
    return NextResponse.json({ ok: false }, { status: 403 });
  }

  const { kind } = await params;
  if (!(LIST_KINDS as readonly string[]).includes(kind)) {
    return NextResponse.json({ ok: false }, { status: 404 });
  }

  const parsed = listCreateSchema.safeParse(await request.json());
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return NextResponse.json(
      { ok: false, field: first?.path[0], message: first?.message },
      { status: 422 },
    );
  }

  try {
    const result = await createListItem(kind as ListKind, parsed.data);
    return NextResponse.json({ ok: true, id: result.id }, { status: 201 });
  } catch (err) {
    if (err instanceof SettingsRuleError) {
      return NextResponse.json(
        { ok: false, field: err.field, message: err.message },
        { status: 409 },
      );
    }
    throw err;
  }
}
