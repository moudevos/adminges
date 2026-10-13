import { NextResponse } from "next/server";
import { z } from "zod";
import { reverseSale } from "@/features/ventas/server/mutations";

const schema = z.object({
  reason: z.string().trim().min(3).max(500),
});

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;

  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    return NextResponse.json({ message: "Venta inválida." }, { status: 400 });
  }

  const parsed = schema.safeParse(await request.json().catch(() => null));

  if (!parsed.success) {
    return NextResponse.json(
      { message: "Ingresa un motivo válido para la reversa." },
      { status: 400 },
    );
  }

  const result = await reverseSale({
    saleId: id,
    reason: parsed.data.reason,
  });

  return NextResponse.json(
    result.ok ? result : { message: result.message },
    { status: result.ok ? 200 : 409 },
  );
}
