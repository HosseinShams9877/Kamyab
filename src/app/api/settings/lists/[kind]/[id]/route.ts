import { NextResponse } from "next/server";
import { getCurrentUser } from "@/modules/auth";
import { can } from "@/modules/permissions";
import {
  LIST_KINDS,
  listUpdateSchema,
  listMoveSchema,
  updateListItem,
  moveListItem,
  deleteListItem,
  SettingsRuleError,
} from "@/modules/settings";
import type { ListKind } from "@/modules/settings";

// Update / move / delete one managed-list item (B-5/B-6/B-7). PATCH handles both
// field edits and reordering: a body carrying `direction` is a move, otherwise
// it is a field update. DELETE is refused server-side when the item is in use.

function isValidKind(kind: string): kind is ListKind {
  return (LIST_KINDS as readonly string[]).includes(kind);
}

async function guard(): Promise<NextResponse | null> {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });
  if (!can(user, "settings.edit")) {
    return NextResponse.json({ ok: false }, { status: 403 });
  }
  return null;
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ kind: string; id: string }> },
) {
  const denied = await guard();
  if (denied) return denied;

  const { kind, id } = await params;
  if (!isValidKind(kind)) return NextResponse.json({ ok: false }, { status: 404 });

  const body = (await request.json()) as Record<string, unknown>;

  // Reorder request.
  if ("direction" in body) {
    const parsed = listMoveSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ ok: false }, { status: 422 });
    }
    await moveListItem(kind, id, parsed.data.direction);
    return NextResponse.json({ ok: true });
  }

  // Field update.
  const parsed = listUpdateSchema.safeParse(body);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return NextResponse.json(
      { ok: false, field: first?.path[0], message: first?.message },
      { status: 422 },
    );
  }
  try {
    await updateListItem(kind, id, parsed.data);
    return NextResponse.json({ ok: true });
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

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ kind: string; id: string }> },
) {
  const denied = await guard();
  if (denied) return denied;

  const { kind, id } = await params;
  if (!isValidKind(kind)) return NextResponse.json({ ok: false }, { status: 404 });

  try {
    await deleteListItem(kind, id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof SettingsRuleError) {
      return NextResponse.json(
        { ok: false, message: err.message },
        { status: 409 },
      );
    }
    throw err;
  }
}
