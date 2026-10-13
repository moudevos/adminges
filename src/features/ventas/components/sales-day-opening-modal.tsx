"use client";

import { useMemo, useState } from "react";
import { Modal } from "@/components/ui/modal";
import type { SalesPersonOption } from "@/features/ventas/domain/types";

type TeamSelection = {
  selected: boolean;
  sellsToday: boolean;
  scheduledTime: string;
};

const times = Array.from({ length: 21 }, (_, index) => {
  const minutes = 9 * 60 + index * 30;
  const hour = Math.floor(minutes / 60);
  const minute = minutes % 60;
  return String(hour).padStart(2, "0") + ":" + String(minute).padStart(2, "0");
});

async function postJson(path: string, body: unknown) {
  const response = await fetch(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

  const payload = (await response.json()) as { message?: string };

  if (!response.ok) {
    throw new Error(payload.message ?? "No se pudo abrir la jornada.");
  }
}

export function SalesDayOpeningModal({
  open,
  date,
  people,
  onClose,
  onSaved,
}: {
  open: boolean;
  date: string;
  people: SalesPersonOption[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [quotaAmt, setQuotaAmt] = useState("");
  const [quotaLaminas, setQuotaLaminas] = useState("");
  const [quotaScPlus, setQuotaScPlus] = useState("");
  const [team, setTeam] = useState<Record<string, TeamSelection>>({});
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const selectedCount = useMemo(
    () => Object.values(team).filter((member) => member.selected).length,
    [team],
  );

  function selectionFor(person: SalesPersonOption) {
    return (
      team[person.id] ?? {
        selected: false,
        sellsToday: person.canSell,
        scheduledTime: "09:00",
      }
    );
  }

  function patchPerson(
    person: SalesPersonOption,
    patch: Partial<TeamSelection>,
  ) {
    const current = selectionFor(person);
    setTeam((value) => ({
      ...value,
      [person.id]: { ...current, ...patch },
    }));
  }

  async function save() {
    if (
      quotaAmt.trim() === "" ||
      quotaLaminas.trim() === "" ||
      quotaScPlus.trim() === ""
    ) {
      setError("Ingresa las tres cuotas del día.");
      return;
    }

    const amt = Number(quotaAmt);
    const laminas = Number(quotaLaminas);
    const scPlus = Number(quotaScPlus);

    if (
      !Number.isFinite(amt) ||
      !Number.isInteger(laminas) ||
      !Number.isFinite(scPlus) ||
      amt < 0 ||
      laminas < 0 ||
      scPlus < 0
    ) {
      setError("Ingresa correctamente las tres cuotas del día.");
      return;
    }

    const selected = people
      .map((person) => ({
        person,
        selection: selectionFor(person),
      }))
      .filter(({ selection }) => selection.selected);

    if (selected.length === 0) {
      setError("Selecciona al menos una persona disponible.");
      return;
    }

    if (
      selected.some(
        ({ person }) =>
          !person.active || person.employmentState === "vacaciones",
      )
    ) {
      setError("No puedes programar personal inactivo o de vacaciones.");
      return;
    }

    setSaving(true);
    setError("");

    try {
      await postJson("/api/ventas/jornada/abrir", {
        date,
        quotaAmt: amt,
        quotaLaminas: laminas,
        quotaScPlus: scPlus,
        team: selected.map(({ person, selection }) => ({
          personId: person.id,
          scheduledTime: selection.scheduledTime,
          sellsToday: person.canSell ? selection.sellsToday : false,
        })),
      });

      onSaved();
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "No se pudo abrir la jornada.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      title="Apertura del día"
      description="Define cuotas, equipo disponible, participación en ventas y hora programada."
      onClose={onClose}
      maxWidthClassName="max-w-4xl"
    >
      <div className="space-y-5">
        {error ? (
          <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2.5 text-xs text-rose-700">
            {error}
          </div>
        ) : null}

        <div className="grid gap-3 sm:grid-cols-3">
          <label>
            <span className="mb-1.5 block text-xs font-medium text-slate-600">
              Cuota AMT
            </span>
            <input
              type="number"
              min="0"
              step="0.01"
              required
              value={quotaAmt}
              onChange={(event) => setQuotaAmt(event.target.value)}
              placeholder="S/ 0.00"
              className="control-input h-10"
            />
          </label>

          <label>
            <span className="mb-1.5 block text-xs font-medium text-slate-600">
              Cuota Láminas
            </span>
            <input
              type="number"
              min="0"
              step="1"
              required
              value={quotaLaminas}
              onChange={(event) => setQuotaLaminas(event.target.value)}
              placeholder="0 unidades"
              className="control-input h-10"
            />
          </label>

          <label>
            <span className="mb-1.5 block text-xs font-medium text-slate-600">
              Cuota SC+
            </span>
            <input
              type="number"
              min="0"
              step="0.01"
              required
              value={quotaScPlus}
              onChange={(event) => setQuotaScPlus(event.target.value)}
              placeholder="S/ 0.00"
              className="control-input h-10"
            />
          </label>
        </div>

        <section>
          <div className="mb-2 flex items-center justify-between gap-3">
            <p className="text-xs font-semibold uppercase tracking-[0.06em] text-slate-500">
              Personal disponible
            </p>
            <span className="text-xs tabular-nums text-slate-400">
              {selectedCount} seleccionados
            </span>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            {people.map((person) => {
              const selection = selectionFor(person);
              const eligible =
                person.active && person.employmentState === "activo";

              return (
                <div
                  key={person.id}
                  className={
                    "rounded-xl border p-3 transition " +
                    (selection.selected
                      ? "border-indigo-300 bg-indigo-50/40"
                      : "border-slate-200 bg-white") +
                    (!eligible ? " opacity-55" : "")
                  }
                >
                  <button
                    type="button"
                    disabled={!eligible}
                    onClick={() =>
                      patchPerson(person, {
                        selected: !selection.selected,
                      })
                    }
                    className="flex w-full items-start justify-between gap-3 text-left disabled:cursor-not-allowed"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span
                          className={
                            "size-2 rounded-full " +
                            (selection.selected
                              ? "bg-indigo-600"
                              : "bg-slate-300")
                          }
                        />
                        <span className="font-semibold text-slate-900">
                          {person.name}
                        </span>
                      </div>
                      <p className="mt-1 pl-4 text-xs text-slate-500">
                        {person.role}
                        {!person.active
                          ? " · Inactivo"
                          : person.employmentState === "vacaciones"
                            ? " · Vacaciones"
                            : person.canSell
                              ? " · Puede vender"
                              : " · No vende"}
                      </p>
                    </div>

                    <span
                      className={
                        "rounded-full px-2 py-1 text-[10px] font-semibold " +
                        (selection.selected
                          ? "bg-indigo-600 text-white"
                          : "bg-slate-100 text-slate-500")
                      }
                    >
                      {selection.selected ? "Disponible" : "No disponible"}
                    </span>
                  </button>

                  {selection.selected ? (
                    <div className="mt-3 grid gap-2 border-t border-indigo-100 pt-3 sm:grid-cols-2">
                      <label>
                        <span className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-slate-400">
                          Hora ingreso
                        </span>
                        <select
                          value={selection.scheduledTime}
                          onChange={(event) =>
                            patchPerson(person, {
                              scheduledTime: event.target.value,
                            })
                          }
                          className="control-input h-9 text-xs"
                        >
                          {times.map((time) => (
                            <option key={time} value={time}>
                              {time}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label
                        className={
                          "flex h-9 items-center gap-2 self-end rounded-lg border px-3 text-xs font-medium " +
                          (person.canSell
                            ? "border-slate-200 text-slate-600"
                            : "border-slate-100 bg-slate-50 text-slate-400")
                        }
                      >
                        <input
                          type="checkbox"
                          disabled={!person.canSell}
                          checked={
                            person.canSell ? selection.sellsToday : false
                          }
                          onChange={(event) =>
                            patchPerson(person, {
                              sellsToday: event.target.checked,
                            })
                          }
                          className="size-4 accent-indigo-600"
                        />
                        Vende hoy
                      </label>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </section>

        <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="h-10 rounded-lg border border-slate-200 px-4 text-sm font-medium text-slate-600"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="h-10 rounded-lg bg-slate-900 px-5 text-sm font-semibold text-white disabled:opacity-50"
          >
            {saving ? "Abriendo..." : "Abrir día"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
