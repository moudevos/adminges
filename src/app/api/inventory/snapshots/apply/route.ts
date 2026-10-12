import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({
  snapshotId: z.string().uuid(),
});

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: claims, error: authError } = await supabase.auth.getClaims();

  if (authError || !claims?.claims?.sub) {
    return NextResponse.json({ message: "Sesión expirada." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { message: "Snapshot inválido." },
      { status: 400 },
    );
  }

  const { error } = await supabase.rpc("apply_inventory_snapshot", {
    p_snapshot_id: parsed.data.snapshotId,
  });

  if (error) {
    const message = error.message.includes("SERIAL_SKU_CONFLICT")
      ? "Existe una serie asociada históricamente a otro SKU."
      : error.message.includes("SNAPSHOT_NOT_VALIDATED")
        ? "El snapshot ya no está disponible para aplicar."
        : "No se pudo actualizar el inventario.";

    return NextResponse.json({ message }, { status: 409 });
  }

  return NextResponse.json({ ok: true });
}
