import type { ReactNode } from "react";

type ModalProps = {
  open: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  children: ReactNode;
  maxWidthClassName?: string;
};

export function Modal({
  open,
  title,
  description,
  onClose,
  children,
  maxWidthClassName = "max-w-2xl",
}: ModalProps) {
  if (!open) return null;

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
        className={`relative z-10 max-h-[90vh] w-full overflow-y-auto rounded-xl border border-slate-200 bg-white p-5 shadow-[0_20px_60px_rgba(15,23,42,0.18)] ${maxWidthClassName}`}
      >
        <div className="mb-5">
          <h2 id="system-modal-title" className="text-lg font-semibold text-slate-900">
            {title}
          </h2>
          {description ? (
            <p className="mt-1 text-sm leading-6 text-slate-500">{description}</p>
          ) : null}
        </div>
        {children}
      </section>
    </div>
  );
}
