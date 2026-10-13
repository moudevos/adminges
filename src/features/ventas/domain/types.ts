export type SalesDayStatus = "abierta" | "cerrada";

export type SalesJourney = {
  id: string;
  date: string;
  status: SalesDayStatus;
  openedAt: string;
  closedAt: string | null;
};

export type SalesStaffMember = {
  id: string;
  name: string;
  initials: string;
  onShift: boolean;
  shiftStartedAt: string | null;
  salesCount: number;
  units: number;
  total: number;
};

export type SalesCatalogItem = {
  productId: string;
  sku: string;
  name: string;
  category: string | null;
  saleCategory: string | null;
  price: number;
  available: number;
  serials: string[];
  warehouse: string | null;
  location: string | null;
};

export type SalesRegistrationData = {
  schemaReady: boolean;
  schemaMessage?: string;
  date: string;
  journey: SalesJourney | null;
  staff: SalesStaffMember[];
  catalog: SalesCatalogItem[];
  totals: {
    sales: number;
    units: number;
    amount: number;
  };
};

export type SaleItemInput = {
  producto_id: string;
  serial?: string | null;
  cantidad: number;
  precio_unitario: number;
};

export type SalePaymentMethod =
  | "efectivo"
  | "tarjeta"
  | "yape"
  | "plin"
  | "transferencia";

export type SalePaymentInput = {
  metodo: SalePaymentMethod;
  monto: number;
  referencia?: string | null;
};
