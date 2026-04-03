export const metadata = {
  title: "My Listings",
};

export default function ListingsPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900">My Listings</h1>
      <p className="mt-2 text-gray-500">
        Your active, draft, and sold listings will appear here.
      </p>
    </div>
  );
}
