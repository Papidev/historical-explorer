import { createPoisForCity } from "@/utils";
import { RomeMapClient } from "@/app/components/RomeMapClient";

export const RomeMap = () => {
  const pois = createPoisForCity("rome");

  return (
    <RomeMapClient coordinates={[12.4922, 41.8902]} initialZoom={15} pois={pois} />
  );
};
