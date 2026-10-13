import { NextResponse } from "next/server";
import { z } from "zod";
import { closeSalesDay } from "@/features/ventas/server/mutations";

const schema = z.object({
  journeyId: z.string().uuid(),
});

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ message: "Jornada inválida." }, { status: 400 });
  }

  const result = await closeSalesDay(parsed.data.journeyId);
  return NextResponse.json(
    result.ok ? result : { message: result.message },
    { status: result.ok ? 200 : 409 },
  );
}
