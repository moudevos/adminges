"use client";

import Link from "next/link";

type Props = {
  activeModule: string;
  activeView: string;
};

const configurations: Record<
  string,
  {
    tabs: Array<{ key: string; label: string }>;
    description: string;
  }
> = {
  ventas: {
    tabs: [
      { key: "agregar", label: "Agregar" },
      { key: "historial", label: "Historial" },
      { key: "analisis", label: "Análisis" },
    ],
    description: "Las ventas se enlazarán a un promotor registrado en Personal.",
  },
  cuotas: {
    tabs: [
      { key: "diaria", label: "Cuotas Diaria" },
      { key: "mensual", label: "Cuota Mensual" },
      { key: "seguimiento-mensual", label: "Seguimiento Mensual" },
      { key: "seguimiento-diario", label: "Seguimiento Diario" },
    ],
    description: "Las cuotas se medirán contra las ventas de cada promotor.",
  },
  herramientas: {
    tabs: [
      { key: "specs", label: "Specs" },
      { key: "gancheras", label: "Gancheras" },
      { key: "preciador", label: "Preciador" },
    ],
    description: "Herramientas operativas del núcleo.",
  },
};

export function ModuleContent({ activeModule, activeView }: Props) {
  const config = configurations[activeModule];
  if (!config) return null;

  const active = config.tabs.some((tab) => tab.key === activeView)
    ? activeView
    : config.tabs[0]?.key ?? "";

  return (
    <div className="space-y-4">
      <div className="flex gap-1 overflow-x-auto rounded-xl border border-slate-200 bg-white p-1">
        {config.tabs.map((tab) => (
          <Link
            key={tab.key}
            href={`/dashboard?module=${activeModule}&view=${tab.key}`}
            className={`whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium ${
              active === tab.key
                ? "bg-slate-950 text-white"
                : "text-slate-500 hover:bg-slate-50 hover:text-slate-950"
            }`}
          >
            {tab.label}
          </Link>
        ))}
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-400">
          {config.tabs.find((tab) => tab.key === active)?.label}
        </p>
        <h2 className="mt-2 text-xl font-semibold text-slate-950">Módulo preparado</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">{config.description}</p>
        <p className="mt-5 text-sm text-slate-400">
          Primero estabilizaremos Inventario y después conectaremos esta vista al flujo real.
        </p>
      </section>
    </div>
  );
}
