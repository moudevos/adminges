import { NextResponse } from "next/server";
import { z } from "zod";
import { setSalesShift } from "@/features/ventas/server/mutations";

const schema = z.object({
  journeyId: z.string().uuid(),
  personId: z.string().uuid(),
  onShift: z.boolean(),
});

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ message: "Datos inválidos." }, { status: 400 });
  }

  const result = await setSalesShift(parsed.data);
  return NextResponse.json(
    result.ok ? result : { message: result.message },
    { status: result.ok ? 200 : 409 },
  );
}
