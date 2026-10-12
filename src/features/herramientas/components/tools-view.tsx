type Props = {
  view: string;
};

const labels: Record<string, string> = {
  "specs": "Specs",
  "gancheras": "Gancheras",
  "preciador": "Preciador"
};

export function ToolsView({ view }: Props) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-[0.12em] text-slate-400">
        {labels[view] ?? view}
      </p>
      <h2 className="mt-2 text-xl font-semibold tracking-tight text-slate-900">
        Módulo preparado
      </h2>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
        Herramientas operativas del núcleo.
      </p>
      <p className="mt-5 text-sm text-slate-400">
        Primero estabilizaremos Inventario y después conectaremos esta vista al flujo real.
      </p>
    </section>
  );
}
