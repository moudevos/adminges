import { NextResponse } from "next/server";
import { z } from "zod";
import { openSalesDay } from "@/features/ventas/server/mutations";

const schema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ message: "Fecha inválida." }, { status: 400 });
  }

  const result = await openSalesDay(parsed.data.date);
  return NextResponse.json(
    result.ok ? result : { message: result.message },
    { status: result.ok ? 200 : 409 },
  );
}
