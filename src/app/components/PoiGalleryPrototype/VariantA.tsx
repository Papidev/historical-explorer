import Image from "next/image";
import { Photo } from "./Photo";
import type { GalleryPrototypeProps } from "./types";

export const VariantA = ({ images, index, name, onSelect }: GalleryPrototypeProps) => (
  <div className="flex min-h-0 flex-1 flex-col gap-5 bg-stone-100 p-4 text-zinc-900 md:px-16">
    <div className="min-h-0 flex-1">
      <Photo images={images} index={index} name={name} />
    </div>
    <div
      className="flex shrink-0 justify-center gap-3 overflow-x-auto pb-2"
      aria-label="Choose a photo"
    >
      {images.map((image, i) => (
        <button
          key={image.id}
          type="button"
          aria-label={`View photo ${i + 1}`}
          aria-pressed={i === index}
          onClick={() => onSelect(i)}
          className="relative h-16 w-24 shrink-0 cursor-pointer overflow-hidden rounded-lg opacity-50 ring-2 ring-transparent ring-offset-2 ring-offset-stone-100 hover:opacity-100 aria-pressed:opacity-100 aria-pressed:ring-zinc-900"
        >
          <Image src={image.thumbnailUrl} alt="" fill sizes="96px" className="object-cover" />
        </button>
      ))}
    </div>
  </div>
);
