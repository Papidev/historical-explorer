import { useEffect, useRef } from "react";
import { GalleryImage } from "./GalleryImage";
import type { PublishedPoiDetail } from "@/server/content/publishedContent";

export const Thumbnails = ({
  images,
  index,
  onSelect,
}: {
  images: PublishedPoiDetail["gallery"];
  index: number;
  onSelect: (index: number) => void;
}) => {
  const selected = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    selected.current?.scrollIntoView?.({ block: "nearest", inline: "nearest" });
  }, [index]);
  return (
    <div
      className="flex shrink-0 gap-3 overflow-x-auto px-1 py-2"
      role="group"
      aria-label="Choose a photo"
    >
      {images.map((image, i) => (
        <button
          key={image.id}
          ref={i === index ? selected : undefined}
          type="button"
          aria-label={`View photo ${i + 1}`}
          aria-pressed={i === index}
          onClick={() => onSelect(i)}
          className="relative h-16 w-24 shrink-0 cursor-pointer overflow-hidden rounded-lg opacity-50 ring-2 ring-transparent ring-offset-2 ring-offset-stone-100 first:ml-auto last:mr-auto hover:opacity-100 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-zinc-900 aria-pressed:opacity-100 aria-pressed:ring-zinc-900"
        >
          <GalleryImage src={image.thumbnailUrl} alt="" variant="thumbnail" />
        </button>
      ))}
    </div>
  );
};
