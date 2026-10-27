import Image from "next/image";
import { Photo } from "./Photo";
import type { GalleryPrototypeProps } from "./types";

export const VariantB = ({ images, index, name, onSelect }: GalleryPrototypeProps) => (
  <div className="grid min-h-0 flex-1 grid-rows-[1fr_auto] bg-stone-100 text-zinc-900 md:grid-cols-[1fr_18rem] md:grid-rows-1">
    <div className="min-h-0 p-5 md:p-10">
      <Photo images={images} index={index} name={name} />
    </div>
    <aside className="overflow-y-auto border-t border-zinc-200 bg-white p-5 md:border-t-0 md:border-l">
      <p className="mb-4 hidden font-serif text-2xl md:block">Explore the details</p>
      <div className="flex gap-3 overflow-x-auto md:flex-col">
        {images.map((image, i) => (
          <button
            key={image.id}
            type="button"
            aria-label={`View photo ${i + 1}`}
            aria-pressed={i === index}
            onClick={() => onSelect(i)}
            className="flex shrink-0 cursor-pointer items-center gap-4 rounded-lg border border-transparent p-2 text-left hover:bg-stone-100 aria-pressed:border-zinc-900 aria-pressed:bg-stone-100"
          >
            <Image
              src={image.thumbnailUrl}
              alt=""
              width={80}
              height={64}
              className="h-16 w-20 rounded object-cover"
            />
            <span className="hidden text-sm md:block">
              Photo {i + 1}
              <span className="mt-1 block text-xs text-zinc-500">
                {i === index ? "Currently viewing" : "View image"}
              </span>
            </span>
          </button>
        ))}
      </div>
    </aside>
  </div>
);
