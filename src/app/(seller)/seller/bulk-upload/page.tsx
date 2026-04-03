import { BulkUploadQueue } from "@/components/seller/BulkUploadQueue";

export const metadata = {
  title: "Bulk Upload",
};

export default function BulkUploadPage() {
  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Bulk Upload</h1>
        <p className="text-sm text-gray-500 mt-1">
          Upload multiple photos at once. Each photo creates a separate listing
          with AI-powered pricing.
        </p>
      </div>
      <BulkUploadQueue />
    </div>
  );
}
