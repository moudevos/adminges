export type MonthlyCycleWeeks = 4 | 5;

export type MonthlyQuotaTargets = {
  hhpFp: number;
  hhpMass: number;
  tabs: number;
  acc: number;
  amt: number;
  scPlus: number;
  laminas: number;
  arPct: number;
  ecoPct: number;
};

export type MonthlyActuals = Omit<MonthlyQuotaTargets, "arPct" | "ecoPct"> & {
  hhpTabsUnits: number;
  accNonWeaUnits: number;
  weaUnits: number;
  arPct: number | null;
  ecoPct: number | null;
};

export type MonthlySeller = {
  id: string;
  name: string;
  role: string;
  days: number;
  share: number;
  targets: MonthlyQuotaTargets;
  actuals: MonthlyActuals;
};

export type MonthlyEligiblePerson = {
  id: string;
  name: string;
  role: string;
  employmentState: "activo" | "vacaciones";
};

export type MonthlyCycleSummary = {
  id: string;
  startDate: string;
  endDate: string;
  weeks: MonthlyCycleWeeks;
  commercialDays: 28 | 35;
  targets: MonthlyQuotaTargets;
  totalPersonDays: number;
  actuals: MonthlyActuals;
  updatedAt: string;
};

export type MonthlyCycleStatus = "proximo" | "activo" | "finalizado";

export type MonthlyCycleDetail = MonthlyCycleSummary & {
  sellers: MonthlySeller[];
  status: MonthlyCycleStatus;
  daysRemaining: number;
  suggestedDaily: MonthlyQuotaTargets | null;
};

export type MonthlyQuotaPageData = {
  schemaReady: boolean;
  schemaMessage?: string;
  today: string;
  eligiblePeople: MonthlyEligiblePerson[];
  cycles: MonthlyCycleSummary[];
  selectedCycle: MonthlyCycleDetail | null;
};

export type MonthlyTrackingData = {
  schemaReady: boolean;
  schemaMessage?: string;
  today: string;
  cycles: MonthlyCycleSummary[];
  selectedCycle: MonthlyCycleDetail | null;
};
