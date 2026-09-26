import { NextResponse } from "next/server";
import { getCurrentUser } from "@/modules/auth";
import { deletePayment } from "@/modules/payments";

// Delete a payment (C-7), addressed by payment id. Confirmation is a client
// concern; the payments service authorizes (record-scoped, rule 3) and records
// the deletion in history. Next 15 hands params as a Promise.
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ paymentId: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });

  const { paymentId } = await params;
  const result = await deletePayment(user, paymentId);
  if (!result.ok) {
    return NextResponse.json({ ok: false, message: result.message }, { status: result.code });
  }
  return NextResponse.json({ ok: true });
}
