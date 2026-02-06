import { createPoisForCity } from "@/utils";
import { RomeMapClient } from "@/app/components/RomeMapClient";

export const RomeMap = () => {
  const pois = createPoisForCity("rome");
  const coordinates: [number, number] = pois[0]
    ? [pois[0].coordinates.lng, pois[0].coordinates.lat]
    : [12.4922, 41.8902];

  return (
    <RomeMapClient coordinates={coordinates} initialZoom={15} pois={pois} />
  );
};
