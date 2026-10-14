"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  commercialEndDate,
  distributeMonthlyTargets,
  monthlyAmt,
} from "@/features/cuotas/domain/monthly-allocation";
import type {
  MonthlyCycleDetail,
  MonthlyCycleWeeks,
  MonthlyEligiblePerson,
} from "@/features/cuotas/domain/monthly-types";

function money(value: number) {
  return new Intl.NumberFormat("es-PE", {
    style: "currency",
    currency: "PEN",
  }).format(value);
}

function dateLabel(value: string) {
  const parts = value.split("-");
  return parts.length === 3
    ? parts[2] + "/" + parts[1] + "/" + parts[0]
    : value;
}

function numeric(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

export function MonthlyCycleForm({
  today,
  people,
  selected,
}: {
  today: string;
  people: MonthlyEligiblePerson[];
  selected: MonthlyCycleDetail | null;
}) {
  const router = useRouter();
  const [startDate, setStartDate] = useState(selected?.startDate ?? today);
  const [weeks, setWeeks] = useState<MonthlyCycleWeeks>(
    selected?.weeks ?? 4,
  );
  const [hhpFp, setHhpFp] = useState(
    selected ? String(selected.targets.hhpFp) : "",
  );
  const [hhpMass, setHhpMass] = useState(
    selected ? String(selected.targets.hhpMass) : "",
  );
  const [tabs, setTabs] = useState(
    selected ? String(selected.targets.tabs) : "",
  );
  const [acc, setAcc] = useState(
    selected ? String(selected.targets.acc) : "",
  );
  const [scPlus, setScPlus] = useState(
    selected ? String(selected.targets.scPlus) : "",
  );
  const [laminas, setLaminas] = useState(
    selected ? String(selected.targets.laminas) : "",
  );
  const [arPct, setArPct] = useState(
    selected ? String(selected.targets.arPct) : "",
  );
  const [tradeInUnits, setTradeInUnits] = useState(
    selected ? String(selected.targets.tradeInUnits) : "0",
  );
  const [ecoPct, setEcoPct] = useState(
    selected ? String(selected.targets.ecoPct) : "",
  );
  const [days, setDays] = useState<Record<string, number>>(() =>
    Object.fromEntries(
      people.map((person) => [
        person.id,
        selected?.sellers.find((seller) => seller.id === person.id)?.days ??
          (selected?.commercialDays ?? 28),
      ]),
    ),
  );
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const commercialDays = weeks * 7;
  const endDate = commercialEndDate(startDate, weeks);

  const targets = useMemo(() => {
    const base = {
      hhpFp: numeric(hhpFp),
      hhpMass: numeric(hhpMass),
      tabs: numeric(tabs),
      acc: numeric(acc),
    };

    return {
      ...base,
      amt: monthlyAmt(base),
      scPlus: numeric(scPlus),
      laminas: numeric(laminas),
      arPct: numeric(arPct),
      ecoPct: numeric(ecoPct),
      tradeInUnits: Math.floor(numeric(tradeInUnits)),
    };
  }, [hhpFp, hhpMass, tabs, acc, scPlus, laminas, arPct, ecoPct, tradeInUnits]);

  const weightedPeople = useMemo(
    () =>
      people.map((person) => ({
        id: person.id,
        days: days[person.id] ?? commercialDays,
      })),
    [commercialDays, days, people],
  );

  const totalPersonDays = weightedPeople.reduce(
    (sum, person) => sum + person.days,
    0,
  );

  const allocations = useMemo(
    () =>
      distributeMonthlyTargets(
        {
          hhpFp: targets.hhpFp,
          hhpMass: targets.hhpMass,
          tabs: targets.tabs,
          acc: targets.acc,
          scPlus: targets.scPlus,
          laminas: targets.laminas,
          arPct: targets.arPct,
          ecoPct: targets.ecoPct,
          tradeInUnits: targets.tradeInUnits,
        },
        weightedPeople,
      ),
    [targets, weightedPeople],
  );

  function changeWeeks(next: MonthlyCycleWeeks) {
    const oldCommercialDays = commercialDays;
    const nextCommercialDays = next * 7;

    setWeeks(next);
    setDays((current) =>
      Object.fromEntries(
        people.map((person) => {
          const previous = current[person.id] ?? oldCommercialDays;
          return [
            person.id,
            previous === oldCommercialDays
              ? nextCommercialDays
              : Math.min(previous, nextCommercialDays),
          ];
        }),
      ),
    );
  }

  async function save() {
    if (!startDate) {
      setMessage("Selecciona la fecha de inicio.");
      return;
    }

    if (people.length === 0) {
      setMessage("No hay personal activo habilitado para vender.");
      return;
    }

    if (totalPersonDays <= 0) {
      setMessage("La suma de días del equipo debe ser mayor a cero.");
      return;
    }

    const invalid = weightedPeople.find(
      (person) =>
        !Number.isInteger(person.days) ||
        person.days < 0 ||
        person.days > commercialDays,
    );

    if (invalid) {
      setMessage("Revisa los días planificados del equipo.");
      return;
    }

    setSaving(true);
    setMessage("");

    try {
      const response = await fetch("/api/cuotas/mensual", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          cycleId: selected?.id ?? null,
          startDate,
          weeks,
          hhpFp: targets.hhpFp,
          hhpMass: targets.hhpMass,
          tabs: targets.tabs,
          acc: targets.acc,
          scPlus: targets.scPlus,
          laminas: targets.laminas,
          arPct: targets.arPct,
          ecoPct: targets.ecoPct,
          tradeInUnits: targets.tradeInUnits,
          people: weightedPeople.map((person) => ({
            personId: person.id,
            days: person.days,
          })),
        }),
      });

      const payload = (await response.json()) as {
        id?: string;
        message?: string;
      };

      if (!response.ok || !payload.id) {
        throw new Error(payload.message ?? "No se pudo guardar el ciclo.");
      }

      setMessage("Cuota mensual guardada.");
      router.push("/cuotas/mensual?ciclo=" + payload.id);
      router.refresh();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "No se pudo guardar la cuota mensual.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-slate-900">
              {selected ? "Editar ciclo comercial" : "Nuevo ciclo comercial"}
            </p>
            <p className="mt-1 text-xs text-slate-400">
              El día inicial cuenta como día 1 y el final se calcula automáticamente.
            </p>
          </div>

          {selected ? (
            <button
              type="button"
              onClick={() => router.push("/cuotas/mensual")}
              className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-600"
            >
              Nuevo ciclo
            </button>
          ) : null}
        </div>

        {message ? (
          <div className="mb-4 rounded-lg bg-slate-50 px-3 py-2.5 text-xs text-slate-600">
            {message}
          </div>
        ) : null}

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <label>
            <span className="mb-1.5 block text-xs font-medium text-slate-600">
              Inicio
            </span>
            <input
              type="date"
              value={startDate}
              onChange={(event) => setStartDate(event.target.value)}
              className="control-input h-10"
            />
          </label>

          <label>
            <span className="mb-1.5 block text-xs font-medium text-slate-600">
              Duración
            </span>
            <select
              value={weeks}
              onChange={(event) =>
                changeWeeks(Number(event.target.value) === 5 ? 5 : 4)
              }
              className="control-input h-10"
            >
              <option value={4}>4 semanas · 28 días</option>
              <option value={5}>5 semanas · 35 días</option>
            </select>
          </label>

          <div>
            <span className="mb-1.5 block text-xs font-medium text-slate-600">
              Final
            </span>
            <div className="flex h-10 items-center rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm font-medium text-slate-700">
              {endDate ? dateLabel(endDate) : "—"}
            </div>
          </div>

          <div>
            <span className="mb-1.5 block text-xs font-medium text-slate-600">
              AMT total
            </span>
            <div className="flex h-10 items-center rounded-lg bg-indigo-50 px-3 text-sm font-bold text-indigo-700">
              {money(targets.amt)}
            </div>
          </div>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <QuotaInput label="HHP FP · S/Z" value={hhpFp} onChange={setHhpFp} />
          <QuotaInput
            label="HHP MASS · A"
            value={hhpMass}
            onChange={setHhpMass}
          />
          <QuotaInput label="TABS" value={tabs} onChange={setTabs} />
          <QuotaInput label="ACC" value={acc} onChange={setAcc} />
          <QuotaInput label="SC+" value={scPlus} onChange={setScPlus} />
          <QuotaInput
            label="Láminas"
            value={laminas}
            onChange={setLaminas}
          />
          <QuotaInput
            label="AR %"
            value={arPct}
            onChange={setArPct}
            percent
          />
          <QuotaInput
            label="Trade-in · unidades HHP FP"
            value={tradeInUnits}
            onChange={setTradeInUnits}
            units
          />
          <QuotaInput
            label="ECO %"
            value={ecoPct}
            onChange={setEcoPct}
            percent
          />
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
          <div>
            <p className="text-sm font-semibold text-slate-900">
              Distribución por días
            </p>
            <p className="mt-1 text-xs text-slate-400">
              Por defecto cada vendedor recibe {commercialDays} días. Puedes ajustar los días individualmente.
            </p>
          </div>
          <span className="text-xs tabular-nums text-slate-400">
            {totalPersonDays} jornadas-persona
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[920px] text-left text-sm">
            <thead className="bg-slate-50/70 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="border-b border-slate-200 px-4 py-3">Persona</th>
                <th className="border-b border-slate-200 px-4 py-3 text-center">Días</th>
                <th className="border-b border-slate-200 px-4 py-3 text-right">Participación</th>
                <th className="border-b border-slate-200 px-4 py-3 text-right">AMT</th>
                <th className="border-b border-slate-200 px-4 py-3 text-right">SC+</th>
                <th className="border-b border-slate-200 px-4 py-3 text-right">Láminas</th>
                <th className="border-b border-slate-200 px-4 py-3 text-right">AR</th>
                <th className="border-b border-slate-200 px-4 py-3 text-right">ECO</th>
                <th className="border-b border-slate-200 px-4 py-3 text-right">Trade-in und.</th>
              </tr>
            </thead>
            <tbody>
              {people.map((person) => {
                const personDays = days[person.id] ?? commercialDays;
                const allocation = allocations[person.id];
                const share =
                  totalPersonDays > 0
                    ? (personDays / totalPersonDays) * 100
                    : 0;

                return (
                  <tr key={person.id} className="border-t border-slate-100 first:border-t-0">
                    <td className="px-4 py-3.5">
                      <p className="font-medium text-slate-800">{person.name}</p>
                      <p className="mt-0.5 text-[10px] text-slate-400">
                        {person.role}
                        {person.employmentState === "vacaciones"
                          ? " · Vacaciones"
                          : ""}
                      </p>
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      <input
                        type="number"
                        min="0"
                        max={commercialDays}
                        step="1"
                        value={personDays}
                        onChange={(event) =>
                          setDays((current) => ({
                            ...current,
                            [person.id]: Math.max(
                              0,
                              Math.min(
                                commercialDays,
                                Math.round(Number(event.target.value) || 0),
                              ),
                            ),
                          }))
                        }
                        className="control-input mx-auto h-9 w-20 text-center text-sm"
                      />
                    </td>
                    <td className="px-4 py-3.5 text-right tabular-nums text-slate-500">
                      {share.toFixed(2)}%
                    </td>
                    <td className="px-4 py-3.5 text-right font-medium tabular-nums text-slate-800">
                      {money(allocation?.amt ?? 0)}
                    </td>
                    <td className="px-4 py-3.5 text-right tabular-nums text-slate-600">
                      {money(allocation?.scPlus ?? 0)}
                    </td>
                    <td className="px-4 py-3.5 text-right tabular-nums text-slate-600">
                      {money(allocation?.laminas ?? 0)}
                    </td>
                    <td className="px-4 py-3.5 text-right font-medium tabular-nums text-slate-700">
                      {(allocation?.arPct ?? targets.arPct).toFixed(2)}%
                    </td>
                    <td className="px-4 py-3.5 text-right font-medium tabular-nums text-slate-700">
                      {(allocation?.ecoPct ?? targets.ecoPct).toFixed(2)}%
                    </td>
                    <td className="px-4 py-3.5 text-right font-medium tabular-nums text-slate-700">
                      {allocation?.tradeInUnits ?? 0} und.
                    </td>
                  </tr>
                );
              })}

              {people.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center text-sm text-slate-400">
                    No hay personal activo con capacidad de venta.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <div className="flex justify-end border-t border-slate-100 px-4 py-3">
          <button
            type="button"
            disabled={saving || people.length === 0}
            onClick={save}
            className="h-10 rounded-lg bg-slate-900 px-5 text-sm font-semibold text-white disabled:bg-slate-200 disabled:text-slate-400"
          >
            {saving
              ? "Guardando..."
              : selected
                ? "Actualizar ciclo"
                : "Guardar ciclo"}
          </button>
        </div>
      </section>
    </div>
  );
}

function QuotaInput({
  label,
  value,
  onChange,
  percent = false,
  units = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  percent?: boolean;
  units?: boolean;
}) {
  return (
    <label>
      <span className="mb-1.5 block text-xs font-medium text-slate-600">
        {label}
      </span>
      <input
        type="number"
        min="0"
        max={percent ? "100" : undefined}
        step={units ? "1" : "0.01"}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={units ? "0 und." : percent ? "0.00%" : "S/ 0.00"}
        className="control-input h-10"
      />
    </label>
  );
}
