import { connection } from "next/server";
import { visitorContent } from "@/server/visitorContent";
import { mergeVisitorCity } from "@/server/visitorContent/mergeCity";
import { publicCatalog } from "@/server/publicCatalog";
import { CityExplorer } from "@/app/components/CityExplorer";

type Props = {
  initialSelectedPoiId?: string;
};

export const RomeMap = async ({ initialSelectedPoiId }: Props = {}) => {
  await connection();
  const city = await visitorContent.getCity("rome").catch(() => null);
  if (!city)
    return (
      <p role="status" className="p-6 text-zinc-600">
        Places are temporarily unavailable. Please try again later.
      </p>
    );
  const { pois, categoryDefinitions, aliases } = mergeVisitorCity(city, publicCatalog);
  if (!pois.length)
    return (
      <p role="status" className="p-6 text-zinc-600">
        No published places are available yet.
      </p>
    );
  const initialSelectedPoi = initialSelectedPoiId
    ? pois.find((poi) => poi.id === (aliases[initialSelectedPoiId] ?? initialSelectedPoiId))
    : undefined;
  const coordinates: [number, number] = initialSelectedPoi
    ? [initialSelectedPoi.coordinates.lng, initialSelectedPoi.coordinates.lat]
    : pois[0]
      ? [pois[0].coordinates.lng, pois[0].coordinates.lat]
      : [12.4922, 41.8902];

  return (
    <CityExplorer
      citySlug="rome"
      categoryDefinitions={categoryDefinitions}
      coordinates={coordinates}
      initialZoom={15}
      initialSelectedPoiId={initialSelectedPoi?.id ?? null}
      pois={pois}
    />
  );
};
