import { readPoiCategoryCatalog } from "@/server/poiCategoryCatalog";
import { createPoisForCity } from "@/utils";
import { isPoiRowComplete } from "@/app/admin/lib/isPoiRowComplete";
import { loadPoiLists } from "@/app/admin/lib/loadPoiLists";
import { CityExplorer } from "@/app/components/CityExplorer";

type Props = {
  initialSelectedPoiId?: string;
};

export const RomeMap = async ({ initialSelectedPoiId }: Props = {}) => {
  const [catalogPois, { rows, error }] = await Promise.all([
    createPoisForCity("rome"),
    loadPoiLists(),
  ]);
  if (error) {
    throw new Error(error);
  }
  const completePoiIds = new Set(rows.filter(isPoiRowComplete).map(({ id }) => id));
  const pois = catalogPois.filter(({ id }) => completePoiIds.has(id));
  const initialSelectedPoi = initialSelectedPoiId
    ? pois.find((poi) => poi.id === initialSelectedPoiId)
    : undefined;
  const coordinates: [number, number] = initialSelectedPoi
    ? [initialSelectedPoi.coordinates.lng, initialSelectedPoi.coordinates.lat]
    : pois[0]
      ? [pois[0].coordinates.lng, pois[0].coordinates.lat]
      : [12.4922, 41.8902];

  return (
    <CityExplorer
      citySlug="rome"
      categoryDefinitions={readPoiCategoryCatalog().categories}
      coordinates={coordinates}
      initialZoom={15}
      initialSelectedPoiId={initialSelectedPoi?.id ?? null}
      pois={pois}
    />
  );
};
