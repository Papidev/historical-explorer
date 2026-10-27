import type { PublishedPoiDetail } from "@/server/content/publishedContent";

export type GalleryPrototypeProps = {
  images: PublishedPoiDetail["gallery"];
  name: string;
  index: number;
  onSelect: (index: number) => void;
};
