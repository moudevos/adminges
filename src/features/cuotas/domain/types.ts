import type { SalesMetricProgress } from "@/features/ventas/domain/types";

export type DailyQuotaValues = {
  amt: number;
  laminas: number;
  scPlus: number;
};

export type DailyQuotaRecord = {
  id: string;
  date: string;
  values: DailyQuotaValues;
  origin: "manual" | "apertura";
  locked: boolean;
  journeyStatus: "abierta" | "cerrada" | null;
  updatedAt: string;
};

export type DailyQuotaSuggestion = {
  values: DailyQuotaValues;
  basedOnDays: number;
  label: string;
};

export type DailyQuotaProgress = {
  amt: SalesMetricProgress;
  laminas: SalesMetricProgress;
  scPlus: SalesMetricProgress;
};

export type DailyQuotaPageData = {
  schemaReady: boolean;
  schemaMessage?: string;
  date: string;
  quota: DailyQuotaRecord | null;
  suggestion: DailyQuotaSuggestion | null;
  progress: DailyQuotaProgress;
  history: DailyQuotaRecord[];
};


export type DailyQuotaForDate = {
  quota: DailyQuotaRecord | null;
  suggestion: DailyQuotaSuggestion | null;
};
