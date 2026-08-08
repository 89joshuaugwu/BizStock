import { OwnerOnlyGuard } from "@/components/shells/OwnerOnlyGuard";
import { ReportsDashboard } from "@/components/organisms/ReportsDashboard";

export default function ReportsPage() {
  return (
    <OwnerOnlyGuard>
      <ReportsDashboard />
    </OwnerOnlyGuard>
  );
}
