export type SalesDayStatus = "abierta" | "cerrada";
export type EmploymentState = "activo" | "vacaciones";

export type SalesQuotas = {
  amt: number;
  laminas: number;
  scPlus: number;
};

export type SalesMetricProgress = {
  actual: number;
  target: number;
  percent: number;
};

export type SalesProgress = {
  amt: SalesMetricProgress;
  laminas: SalesMetricProgress;
  scPlus: SalesMetricProgress;
};

export type SalesJourney = {
  id: string;
  date: string;
  status: SalesDayStatus;
  configured: boolean;
  openedAt: string;
  closedAt: string | null;
  quotas: SalesQuotas;
};

export type OpenSalesDayReference = {
  id: string;
  date: string;
  configured: boolean;
};

export type SalesPersonOption = {
  id: string;
  name: string;
  initials: string;
  role: string;
  canSell: boolean;
  active: boolean;
  employmentState: EmploymentState;
};

export type SalesStaffMember = SalesPersonOption & {
  available: boolean;
  sellsToday: boolean;
  scheduledTime: string | null;
  onShift: boolean;
  shiftStartedAt: string | null;
  salesCount: number;
  units: number;
  total: number;
  progress: SalesProgress;
};

export type SalesProductGroup =
  | "HHP_SERIE_A"
  | "HHP_SERIE_S"
  | "HHP_SERIE_Z"
  | "TABLETS"
  | "WEA"
  | "LAMINAS"
  | "ACCESORIOS"
  | "OTROS";

export type SalesCatalogItem = {
  productId: string;
  sku: string;
  name: string;
  category: string | null;
  primaryCategory: string | null;
  saleCategory: string | null;
  family: string | null;
  variant: string | null;
  reportGroup: SalesProductGroup;
  price: number;
  available: number;
  serials: string[];
  warehouse: string | null;
  location: string | null;
};

export type SalesDayData = {
  schemaReady: boolean;
  schemaMessage?: string;
  date: string;
  journey: SalesJourney | null;
  blockingOpenDay: OpenSalesDayReference | null;
  people: SalesPersonOption[];
  staff: SalesStaffMember[];
  catalog: SalesCatalogItem[];
  sellerCount: number;
  teamProgress: SalesProgress;
  totals: {
    sales: number;
    units: number;
    amount: number;
    laminas: number;
    scPlus: number;
  };
};

export type SalesDayHistoryItem = {
  id: string;
  date: string;
  status: SalesDayStatus;
  configured: boolean;
  openedAt: string;
  closedAt: string | null;
  quotas: SalesQuotas;
  staffCount: number;
  sellerCount: number;
  sales: number;
  units: number;
  amount: number;
};

export type SalesDaysHistoryData = {
  from: string;
  to: string;
  days: SalesDayHistoryItem[];
};

export type SaleItemInput = {
  producto_id: string;
  serial?: string | null;
  cantidad: number;
  precio_unitario: number;
};

export type SalePaymentMethod = string;

export type PaymentMethodOption = {
  id: string;
  code: string;
  name: string;
  active: boolean;
  requiresReference: boolean;
  sortOrder: number;
  system: boolean;
};

export type SalePaymentInput = {
  metodo: SalePaymentMethod;
  monto: number;
  referencia?: string | null;
};
