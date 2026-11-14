"use client";

import { useMemo, useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ActionMessage } from "@/components/ui/action-message";
import { Button } from "@/components/ui/button";
import { saveZoneWithManager, setZoneActive, type ZoneActionResult } from "@/features/administracion/server/zones-actions";
import type { ZoneListItem, ZonesManagementData } from "@/features/administracion/server/zones-loaders";

type ZoneForm = { id: string | null; codigo: string; descripcion: string; encargadoPersonaId: string };
const blank: ZoneForm = { id: null, codigo: "", descripcion: "", encargadoPersonaId: "" };
const initialMessage: ZoneActionResult = { ok: false, message: "" };

export function ZonesManagement({ data }: { data: ZonesManagementData }) {
 const router = useRouter();
 const [form, setForm] = useState<ZoneForm>(blank);
 const [message, setMessage] = useState<ZoneActionResult>(initialMessage);
 const [search, setSearch] = useState("");
 const [showInactive, setShowInactive] = useState(false);
 const [confirmingId, setConfirmingId] = useState<string | null>(null);
 const [pending, startTransition] = useTransition();

 const filtered = useMemo(() => data.zones.filter((zone) => {
  if (!showInactive && !zone.isActive) return false;
  const value = (zone.codigo + " " + zone.descripcion + " " + (zone.encargadoNombre ?? "")).toLocaleLowerCase("es");
  return value.includes(search.trim().toLocaleLowerCase("es"));
 }), [data.zones, search, showInactive]);

 function edit(zone: ZoneListItem) {
  setForm({ id: zone.id, codigo: zone.codigo, descripcion: zone.descripcion, encargadoPersonaId: zone.encargadoPersonaId ?? "" });
  setMessage(initialMessage);
  setConfirmingId(null);
 }
 function reset() {
  setForm(blank);
  setMessage(initialMessage);
  setConfirmingId(null);
 }
 function submit(event: FormEvent<HTMLFormElement>) {
  event.preventDefault();
  if (pending) return;
  startTransition(async () => {
   try {
    const response = await saveZoneWithManager(form);
    setMessage(response);
    if (response.ok) { setForm(blank); router.refresh(); }
   } catch {
    setMessage({ ok: false, message: "No se pudo guardar la zona. Revisa tu sesión." });
   }
  });
 }
 function changeStatus(zone: ZoneListItem) {
  if (pending) return;
  startTransition(async () => {
   try {
    const response = await setZoneActive({ id: zone.id, active: !zone.isActive });
    setMessage(response);
    setConfirmingId(null);
    if (response.ok) {
     if (form.id === zone.id) setForm(blank);
     router.refresh();
    }
   } catch {
    setMessage({ ok: false, message: "No se pudo actualizar el estado." });
   }
  });
 }
 const missingManager = Boolean(form.encargadoPersonaId) && !data.managers.some((person) => person.id === form.encargadoPersonaId);
 const existingManager = missingManager ? data.zones.find((zone) => zone.id === form.id)?.encargadoNombre : null;

 return (
  <div className="mx-auto max-w-7xl space-y-5">
   <header className="flex flex-wrap items-center justify-between gap-3">
    <div>
     <h2 className="text-xl font-semibold text-slate-900">Zonas</h2>
     <p className="mt-1 text-sm text-slate-500">Crea y edita zonas con su encargado Zonal desde esta pantalla.</p>
    </div>
    <Button type="button" onClick={reset} disabled={pending}>+ Nueva zona</Button>
   </header>
   {data.error && <div role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">{data.error} El guardado permanecerá deshabilitado hasta aplicar la migración.</div>}
   {message.message && <ActionMessage state={message} />}
   <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_390px]">
    <section className="min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
     <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 p-4">
      <label className="min-w-[220px] flex-1">
       <span className="sr-only">Buscar zonas</span>
       <input className="control-input w-full" placeholder="Buscar código, descripción o encargado..." value={search} onChange={(e) => setSearch(e.target.value)} />
      </label>
      <label className="flex items-center gap-2 text-xs text-slate-600">
       <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} /> Mostrar inactivas
      </label>
     </div>
     <div className="overflow-x-auto">
      <table className="w-full min-w-[620px] text-left text-sm">
       <thead className="bg-slate-50 text-xs font-semibold text-slate-500">
        <tr><th className="p-3">Código</th><th className="p-3">Descripción</th><th className="p-3">Encargado Zonal</th><th className="p-3">Estado</th><th className="p-3 text-right">Acciones</th></tr>
       </thead>
       <tbody>
        {filtered.map((zone) => (
         <tr key={zone.id} className={"border-t border-slate-100 " + (form.id === zone.id ? "bg-indigo-50/60" : "hover:bg-slate-50")}>
          <td className="p-3 font-semibold text-slate-800">{zone.codigo}</td>
          <td className="p-3 text-slate-700">{zone.descripcion}</td>
          <td className="p-3 text-slate-700">{zone.encargadoNombre ?? "Sin encargado"}</td>
          <td className="p-3">
           <span className={"rounded-full px-2 py-1 text-xs " + (zone.isActive ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500")}>{zone.isActive ? "Activa" : "Inactiva"}</span>
          </td>
          <td className="p-3 text-right">
           <div className="flex justify-end gap-3">
            <button type="button" className="font-medium text-indigo-600 hover:underline disabled:opacity-50" disabled={pending} onClick={() => edit(zone)}>Editar</button>
            <button type="button" className="font-medium text-slate-600 hover:underline disabled:opacity-50" disabled={pending} onClick={() => setConfirmingId(zone.id)}>{zone.isActive ? "Eliminar" : "Reactivar"}</button>
           </div>
           {confirmingId === zone.id && (
            <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-2 text-left text-xs text-amber-900">
             {zone.isActive ? "La zona se desactivará sin borrar el historial." : "¿Reactivar esta zona?"}
             <div className="mt-2 flex gap-3">
              <button type="button" className="font-semibold underline" disabled={pending} onClick={() => changeStatus(zone)}>Confirmar</button>
              <button type="button" disabled={pending} onClick={() => setConfirmingId(null)}>Cancelar</button>
             </div>
            </div>
           )}
          </td>
         </tr>
        ))}
        {filtered.length === 0 && <tr><td colSpan={5} className="p-8 text-center text-slate-500">No hay zonas que coincidan con los filtros.</td></tr>}
       </tbody>
      </table>
     </div>
     <p className="border-t border-slate-100 px-4 py-3 text-xs text-slate-500">{filtered.length} de {data.zones.length} zonas</p>
    </section>
    <aside className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
     <h3 className="text-base font-semibold text-slate-900">{form.id ? "Editar zona" : "Crear zona"}</h3>
     <p className="mb-5 mt-1 text-xs text-slate-500">Código, descripción y encargado. Sin formularios adicionales de asignaciones.</p>
     <form onSubmit={submit} className="space-y-4">
      <label className="block text-sm font-medium text-slate-700">
       Código *
       <input name="codigo" className="control-input mt-1 w-full" required maxLength={30} value={form.codigo} onChange={(e) => setForm((prev) => ({ ...prev, codigo: e.target.value.toUpperCase() }))} placeholder="ZN001" />
      </label>
      <label className="block text-sm font-medium text-slate-700">
       Descripción *
       <textarea name="descripcion" className="control-input mt-1 w-full" rows={3} required maxLength={500} value={form.descripcion} onChange={(e) => setForm((prev) => ({ ...prev, descripcion: e.target.value }))} placeholder="Zona Norte" />
      </label>
      <label className="block text-sm font-medium text-slate-700">
       Encargado Zonal *
       <select name="encargado" className="control-input mt-1 w-full" value={form.encargadoPersonaId} required onChange={(e) => setForm((prev) => ({ ...prev, encargadoPersonaId: e.target.value }))}>
        <option value="">Seleccionar persona Zonal</option>
        {missingManager && <option value={form.encargadoPersonaId}>{existingManager || "Encargado actual no elegible"} (revisar autorización)</option>}
        {data.managers.map((manager) => <option key={manager.id} value={manager.id}>{manager.nombre + (manager.documento ? " · " + manager.documento : "")}</option>)}
       </select>
      </label>
      {data.managers.length === 0 && <p className="rounded-lg bg-amber-50 p-3 text-xs text-amber-900">No hay personas activas con puesto y rol Zonal autorizado. Registra o autoriza primero una persona desde Personal.</p>}
      <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-4">
       {form.id && <Button type="button" variant="secondary" disabled={pending} onClick={reset}>Cancelar edición</Button>}
       <Button type="submit" disabled={pending || !data.migrationReady || data.managers.length === 0}>
        {pending ? "Guardando..." : form.id ? "Guardar cambios" : "Crear zona"}
       </Button>
      </div>
     </form>
    </aside>
   </div>
  </div>
 );
}
