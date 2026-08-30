import { createPoisForCity } from "@/utils";
import { CityExplorer } from "@/app/components/CityExplorer";

type Props = {
  initialSelectedPoiId?: string;
};

export const RomeMap = async ({ initialSelectedPoiId }: Props = {}) => {
  const pois = await createPoisForCity("rome");
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
      coordinates={coordinates}
      initialZoom={15}
      initialSelectedPoiId={initialSelectedPoiId ?? null}
      pois={pois}
    />
  );
};
