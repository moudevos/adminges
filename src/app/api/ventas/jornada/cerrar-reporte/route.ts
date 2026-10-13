import { NextResponse } from "next/server";
import { z } from "zod";
import { closeSalesDayWithReport } from "@/features/ventas/server/mutations";

const group = z.enum([
  "HHP_SERIE_S",
  "HHP_SERIE_A",
  "HHP_SERIE_Z",
  "TABLETS",
  "WEA",
  "LAMINAS",
]);

const schema = z.object({
  journeyId: z.string().uuid(),
  comments: z.string().trim().max(2000).optional(),
  breakages: z.array(
    z.object({
      group,
      breakage: z.boolean(),
      detail: z.string().trim().max(200).nullable().optional(),
    }),
  ),
});

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));

  if (!parsed.success) {
    return NextResponse.json(
      { message: "Revisa los datos de cierre." },
      { status: 400 },
    );
  }

  const result = await closeSalesDayWithReport(parsed.data);

  return NextResponse.json(
    result.ok ? result : { message: result.message },
    { status: result.ok ? 200 : 409 },
  );
}
