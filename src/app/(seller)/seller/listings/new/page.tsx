import { ListingWizard } from "@/components/seller/ListingWizard";

export const metadata = {
  title: "New Listing",
};

export default function NewListingPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-8">
        Create New Listing
      </h1>
      <ListingWizard />
    </div>
  );
}
