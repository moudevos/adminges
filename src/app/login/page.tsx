import { LoginForm } from "@/components/auth/login-form";

export const dynamic = "force-dynamic";

export default function LoginPage() {
  return (
    <main className="min-h-screen bg-slate-100 px-5 py-10">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-6xl items-center justify-center">
        <section className="grid w-full max-w-4xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl md:grid-cols-[1.05fr_0.95fr]">
          <div className="hidden bg-slate-950 p-12 text-white md:flex md:flex-col md:justify-between">
            <div>
              <div className="text-sm font-semibold tracking-[0.28em] text-slate-400">ADMINGES</div>
              <h1 className="mt-6 max-w-sm text-4xl font-semibold leading-tight">
                Gestión comercial.
              </h1>
            </div>
            <p className="text-xs text-slate-500">Acceso restringido a personal autorizado.</p>
          </div>

          <div className="p-8 sm:p-12">
            <div className="mb-8">
              <p className="text-sm font-semibold text-slate-500">Panel administrativo</p>
              <h2 className="mt-2 text-3xl font-semibold text-slate-950">Iniciar sesión</h2>
              <p className="mt-2 text-sm text-slate-500">Usa las credenciales asignadas por administración.</p>
            </div>
            <LoginForm />
          </div>
        </section>
      </div>
    </main>
  );
}
