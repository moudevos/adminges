import { CommercialSalesAnalysis } from "@/features/inteligencia/components/commercial-sales-analysis";
import { loadCommercialIntelligence } from "@/features/inteligencia/server/loaders";
import type { ForecastModel } from "@/features/inteligencia/domain/projection";

export const dynamic = "force-dynamic";

export default async function SalesAnalysisPage({
  searchParams,
}: {
  searchParams: Promise<{ ciclo?: string; modelo?: string }>;
}) {
  const params = await searchParams;
  const model: ForecastModel = params.modelo === "lineal" ? "lineal" : "plano";
  return <CommercialSalesAnalysis data={await loadCommercialIntelligence(params.ciclo, model, true)} />;
}
