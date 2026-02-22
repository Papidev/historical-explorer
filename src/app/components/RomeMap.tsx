import { createPoisForCity } from "@/utils";
import { RomeMapClient } from "@/app/components/RomeMapClient";

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
    <RomeMapClient
      citySlug="rome"
      coordinates={coordinates}
      initialZoom={15}
      initialSelectedPoiId={initialSelectedPoiId ?? null}
      pois={pois}
    />
  );
};
