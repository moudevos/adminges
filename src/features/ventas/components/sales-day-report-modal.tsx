"use client";

import { Modal } from "@/components/ui/modal";
import { SalesDayReportContent } from "@/features/ventas/components/sales-day-report-content";
import type { SalesClosureReport } from "@/features/ventas/domain/types";

export function SalesDayReportModal({
  open,
  report,
  onClose,
}: {
  open: boolean;
  report: SalesClosureReport | null;
  onClose: () => void;
}) {
  return (
    <Modal
      open={open && Boolean(report)}
      title="KIOSKO MALL IQUITOS"
      variant="report"
      onClose={onClose}
      maxWidthClassName="max-w-5xl"
    >
      {report ? <SalesDayReportContent report={report} /> : null}
    </Modal>
  );
}
