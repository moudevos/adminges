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

export type SalesClosureGroup =
  | "HHP_SERIE_S"
  | "HHP_SERIE_A"
  | "HHP_SERIE_Z"
  | "TABLETS"
  | "WEA"
  | "LAMINAS";

export type SalesClosureGroupUnits = Record<SalesClosureGroup, number>;

export type SalesClosureBreakage = {
  group: SalesClosureGroup;
  units: number;
  breakage: boolean;
  detail: string | null;
};

export type SalesClosureReport = {
  journeyId: string;
  quotas: SalesQuotas;
  sales: SalesQuotas;
  comments: string | null;
  closedAt: string;
  breakages: SalesClosureBreakage[];
};

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
  basePrice: number;
  lastSalePrice: number | null;
  available: number;
  serials: string[];
  warehouse: string | null;
  location: string | null;
  scPlusPlan?: {
    coverage: "TR" | "ROBO" | "PANTALLA" | "DANOS";
    tier: number;
    labelMin: number;
    labelMax: number;
    years: 1 | 2;
  };
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
  groupUnits: SalesClosureGroupUnits;
  closureReport: SalesClosureReport | null;
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
  precio_equipo_etiqueta?: number | null;
  equipo_producto_id?: string | null;
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


export type SalesHistoryStatusFilter = "todos" | "confirmada" | "anulada";

export type SalesHistoryFilters = {
  from: string;
  to: string;
  status: SalesHistoryStatusFilter;
  promoterId: string;
  category: string;
  type: string;
  paymentMethod: string;
  search: string;
  page: number;
};

export type SalesHistoryRow = {
  id: string;
  journeyId: string | null;
  date: string;
  status: "confirmada" | "anulada";
  total: number;
  observation: string | null;
  reversedAt: string | null;
  reversalReason: string | null;
  promoterId: string;
  promoterName: string;
  units: number;
  lines: number;
  categories: string[];
  types: string[];
  paymentMethods: string[];
};

export type SalesHistoryData = {
  schemaReady: boolean;
  schemaMessage?: string;
  filters: SalesHistoryFilters;
  rows: SalesHistoryRow[];
  total: number;
  pageSize: number;
  promoters: Array<{ id: string; name: string }>;
  categories: string[];
  types: string[];
  paymentMethods: PaymentMethodOption[];
};

export type SaleHistoryItem = {
  id: number;
  productId: string;
  sku: string;
  name: string;
  serial: string | null;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  category: string | null;
  type: string | null;
  family: string | null;
  reportGroup: SalesProductGroup;
};

export type SaleHistoryPayment = {
  id: number;
  method: string;
  methodName: string;
  amount: number;
  reference: string | null;
};

export type SaleHistoryDetailData = {
  schemaReady: boolean;
  schemaMessage?: string;
  sale: SalesHistoryRow | null;
  items: SaleHistoryItem[];
  payments: SaleHistoryPayment[];
};
