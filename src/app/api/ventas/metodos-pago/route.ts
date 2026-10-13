import { NextResponse } from "next/server";
import { z } from "zod";
import {
  createPaymentMethod,
  removePaymentMethod,
  setPaymentMethodActive,
} from "@/features/ventas/server/payment-methods";

const createSchema = z.object({
  name: z.string().trim().min(2).max(80),
  requiresReference: z.boolean().default(false),
});

const updateSchema = z.object({
  id: z.string().uuid(),
  active: z.boolean(),
});

const deleteSchema = z.object({
  id: z.string().uuid(),
});

export async function POST(request: Request) {
  const parsed = createSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ message: "Datos inválidos." }, { status: 400 });
  }

  const result = await createPaymentMethod(parsed.data);
  return NextResponse.json(
    result.ok ? result : { message: result.message },
    { status: result.ok ? 200 : 409 },
  );
}

export async function PATCH(request: Request) {
  const parsed = updateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ message: "Datos inválidos." }, { status: 400 });
  }

  const result = await setPaymentMethodActive(parsed.data);
  return NextResponse.json(
    result.ok ? result : { message: result.message },
    { status: result.ok ? 200 : 409 },
  );
}

export async function DELETE(request: Request) {
  const parsed = deleteSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ message: "Datos inválidos." }, { status: 400 });
  }

  const result = await removePaymentMethod(parsed.data.id);
  return NextResponse.json(
    result.ok ? result : { message: result.message },
    { status: result.ok ? 200 : 409 },
  );
}
