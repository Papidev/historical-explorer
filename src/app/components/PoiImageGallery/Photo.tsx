import { GalleryImage } from "./GalleryImage";
import type { PublishedPoiDetail } from "@/server/content/publishedContent";

export const Photo = ({
  image,
  name,
  position,
}: {
  image: PublishedPoiDetail["gallery"][number];
  name: string;
  position: number;
}) => {
  return (
    <figure className="flex h-full min-h-0 flex-col gap-3">
      <div className="min-h-0 flex-1">
        <GalleryImage
          src={image.thumbnailUrl}
          alt={`${name} — photo ${position}`}
          variant="photo"
        />
      </div>
      <figcaption className="shrink-0 text-center text-xs/5 text-zinc-600">
        {image.attribution} ·{" "}
        <a
          className="underline underline-offset-2"
          href={image.commonsPageUrl}
          target="_blank"
          rel="noopener noreferrer"
        >
          {image.license} ↗
        </a>
        {" · "}
        <a
          className="underline underline-offset-2"
          href={image.originalImageUrl}
          target="_blank"
          rel="noopener noreferrer"
        >
          Open original ↗
        </a>
      </figcaption>
    </figure>
  );
};
