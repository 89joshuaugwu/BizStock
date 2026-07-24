import { OwnerOnlyGuard } from "@/components/shells/OwnerOnlyGuard";
import { ProductForm } from "@/components/organisms/ProductForm";

export default function NewProductPage() {
  return (
    <OwnerOnlyGuard>
      <div>
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-text-primary">Add product</h1>
          <p className="mt-1 text-sm text-text-secondary">
            Set the reorder threshold thoughtfully — it drives your low-stock alerts.
          </p>
        </div>
        <ProductForm />
      </div>
    </OwnerOnlyGuard>
  );
}
