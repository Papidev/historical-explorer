import Link from "next/link";
import { PoiImportDashboard } from "@/app/components/admin/PoiImportDashboard";
import { getPoiImportComparisonData } from "@/utils/admin/poiImport";

const CITY = "rome";

const loadData = () => {
  try {
    const data = getPoiImportComparisonData(CITY);
    return { data, error: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown parsing error.";
    return { data: null, error: message };
  }
};

export default function AdminPoiImportPage() {
  const { data, error } = loadData();
  if (error || !data) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col px-6 py-10">
        <Link href="/admin" className="mb-5 text-sm text-black/70 underline underline-offset-2">
          Back to admin
        </Link>
        <section className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-900">
          <h1 className="text-lg font-semibold">Unable to load POI comparison data</h1>
          <p className="mt-2 text-sm">{error ?? "Unknown parsing error."}</p>
        </section>
      </main>
    );
  }

  const { rawPois, targetPois } = data;

  return (
    <main className="flex h-screen min-h-screen flex-col bg-neutral-50">
      <div className="border-b border-black/10 px-4 py-3 sm:px-6">
        <Link href="/admin" className="text-sm text-black/70 underline underline-offset-2">
          Back to admin
        </Link>
      </div>
      <PoiImportDashboard rawPois={rawPois} targetPois={targetPois} />
    </main>
  );
}
