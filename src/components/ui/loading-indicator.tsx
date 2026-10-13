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
          ? "fixed inset-0 z-[100] grid place-items-center bg-white/72 px-4 backdrop-blur-[2px]"
          : "grid min-h-[55vh] place-items-center px-4"
      }
    >
      <div className="flex min-w-56 flex-col items-center rounded-xl border border-slate-200 bg-white px-7 py-6 text-center shadow-[0_12px_32px_rgba(15,20,30,0.12)]">
        <div className="relative size-9" aria-hidden="true">
          <span className="absolute inset-0 rounded-full border-[3px] border-indigo-100" />
          <span className="loading-spinner absolute inset-0 rounded-full border-[3px] border-transparent border-t-indigo-600" />
        </div>
        <p className="mt-4 text-sm font-semibold text-slate-900">Procesando</p>
        <p className="mt-1 text-xs text-slate-500">{message}</p>
      </div>
    </div>
  );
}
