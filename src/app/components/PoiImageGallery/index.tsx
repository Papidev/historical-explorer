"use client";

import { useRef, useState } from "react";
import { Dialog, DialogBackdrop, DialogPanel, DialogTitle } from "@headlessui/react";
import {
  ArrowsPointingOutIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import type { PublishedPoiDetail } from "@/server/content/publishedContent";
import { IconButton } from "@/app/components/ui/IconButton";
import { Photo } from "./Photo";
import { Thumbnails } from "./Thumbnails";

export const PoiImageGallery = ({
  images,
  mainImageId,
  name,
}: {
  images: PublishedPoiDetail["gallery"];
  mainImageId: string | null;
  name: string;
}) => {
  const [index, setIndex] = useState<number | null>(null);
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  if (!images.length) return null;
  const move = (direction: number) =>
    setIndex((current) => ((current ?? 0) + direction + images.length) % images.length);
  return (
    <>
      <button
        type="button"
        aria-label={`Open image gallery for ${name}`}
        onClick={() =>
          setIndex(
            Math.max(
              0,
              images.findIndex(({ id }) => id === mainImageId),
            ),
          )
        }
        className="absolute inset-0 cursor-pointer focus-visible:outline-4 focus-visible:-outline-offset-4 focus-visible:outline-white"
      >
        <span className="absolute right-4 bottom-4 flex items-center gap-2 rounded-full bg-black/65 px-3 py-2 text-xs font-medium text-white">
          <ArrowsPointingOutIcon className="size-4" aria-hidden="true" />
          View {images.length} {images.length === 1 ? "photo" : "photos"}
        </span>
      </button>
      <Dialog
        open={index !== null}
        onClose={() => setIndex(null)}
        className="relative z-50"
        onKeyDown={(event) => {
          if (
            event.altKey ||
            event.ctrlKey ||
            event.metaKey ||
            (event.target instanceof HTMLElement &&
              event.target.closest('input, textarea, select, [contenteditable="true"]'))
          )
            return;
          if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
            event.preventDefault();
            move(event.key === "ArrowLeft" ? -1 : 1);
          }
        }}
      >
        <DialogBackdrop className="fixed inset-0 bg-zinc-950/35" />
        <div className="fixed inset-0 flex items-center justify-center p-3 sm:p-6 md:p-8">
          <DialogPanel className="flex h-[90dvh] max-h-[56rem] w-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-white text-zinc-900 shadow-2xl">
            <header className="flex shrink-0 items-center justify-between gap-4 px-5 py-4 md:px-8">
              <div className="min-w-0">
                <DialogTitle className="truncate font-serif text-2xl/7 tracking-tight">
                  {name}
                </DialogTitle>
                <p className="mt-1 text-xs/5 text-zinc-500" aria-live="polite">
                  Photo {(index ?? 0) + 1} of {images.length}
                </p>
              </div>
              <IconButton label="Close gallery" onClick={() => setIndex(null)}>
                <XMarkIcon />
              </IconButton>
            </header>
            {index !== null && (
              <>
                <div className="flex min-h-0 flex-1 flex-col gap-4 bg-stone-100 p-4 md:px-16">
                  <div
                    className="min-h-0 flex-1"
                    onTouchStart={(event) => {
                      touchStart.current =
                        event.touches.length === 1
                          ? { x: event.touches[0].clientX, y: event.touches[0].clientY }
                          : null;
                    }}
                    onTouchCancel={() => {
                      touchStart.current = null;
                    }}
                    onTouchEnd={(event) => {
                      if (touchStart.current && event.changedTouches.length) {
                        const distance = event.changedTouches[0].clientX - touchStart.current.x;
                        if (
                          Math.abs(distance) > 50 &&
                          Math.abs(distance) >
                            Math.abs(event.changedTouches[0].clientY - touchStart.current.y)
                        )
                          move(distance < 0 ? 1 : -1);
                      }
                      touchStart.current = null;
                    }}
                  >
                    <Photo
                      key={images[index].id}
                      image={images[index]}
                      name={name}
                      position={index + 1}
                    />
                  </div>
                  {images.length > 1 && (
                    <Thumbnails images={images} index={index} onSelect={setIndex} />
                  )}
                </div>
                <footer className="flex shrink-0 items-center justify-between gap-3 px-5 py-3">
                  <IconButton
                    label="Previous photo"
                    disabled={images.length === 1}
                    onClick={() => move(-1)}
                  >
                    <ChevronLeftIcon />
                  </IconButton>
                  <p className="text-xs text-zinc-500">← → Browse photos · Esc Close</p>
                  <IconButton
                    label="Next photo"
                    disabled={images.length === 1}
                    onClick={() => move(1)}
                  >
                    <ChevronRightIcon />
                  </IconButton>
                </footer>
              </>
            )}
          </DialogPanel>
        </div>
      </Dialog>
    </>
  );
};
