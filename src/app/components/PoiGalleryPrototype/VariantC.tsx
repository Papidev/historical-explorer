import { useEffect, useRef } from "react";
import { Photo } from "./Photo";
import type { GalleryPrototypeProps } from "./types";

export const VariantC = ({ images, index, name, onSelect }: GalleryPrototypeProps) => {
  const strip = useRef<HTMLDivElement>(null);
  useEffect(() => {
    strip.current?.children[index]?.scrollIntoView({ block: "nearest", inline: "center" });
  }, [index]);
  return (
    <div
      ref={strip}
      className="flex min-h-0 flex-1 snap-x snap-mandatory gap-6 overflow-x-auto bg-stone-200 px-[8vw] py-6 text-zinc-900"
      onScroll={(event) => {
        const page = Math.round(
          event.currentTarget.scrollLeft /
            ((event.currentTarget.firstElementChild?.clientWidth ?? 1) + 24),
        );
        if (page !== index && page >= 0 && page < images.length) onSelect(page);
      }}
    >
      {images.map((image, i) => (
        <div
          key={image.id}
          className="h-full w-[84vw] shrink-0 snap-center rounded-xl bg-white p-4 shadow-sm md:p-8"
        >
          <Photo images={images} index={i} name={name} />
        </div>
      ))}
    </div>
  );
};
