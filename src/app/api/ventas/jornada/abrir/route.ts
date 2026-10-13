import { NextResponse } from "next/server";
import { z } from "zod";
import { openSalesDay } from "@/features/ventas/server/mutations";

const schema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  quotaAmt: z.number().min(0),
  quotaLaminas: z.number().int().min(0),
  quotaScPlus: z.number().min(0),
  team: z
    .array(
      z.object({
        personId: z.string().uuid(),
        scheduledTime: z
          .string()
          .regex(/^(09|1[0-8]):(00|30)$|^19:00$/),
        sellsToday: z.boolean(),
      }),
    )
    .min(1),
});

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { message: "Revisa cuotas, equipo y horas de ingreso." },
      { status: 400 },
    );
  }

  const result = await openSalesDay(parsed.data);
  return NextResponse.json(
    result.ok ? result : { message: result.message },
    { status: result.ok ? 200 : 409 },
  );
}
