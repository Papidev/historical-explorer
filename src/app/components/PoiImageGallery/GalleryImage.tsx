import { useState } from "react";
import Image from "next/image";
import { PhotoIcon } from "@heroicons/react/24/outline";

export const GalleryImage = ({
  src,
  alt,
  variant,
}: {
  src: string;
  alt: string;
  variant: "photo" | "thumbnail";
}) => {
  const [status, setStatus] = useState<"loading" | "loaded" | "failed">("loading");
  const [attempt, setAttempt] = useState(0);
  return (
    <div className="relative h-full w-full" aria-busy={status === "loading"}>
      {status !== "loaded" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 rounded-lg bg-stone-200/50 text-zinc-500">
          {variant === "thumbnail" ? (
            <>
              <PhotoIcon className="size-5" aria-hidden="true" />
              {status === "failed" && <span className="text-[10px]">Unavailable</span>}
            </>
          ) : (
            <>
              <p role="status" className="text-sm">
                {status === "loading" ? "Loading image…" : "Image unavailable"}
              </p>
              {status === "failed" && (
                <button
                  type="button"
                  onClick={() => {
                    setAttempt((current) => current + 1);
                    setStatus("loading");
                  }}
                  className="cursor-pointer rounded-full border border-zinc-300 bg-white px-4 py-2 text-sm text-zinc-900 hover:bg-zinc-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900"
                >
                  Retry
                </button>
              )}
            </>
          )}
        </div>
      )}
      {status !== "failed" && (
        <Image
          key={attempt}
          src={src}
          alt={alt}
          fill
          sizes={
            variant === "thumbnail"
              ? "96px"
              : "(min-width: 1280px) 1024px, (min-width: 768px) calc(100vw - 12rem), calc(100vw - 3.5rem)"
          }
          loading="eager"
          className={`${variant === "photo" ? "object-contain" : "object-cover"} ${status === "loaded" ? "opacity-100" : "opacity-0"}`}
          onLoad={() => setStatus("loaded")}
          onError={() => setStatus("failed")}
        />
      )}
    </div>
  );
};
