import { NextResponse } from "next/server";
import { z } from "zod";
import { saveDailyQuota } from "@/features/cuotas/server/mutations";

const schema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  amt: z.number().min(0),
  laminas: z.number().int().min(0),
  scPlus: z.number().min(0),
});

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));

  if (!parsed.success) {
    return NextResponse.json(
      { message: "Revisa los datos de la cuota." },
      { status: 400 },
    );
  }

  const result = await saveDailyQuota(parsed.data);

  return NextResponse.json(
    result.ok ? result : { message: result.message },
    { status: result.ok ? 200 : 409 },
  );
}
