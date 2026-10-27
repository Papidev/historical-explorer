import Image from "next/image";
import type { GalleryPrototypeProps } from "./types";

export const Photo = ({ images, index, name }: Omit<GalleryPrototypeProps, "onSelect">) => (
  <figure className="flex h-full min-h-0 flex-col gap-3">
    <div className="relative min-h-0 flex-1">
      <Image
        src={images[index].originalImageUrl}
        alt={`${name} — photo ${index + 1}`}
        fill
        sizes="100vw"
        unoptimized
        className="object-contain"
      />
    </div>
    <figcaption className="shrink-0 text-center text-xs leading-5 opacity-70">
      {images[index].attribution} ·{" "}
      <a
        className="underline underline-offset-2"
        href={images[index].commonsPageUrl}
        target="_blank"
        rel="noopener noreferrer"
      >
        {images[index].license} ↗
      </a>
    </figcaption>
  </figure>
);
