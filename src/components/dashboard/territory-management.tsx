"use client";

import { type ReactNode, useActionState, useEffect, useMemo, useState } from "react";
import {
  assignStoreTerritory,
  createCluster,
  createZone,
  type TerritoryActionState,
} from "@/app/dashboard/territory-actions";
import { PERMISSIONS } from "@/lib/auth/permissions";

type ZoneRow = { id: string; code: string; name: string; is_active: boolean };
type ClusterRow = { id: string; zone_id: string; code: string; name: string; is_active: boolean };
type StoreRow = {
  id: string;
  code: string;
  name: string;
  city: string | null;
  zone_id: string | null;
  cluster_id: string | null;
  is_active: boolean;
  zones: { code: string; name: string } | null;
  clusters: { code: string; name: string } | null;
};

type Props = {
  zones: ZoneRow[];
  clusters: ClusterRow[];
  stores: StoreRow[];
  permissions: string[];
};

const initialState: TerritoryActionState = { ok: false, message: "" };

export function TerritoryManagement({ zones, clusters, stores, permissions }: Props) {
  const canManage = permissions.includes(PERMISSIONS.territoryManage);
  const [modal, setModal] = useState<"zone" | "cluster" | "store" | null>(null);
  const [selectedZone, setSelectedZone] = useState("");

  const [zoneState, zoneAction, zonePending] = useActionState(createZone, initialState);
  const [clusterState, clusterAction, clusterPending] = useActionState(createCluster, initialState);
  const [storeState, storeAction, storePending] = useActionState(assignStoreTerritory, initialState);

  useEffect(() => { if (zoneState.ok) setModal(null); }, [zoneState]);
  useEffect(() => { if (clusterState.ok) setModal(null); }, [clusterState]);
  useEffect(() => { if (storeState.ok) setModal(null); }, [storeState]);

  const filteredClusters = useMemo(
    () => clusters.filter((cluster) => !selectedZone || cluster.zone_id === selectedZone),
    [clusters, selectedZone],
  );

  return (
    <div className="space-y-4">
      {zoneState.message && <ActionMessage state={zoneState} />}
      {clusterState.message && <ActionMessage state={clusterState} />}
      {storeState.message && <ActionMessage state={storeState} />}

      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm shadow-slate-200/30">
        <div className="flex flex-col gap-4 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-950">Territorio</h2>
            <p className="mt-1 text-xs text-slate-500">Jerarquía Zona → Cluster → Tienda.</p>
          </div>
          {canManage && (
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => setModal("zone")}>Nueva zona</Button>
              <Button onClick={() => setModal("cluster")}>Nuevo cluster</Button>
              <Button onClick={() => setModal("store")}>Ubicar tienda</Button>
            </div>
          )}
        </div>

        <div className="grid gap-4 p-5 lg:grid-cols-3">
          <Stat label="Zonas" value={zones.length} />
          <Stat label="Clusters" value={clusters.length} />
          <Stat label="Tiendas visibles" value={stores.length} />
        </div>

        <div className="overflow-x-auto border-t border-slate-100">
          <table className="w-full min-w-[820px] text-left text-sm">
            <thead className="bg-slate-50/70 text-[11px] uppercase tracking-wide text-slate-400">
              <tr>
                <th className="px-5 py-3 font-medium">Tienda</th>
                <th className="px-5 py-3 font-medium">Ciudad</th>
                <th className="px-5 py-3 font-medium">Zona</th>
                <th className="px-5 py-3 font-medium">Cluster</th>
                <th className="px-5 py-3 font-medium">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {stores.map((store) => (
                <tr key={store.id} className="hover:bg-slate-50/60">
                  <td className="px-5 py-4"><p className="font-medium text-slate-900">{store.code} · {store.name}</p></td>
                  <td className="px-5 py-4 text-slate-600">{store.city || "—"}</td>
                  <td className="px-5 py-4 text-slate-600">{store.zones ? `${store.zones.code} · ${store.zones.name}` : "Sin zona"}</td>
                  <td className="px-5 py-4 text-slate-600">{store.clusters ? `${store.clusters.code} · ${store.clusters.name}` : "Sin cluster"}</td>
                  <td className="px-5 py-4"><span className={store.is_active ? "text-emerald-700" : "text-slate-400"}>{store.is_active ? "Activa" : "Inactiva"}</span></td>
                </tr>
              ))}
              {stores.length === 0 && <tr><td colSpan={5} className="px-5 py-10 text-center text-slate-400">No hay tiendas visibles.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      <Modal open={modal === "zone"} title="Nueva zona" onClose={() => setModal(null)}>
        <form action={zoneAction} className="space-y-4">
          <Field label="Código" name="code" placeholder="ZON-NORTE" required />
          <Field label="Nombre" name="name" placeholder="Zona Norte" required />
          <Field label="Descripción" name="description" placeholder="Descripción opcional" />
          {!zoneState.ok && zoneState.message && <ActionMessage state={zoneState} />}
          <Actions pending={zonePending} onCancel={() => setModal(null)} label="Crear zona" />
        </form>
      </Modal>

      <Modal open={modal === "cluster"} title="Nuevo cluster" onClose={() => setModal(null)}>
        <form action={clusterAction} className="space-y-4">
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-slate-600">Zona</span>
            <select name="zone_id" className="control-input" required defaultValue="">
              <option value="" disabled>Selecciona una zona</option>
              {zones.map((zone) => <option key={zone.id} value={zone.id}>{zone.code} · {zone.name}</option>)}
            </select>
          </label>
          <Field label="Código" name="code" placeholder="CLU-01" required />
          <Field label="Nombre" name="name" placeholder="Cluster Centro" required />
          <Field label="Descripción" name="description" />
          {!clusterState.ok && clusterState.message && <ActionMessage state={clusterState} />}
          <Actions pending={clusterPending} onCancel={() => setModal(null)} label="Crear cluster" />
        </form>
      </Modal>

      <Modal open={modal === "store"} title="Ubicar tienda" onClose={() => setModal(null)}>
        <form action={storeAction} className="space-y-4">
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-slate-600">Tienda</span>
            <select name="store_id" className="control-input" required defaultValue="">
              <option value="" disabled>Selecciona una tienda</option>
              {stores.map((store) => <option key={store.id} value={store.id}>{store.code} · {store.name}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-slate-600">Zona</span>
            <select name="zone_id" className="control-input" required value={selectedZone} onChange={(event) => setSelectedZone(event.target.value)}>
              <option value="" disabled>Selecciona una zona</option>
              {zones.map((zone) => <option key={zone.id} value={zone.id}>{zone.code} · {zone.name}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-slate-600">Cluster</span>
            <select name="cluster_id" className="control-input" defaultValue="">
              <option value="">Sin cluster</option>
              {filteredClusters.map((cluster) => <option key={cluster.id} value={cluster.id}>{cluster.code} · {cluster.name}</option>)}
            </select>
          </label>
          {!storeState.ok && storeState.message && <ActionMessage state={storeState} />}
          <Actions pending={storePending} onCancel={() => setModal(null)} label="Guardar ubicación" />
        </form>
      </Modal>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return <div className="rounded-xl border border-slate-200 bg-slate-50 p-4"><p className="text-xs text-slate-500">{label}</p><p className="mt-2 text-2xl font-semibold text-slate-950">{value}</p></div>;
}

function Button({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return <button type="button" onClick={onClick} className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800">{children}</button>;
}

function Field({ label, name, placeholder, required = false }: { label: string; name: string; placeholder?: string; required?: boolean }) {
  return <label className="block"><span className="mb-1.5 block text-xs font-medium text-slate-600">{label}</span><input name={name} placeholder={placeholder} required={required} className="control-input" /></label>;
}

function ActionMessage({ state }: { state: TerritoryActionState }) {
  return <div className={`rounded-xl border px-4 py-3 text-sm ${state.ok ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-rose-200 bg-rose-50 text-rose-700"}`}>{state.message}</div>;
}

function Actions({ pending, onCancel, label }: { pending: boolean; onCancel: () => void; label: string }) {
  return <div className="flex justify-end gap-2 border-t border-slate-100 pt-4"><button type="button" onClick={onCancel} disabled={pending} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm">Cancelar</button><button type="submit" disabled={pending} className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50">{pending ? "Procesando..." : label}</button></div>;
}

function Modal({ open, title, onClose, children }: { open: boolean; title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previous; };
  }, [open]);
  if (!open) return null;
  return <div className="fixed inset-0 z-[70] flex items-center justify-center p-4"><button type="button" className="absolute inset-0 bg-slate-950/55 backdrop-blur-sm" onClick={onClose} aria-label="Cerrar" /><section className="relative max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white shadow-2xl"><div className="flex items-center justify-between border-b border-slate-100 px-5 py-4"><h2 className="font-semibold text-slate-950">{title}</h2><button type="button" onClick={onClose} className="text-xl text-slate-400">×</button></div><div className="p-5">{children}</div></section></div>;
}
