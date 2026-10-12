type Props = {
  view: string;
};

const labels: Record<string, string> = {
  "agregar": "Agregar",
  "historial": "Historial",
  "analisis": "Análisis"
};

export function SalesView({ view }: Props) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-[0.12em] text-slate-400">
        {labels[view] ?? view}
      </p>
      <h2 className="mt-2 text-xl font-semibold tracking-tight text-slate-900">
        Módulo preparado
      </h2>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
        Las ventas se enlazarán a un promotor registrado en Personal.
      </p>
      <p className="mt-5 text-sm text-slate-400">
        Primero estabilizaremos Inventario y después conectaremos esta vista al flujo real.
      </p>
    </section>
  );
}
