import { ForecastView } from "@/features/inteligencia/components/forecast-view";
import { loadCommercialIntelligence } from "@/features/inteligencia/server/loaders";
import type { ForecastModel } from "@/features/inteligencia/domain/projection";

export const dynamic = "force-dynamic";

export default async function PredictionPage({
  searchParams,
}: {
  searchParams: Promise<{ ciclo?: string; modelo?: string }>;
}) {
  const params = await searchParams;
  const model: ForecastModel = params.modelo === "lineal" ? "lineal" : "plano";
  return <ForecastView data={await loadCommercialIntelligence(params.ciclo, model)} />;
}
