import { Map } from "@/app/components/Map";
import { createPoisForCity } from "@/utils";

export const RomeMap = () => {
  const pois = createPoisForCity("rome");

  return <Map coordinates={[12.4964, 41.9028]} zoom={10} pois={pois} />;
};
