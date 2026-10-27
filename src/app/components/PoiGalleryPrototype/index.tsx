"use client";

// THROWAWAY: three POI gallery layouts on /rome?variant=A|B|C.
// Question: which enlarged-image layout best supports browsing from the Story drawer?
import { useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Dialog, DialogPanel, DialogTitle } from "@headlessui/react";
import {
  ArrowsPointingOutIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import type { PublishedPoiDetail } from "@/server/content/publishedContent";
import { PrototypeSwitcher } from "@/app/components/ui/PrototypeSwitcher";
import { VariantA } from "./VariantA";
import { VariantB } from "./VariantB";
import { VariantC } from "./VariantC";

export const PoiGalleryPrototype = ({ detail }: { detail: PublishedPoiDetail }) => {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [index, setIndex] = useState<number | null>(null);
  const touchStart = useRef<number | null>(null);
  const variant = searchParams.get("variant");
  if (
    process.env.NODE_ENV === "production" ||
    !variant ||
    !["A", "B", "C"].includes(variant) ||
    !detail.gallery.length
  )
    return null;
  const switcher = (
    <PrototypeSwitcher
      variant={variant}
      keyboardEnabled={index === null}
      onChange={(next) => {
        const query = new URLSearchParams(searchParams.toString());
        query.set("variant", next);
        router.replace(`?${query}`, { scroll: false });
        console.info("Gallery prototype", {
          variant: next,
          poi: detail.id,
          index,
          count: detail.gallery.length,
        });
      }}
    />
  );
  const move = (direction: number) =>
    setIndex(
      (current) => ((current ?? 0) + direction + detail.gallery.length) % detail.gallery.length,
    );
  return (
    <>
      <button
        type="button"
        aria-label={`Open image gallery for ${detail.name}`}
        onClick={() =>
          setIndex(
            Math.max(
              0,
              detail.gallery.findIndex(({ id }) => id === detail.mainImageId),
            ),
          )
        }
        className="absolute inset-0 cursor-zoom-in focus-visible:outline-4 focus-visible:-outline-offset-4 focus-visible:outline-white"
      >
        <span className="absolute right-4 bottom-4 flex items-center gap-2 rounded-full bg-black/65 px-3 py-2 text-xs font-medium text-white">
          <ArrowsPointingOutIcon className="size-4" />
          View {detail.gallery.length} {detail.gallery.length === 1 ? "photo" : "photos"}
        </span>
      </button>
      {index === null && switcher}
      <Dialog
        open={index !== null}
        onClose={() => setIndex(null)}
        className="relative z-[80]"
        onKeyDown={(event) => {
          if (
            event.target instanceof HTMLElement &&
            event.target.closest('input, textarea, select, [contenteditable="true"], nav')
          )
            return;
          if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
            event.preventDefault();
            move(event.key === "ArrowLeft" ? -1 : 1);
          }
        }}
      >
        <DialogPanel
          className={`fixed inset-0 flex flex-col pb-20 ${variant === "A" ? "bg-zinc-950 text-white" : "bg-white text-zinc-900"}`}
        >
          <header className="flex shrink-0 items-center justify-between gap-4 px-5 py-4 md:px-8">
            <div className="min-w-0">
              <DialogTitle className="truncate font-serif text-xl md:text-2xl">
                {detail.name}
              </DialogTitle>
              <p className="mt-1 text-xs opacity-60" aria-live="polite">
                Photo {(index ?? 0) + 1} of {detail.gallery.length}
              </p>
            </div>
            <button
              type="button"
              aria-label="Close gallery"
              onClick={() => setIndex(null)}
              className="cursor-pointer rounded-full p-3 hover:bg-zinc-500/20"
            >
              <XMarkIcon className="size-6" />
            </button>
          </header>
          <div
            className="flex min-h-0 flex-1"
            onTouchStart={(event) => {
              touchStart.current = variant === "C" ? null : event.changedTouches[0].clientX;
            }}
            onTouchEnd={(event) => {
              if (
                touchStart.current !== null &&
                Math.abs(event.changedTouches[0].clientX - touchStart.current) > 50
              )
                move(event.changedTouches[0].clientX < touchStart.current ? 1 : -1);
              touchStart.current = null;
            }}
          >
            {index !== null &&
              (variant === "A" ? (
                <VariantA
                  images={detail.gallery}
                  name={detail.name}
                  index={index}
                  onSelect={setIndex}
                />
              ) : variant === "B" ? (
                <VariantB
                  images={detail.gallery}
                  name={detail.name}
                  index={index}
                  onSelect={setIndex}
                />
              ) : (
                <VariantC
                  images={detail.gallery}
                  name={detail.name}
                  index={index}
                  onSelect={setIndex}
                />
              ))}
          </div>
          <div className="flex shrink-0 items-center justify-between gap-3 px-5 pt-3">
            <button
              type="button"
              aria-label="Previous photo"
              disabled={detail.gallery.length === 1}
              onClick={() => move(-1)}
              className="flex cursor-pointer items-center gap-2 rounded-full border border-current/20 px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-30"
            >
              <ChevronLeftIcon className="size-4" />
              Previous
            </button>
            <p className="hidden text-xs opacity-50 sm:block">← → Browse photos · Esc Close</p>
            <button
              type="button"
              aria-label="Next photo"
              disabled={detail.gallery.length === 1}
              onClick={() => move(1)}
              className="flex cursor-pointer items-center gap-2 rounded-full border border-current/20 px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-30"
            >
              Next
              <ChevronRightIcon className="size-4" />
            </button>
          </div>
          {switcher}
        </DialogPanel>
      </Dialog>
    </>
  );
};
