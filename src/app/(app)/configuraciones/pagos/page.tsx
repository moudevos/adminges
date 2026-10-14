import { PaymentMethodsManager } from "@/features/ventas/components/payment-methods-modal";
import { loadPaymentMethods } from "@/features/ventas/server/loaders";

export const dynamic = "force-dynamic";

export default async function PaymentSettingsPage() {
  const methods = await loadPaymentMethods();

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Configuraciones</h1>
        <p className="mt-1 text-sm text-slate-500">
          Gestión de métodos de pago. Las opciones históricas se conservan incluso
          cuando se desactivan.
        </p>
      </div>
      <PaymentMethodsManager methods={methods} />
      <div className="max-w-3xl rounded-lg border border-indigo-100 bg-indigo-50 p-4 text-xs leading-5 text-indigo-900">
        Trade-in se registra como un método de pago. Si una venta HHP FP utiliza
        Trade-in (aunque tenga otros medios), se cuentan sus unidades HHP FP
        una sola vez para el avance de la cuota comercial en unidades.
      </div>
    </div>
  );
}
