import { LoadingIndicator } from "@/components/dashboard/loading-indicator";

export default function DashboardLoading() {
  return (
    <div className="min-h-screen bg-[#f5f6f8]">
      <LoadingIndicator message="Preparando la vista..." />
    </div>
  );
}
