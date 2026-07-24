import { OwnerOrAdminGuard } from "@/components/shells/OwnerOrAdminGuard";
import { ReportsDashboard } from "@/components/organisms/ReportsDashboard";

export default function ReportsPage() {
  return (
    <OwnerOrAdminGuard>
      <ReportsDashboard />
    </OwnerOrAdminGuard>
  );
}
