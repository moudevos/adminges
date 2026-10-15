import { NextResponse } from "next/server";
import { z } from "zod";
import { registerSale } from "@/features/ventas/server/mutations";

const itemSchema = z.object({
  producto_id: z.string().uuid(),
  serial: z.string().trim().max(120).nullable().optional(),
  cantidad: z.number().int().positive(),
  precio_unitario: z.number().finite().min(0),
  precio_equipo_etiqueta: z.number().finite().min(400).max(10000).nullable().optional(),
  equipo_producto_id: z.string().uuid().nullable().optional(),
});

const paymentSchema = z.object({
  metodo: z.string().trim().min(1).max(80),
  monto: z.number().finite().positive(),
  referencia: z.string().trim().max(120).nullable().optional(),
});

const schema = z.object({
  journeyId: z.string().uuid(),
  personId: z.string().uuid(),
  items: z.array(itemSchema).min(1),
  payments: z.array(paymentSchema),
  observation: z.string().trim().max(500).optional(),
});

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { message: "Revisa productos, precios y pagos." },
      { status: 400 },
    );
  }

  const result = await registerSale(parsed.data);
  return NextResponse.json(
    result.ok ? result : { message: result.message },
    { status: result.ok ? 200 : 409 },
  );
}
