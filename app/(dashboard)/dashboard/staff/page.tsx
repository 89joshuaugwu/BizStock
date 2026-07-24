import { OwnerOrAdminGuard } from "@/components/shells/OwnerOrAdminGuard";
import { StaffManagementTable } from "@/components/organisms/StaffManagementTable";

export default function StaffPage() {
  return (
    <OwnerOrAdminGuard>
      <div>
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-text-primary">Staff</h1>
          <p className="mt-1 text-sm text-text-secondary">
            Add staff accounts and control access. Staff can record sales and view products; only you can edit
            products, record purchases, and view reports.
          </p>
        </div>
        <StaffManagementTable />
      </div>
    </OwnerOrAdminGuard>
  );
}
