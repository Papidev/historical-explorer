import { RomeMap } from "@/app/components/RomeMap";

type Props = {
  params: Promise<{
    poiId: string;
  }>;
};

export default async function RomePoiPage({ params }: Props) {
  const { poiId } = await params;

  return (
    <main className="flex h-screen flex-col">
      <header className="p-4">
        <h1 className="text-xl font-bold">Historical Explorer – Rome</h1>
        <p className="text-sm opacity-80">
          A simple starting point: a map centered on Rome.
        </p>
      </header>

      <section className="min-h-0 flex-1">
        <RomeMap initialSelectedPoiId={poiId} />
      </section>
    </main>
  );
}
