"use client";

import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useEffect, useState } from "react";
import type { SalesMetricProgress } from "@/features/ventas/domain/types";

export type ProgressTone = "none" | "low" | "mid" | "good" | "top";

/**
 * Niveles de avance:
 *  - none: sin cuota definida
 *  - low:  < 35%   (avance propio bajo)
 *  - mid:  35–69%  (a la mitad, va bien)
 *  - good: 70–99%  (cerca de la meta)
 *  - top:  >= 100% (sobresaliente)
 */
export function progressTone(percent: number, target: number): ProgressTone {
  if (!(target > 0)) return "none";
  if (percent >= 100) return "top";
  if (percent >= 70) return "good";
  if (percent >= 35) return "mid";
  return "low";
}

export const toneStyles: Record<
  ProgressTone,
  {
    label: string;
    bar: string;
    text: string;
    soft: string;
    ring: string;
    dot: string;
    glow: string;
  }
> = {
  none: {
    label: "Sin cuota",
    bar: "bg-slate-300",
    text: "text-slate-400",
    soft: "bg-slate-100 text-slate-500",
    ring: "ring-slate-200",
    dot: "bg-slate-300",
    glow: "",
  },
  low: {
    label: "Por impulsar",
    bar: "bg-gradient-to-r from-rose-400 to-rose-500",
    text: "text-rose-600",
    soft: "bg-rose-50 text-rose-600",
    ring: "ring-rose-200",
    dot: "bg-rose-400",
    glow: "",
  },
  mid: {
    label: "En ruta",
    bar: "bg-gradient-to-r from-amber-300 to-amber-500",
    text: "text-amber-600",
    soft: "bg-amber-50 text-amber-700",
    ring: "ring-amber-200",
    dot: "bg-amber-400",
    glow: "",
  },
  good: {
    label: "Muy bien",
    bar: "bg-gradient-to-r from-emerald-400 to-emerald-500",
    text: "text-emerald-600",
    soft: "bg-emerald-50 text-emerald-700",
    ring: "ring-emerald-200",
    dot: "bg-emerald-500",
    glow: "",
  },
  top: {
    label: "Sobresaliente",
    bar: "bg-gradient-to-r from-indigo-500 via-violet-500 to-fuchsia-500",
    text: "text-violet-600",
    soft: "bg-violet-50 text-violet-700",
    ring: "ring-violet-300",
    dot: "bg-violet-500",
    glow: "shadow-[0_0_12px_rgba(139,92,246,0.45)]",
  },
};

/** Promedio de las métricas que tienen cuota. */
export function overallPercent(metrics: SalesMetricProgress[]) {
  const active = metrics.filter((metric) => metric.target > 0);
  if (active.length === 0) return { percent: 0, target: 0 };
  const percent =
    active.reduce((sum, metric) => sum + metric.percent, 0) / active.length;
  return { percent, target: 1 };
}

const keyframes = `
@keyframes sales-shimmer {
  0% { transform: translateX(-120%); }
  100% { transform: translateX(320%); }
}
@keyframes sales-pulse {
  0%, 100% { opacity: .55; }
  50% { opacity: 1; }
}
@media (prefers-reduced-motion: reduce) {
  .sales-shimmer, .sales-pulse { animation: none !important; }
  .sales-fill { transition: none !important; }
}
`;

function money(value: number) {
  return new Intl.NumberFormat("es-PE", {
    style: "currency",
    currency: "PEN",
  }).format(value);
}

export function SalesProgressBar({
  label,
  progress,
  kind,
  icon,
  compact = false,
}: {
  label: string;
  progress: SalesMetricProgress;
  kind: "money" | "units";
  icon?: IconDefinition;
  compact?: boolean;
}) {
  const target = Math.max(0, Math.min(progress.percent, 100));
  const tone = progressTone(progress.percent, progress.target);
  const style = toneStyles[tone];

  // Entra desde 0 y se anima hasta el valor real (y en cada actualización).
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const id = requestAnimationFrame(() => setWidth(target));
    return () => cancelAnimationFrame(id);
  }, [target]);

  const actual =
    kind === "money" ? money(progress.actual) : String(progress.actual);
  const goal =
    kind === "money" ? money(progress.target) : String(progress.target);

  return (
    <div>
      <style>{keyframes}</style>

      <div className="mb-1.5 flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          {icon ? (
            <span
              className={
                "grid shrink-0 place-items-center rounded-md " +
                style.soft +
                (compact ? " size-5" : " size-6")
              }
            >
              <FontAwesomeIcon
                icon={icon}
                className={compact ? "text-[9px]" : "text-[10px]"}
              />
            </span>
          ) : null}
          <div className="min-w-0">
            <p
              className={
                "truncate font-medium text-slate-600 " +
                (compact ? "text-[11px]" : "text-xs")
              }
            >
              {label}
            </p>
            {!compact ? (
              <p className="text-[11px] tabular-nums text-slate-400">
                {actual} de {goal}
              </p>
            ) : null}
          </div>
        </div>

        <span
          className={
            "font-semibold tabular-nums transition-colors duration-500 " +
            style.text +
            (compact ? " text-xs" : " text-sm")
          }
        >
          {progress.target > 0 ? progress.percent.toFixed(0) + "%" : "—"}
        </span>
      </div>

      <div
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(target)}
        className={
          "relative overflow-hidden rounded-full bg-slate-100 " +
          (compact ? "h-1.5" : "h-2")
        }
      >
        <div
          className={
            "sales-fill relative h-full overflow-hidden rounded-full transition-[width,background-color] duration-[900ms] ease-[cubic-bezier(0.22,1,0.36,1)] " +
            style.bar +
            " " +
            style.glow
          }
          style={{ width: width + "%" }}
        >
          {tone !== "none" && target > 0 ? (
            <span
              className="sales-shimmer absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-transparent via-white/45 to-transparent"
              style={{ animation: "sales-shimmer 2.6s ease-in-out infinite" }}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}