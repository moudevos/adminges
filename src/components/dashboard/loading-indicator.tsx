type LoadingIndicatorProps = {
  overlay?: boolean;
  message?: string;
};

export function LoadingIndicator({
  overlay = false,
  message = "Cargando información...",
}: LoadingIndicatorProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className={
        overlay
          ? "fixed inset-0 z-[100] grid place-items-center bg-white/78 px-4 backdrop-blur-[2px]"
          : "grid min-h-[55vh] place-items-center px-4"
      }
    >
      <div className="flex min-w-56 flex-col items-center rounded-2xl border border-slate-200 bg-white px-7 py-6 text-center shadow-xl shadow-slate-200/50">
        <div className="relative size-10" aria-hidden="true">
          <span className="absolute inset-0 rounded-full border-[3px] border-slate-200" />
          <span className="absolute inset-0 animate-spin rounded-full border-[3px] border-transparent border-t-slate-950" />
        </div>
        <p className="mt-4 text-sm font-semibold text-slate-900">Procesando</p>
        <p className="mt-1 text-xs text-slate-500">{message}</p>
      </div>
    </div>
  );
}
