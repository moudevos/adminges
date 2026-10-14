import type { ReactNode } from "react";

type ModalProps = {
  open: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  children: ReactNode;
  maxWidthClassName?: string;
  variant?: "default" | "report";
};

export function Modal({
  open,
  title,
  description,
  onClose,
  children,
  maxWidthClassName = "max-w-2xl",
  variant = "default",
}: ModalProps) {
  if (!open) return null;

  const report = variant === "report";

  return (
    <div
      className="fixed inset-0 z-[70] grid place-items-center bg-slate-950/40 p-4 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="system-modal-title"
    >
      <button
        type="button"
        aria-label="Cerrar modal"
        className="absolute inset-0"
        onClick={onClose}
      />
      <section
        className={
          "relative z-10 max-h-[90vh] w-full rounded-xl border border-slate-200 bg-white shadow-[0_20px_60px_rgba(15,23,42,0.18)] " +
          (report ? "overflow-hidden " : "overflow-y-auto p-5 ") +
          maxWidthClassName
        }
      >
        {report ? (
          <>
            <div className="flex min-h-12 items-center justify-between gap-4 bg-[#203c87] px-4 py-2 text-white">
              <h2 id="system-modal-title" className="text-lg font-bold uppercase tracking-tight">
                {title}
              </h2>
              <button
                type="button"
                onClick={onClose}
                aria-label="Cerrar reporte"
                className="grid size-8 shrink-0 place-items-center rounded-md text-white/80 transition hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-white"
              >
                <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="size-5" stroke="currentColor" strokeWidth="1.8">
                  <path strokeLinecap="round" d="M5 5l14 14M19 5L5 19" />
                </svg>
              </button>
            </div>
            <div className="max-h-[calc(90vh-3rem)] overflow-y-auto p-4">
              {children}
            </div>
          </>
        ) : (
          <>
            <div className="mb-5">
              <h2 id="system-modal-title" className="text-lg font-semibold text-slate-900">
                {title}
              </h2>
              {description ? (
                <p className="mt-1 text-sm leading-6 text-slate-500">{description}</p>
              ) : null}
            </div>
            {children}
          </>
        )}
      </section>
    </div>
  );
}
