import "server-only";

import { createClient } from "@/lib/supabase/server";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

/**
 * Identifica ventas que contienen el medio de pago marcado como Trade-in.
 * La venta se considera una sola vez aunque incluya varios medios/pagos.
 * Un pago mixto califica si hay monto positivo asignado a Trade-in.
 */
export async function loadTradeInSaleIds(
  supabase: SupabaseClient,
  saleIds: string[],
): Promise<Set<string>> {
  const { data: methods, error: methodError } = await supabase
    .from("metodos_pago")
    .select("codigo")
    .eq("es_trade_in", true);

  if (methodError) {
    throw new Error(
      "Trade-in requiere ejecutar sql/015_trade_in_comisiones_metodos_pago.sql.",
    );
  }

  const tradeCodes = (methods ?? []).map((method) => method.codigo);
  if (!tradeCodes.length) {
    throw new Error("No existe un método de pago Trade-in configurado.");
  }

  const result = new Set<string>();
  const unique = [...new Set(saleIds)];
  for (let offset = 0; offset < unique.length; offset += 150) {
    for (const code of tradeCodes) {
      let page = 0;
      while (true) {
        const { data, error } = await supabase
          .from("venta_pagos")
          .select("id, venta_id")
          .in("venta_id", unique.slice(offset, offset + 150))
          .eq("metodo", code)
          .gt("monto", 0)
          .order("id")
          .range(page * 1000, (page + 1) * 1000 - 1);
        if (error) throw new Error("No se pudo consultar los pagos Trade-in.");
        for (const row of data ?? []) result.add(row.venta_id);
        if (!data || data.length < 1000) break;
        page += 1;
      }
    }
  }

  return result;
}

/** HHP FP = series S y Z. No contabilizar tablets ni accesorios. */
export function tradeInUnits<T extends {
  componente_amt: string;
  venta_id: string;
  cantidad: number | string;
}>(lines: T[], ids: Set<string>): {
  totalHhpFp: number;
  withTradeIn: number;
  penetrationPct: number | null;
} {
  let totalHhpFp = 0;
  let withTradeIn = 0;
  for (const line of lines) {
    if (line.componente_amt !== "HHP_FP") continue;
    const quantity = Number(line.cantidad);
    totalHhpFp += quantity;
    if (ids.has(line.venta_id)) withTradeIn += quantity;
  }
  return {
    totalHhpFp,
    withTradeIn,
    penetrationPct: totalHhpFp > 0
      ? (withTradeIn / totalHhpFp) * 100
      : null,
  };
}
