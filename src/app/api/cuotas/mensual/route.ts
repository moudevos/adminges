import { NextResponse } from "next/server";
import { z } from "zod";
import { saveMonthlyCommercialCycle } from "@/features/cuotas/server/monthly-mutations";

const schema = z.object({
  cycleId: z.string().uuid().nullable().optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  weeks: z.union([z.literal(4), z.literal(5)]),
  hhpFp: z.number().min(0),
  hhpMass: z.number().min(0),
  tabs: z.number().min(0),
  acc: z.number().min(0),
  scPlus: z.number().min(0),
  laminas: z.number().int().min(0),
  people: z
    .array(
      z.object({
        personId: z.string().uuid(),
        days: z.number().int().min(0).max(35),
      }),
    )
    .min(1),
});

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));

  if (!parsed.success) {
    return NextResponse.json(
      { message: "Revisa el ciclo, las cuotas y los días del equipo." },
      { status: 400 },
    );
  }

  const result = await saveMonthlyCommercialCycle(parsed.data);

  return NextResponse.json(
    result.ok ? result : { message: result.message },
    { status: result.ok ? 200 : 409 },
  );
}
