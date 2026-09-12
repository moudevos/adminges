import { faBoxesStacked, faChartLine, faClock, faPeopleGroup, faShop, faTarget, faReceipt } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "./actions";

export const dynamic = "force-dynamic";

const modules = [
  { name: "Tiendas", icon: faShop },
  { name: "Inventario", icon: faBoxesStacked },
  { name: "Ventas", icon: faReceipt },
  { name: "Promotores", icon: faPeopleGroup },
  { name: "Horarios", icon: faClock },
  { name: "Cuotas", icon: faTarget },
  { name: "Análisis", icon: faChartLine },
];

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  return (
    <main className="min-h-screen bg-slate-100">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div>
            <p className="text-xs font-bold tracking-[0.24em] text-slate-400">ADMINGES</p>
            <h1 className="mt-1 text-xl font-semibold text-slate-950">Panel de control</h1>
          </div>
          <form action={signOut}>
            <button className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
              Cerrar sesión
            </button>
          </form>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-6 py-8">
        <section className="rounded-2xl border border-slate-200 bg-white p-6">
          <p className="text-sm text-slate-500">Sesión activa</p>
          <h2 className="mt-1 text-2xl font-semibold text-slate-950">{user.email}</h2>
          <p className="mt-2 text-sm text-slate-500">
            Base de autenticación lista. Los módulos se habilitarán progresivamente según permisos y desarrollo.
          </p>
        </section>

        <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {modules.map((module) => (
            <article key={module.name} className="rounded-2xl border border-slate-200 bg-white p-5">
              <FontAwesomeIcon icon={module.icon} className="text-slate-500" />
              <h3 className="mt-4 font-semibold text-slate-950">{module.name}</h3>
              <p className="mt-1 text-sm text-slate-500">Preparado para implementación.</p>
            </article>
          ))}
        </section>
      </div>
    </main>
  );
}
