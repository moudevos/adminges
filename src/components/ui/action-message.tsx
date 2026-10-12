import { cn } from "@/lib/utils";

type ActionState = {
  ok: boolean;
  message: string;
};

export function ActionMessage({
  state,
  className,
}: {
  state: ActionState;
  className?: string;
}) {
  if (!state.message) return null;

  return (
    <div
      role={state.ok ? "status" : "alert"}
      className={cn(
        "rounded-[9px] border px-4 py-3 text-sm",
        state.ok
          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
          : "border-rose-200 bg-rose-50 text-rose-700",
        className,
      )}
    >
      {state.message}
    </div>
  );
}
