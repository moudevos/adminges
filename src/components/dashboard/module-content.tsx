"use client";

import { ModuleTabs } from "@/components/dashboard/module-tabs";

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
      { key: "diaria", label: "Cuota diaria" },
      { key: "mensual", label: "Cuota mensual" },
      { key: "seguimiento-mensual", label: "Seguimiento mensual" },
      { key: "seguimiento-diario", label: "Seguimiento diario" },
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
      <ModuleTabs module={activeModule} tabs={config.tabs} active={active} />

      <section className="rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-xs font-medium uppercase tracking-[0.12em] text-slate-400">
          {config.tabs.find((tab) => tab.key === active)?.label}
        </p>
        <h2 className="mt-2 text-xl font-semibold tracking-tight text-slate-900">
          Módulo preparado
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
          {config.description}
        </p>
        <p className="mt-5 text-sm text-slate-400">
          Primero estabilizaremos Inventario y después conectaremos esta vista al flujo real.
        </p>
      </section>
    </div>
  );
}
