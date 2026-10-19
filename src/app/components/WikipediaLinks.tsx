"use client";

import Image from "next/image";
import type { WikipediaSource } from "@/server/wikipediaSources";
import { Disclosure, DisclosureButton, DisclosurePanel } from "@headlessui/react";
import { Fragment } from "react";
import { ArrowTopRightOnSquareIcon, ChevronDownIcon } from "@heroicons/react/24/outline";

export const WikipediaLinks = ({ sources }: { sources?: WikipediaSource[] }) => {
  if (!sources?.length) return null;
  const primary =
    sources.find(({ url }) => new URL(url).hostname === "en.wikipedia.org") ?? sources[0];
  return (
    <footer className="flex flex-wrap items-center justify-between gap-x-3 border-t border-zinc-200 pt-2 text-sm">
      <a
        href={primary.url}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`${primary.title} on Wikipedia (opens in a new tab)`}
        className="inline-flex min-h-8 items-center rounded-sm text-zinc-500 underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-4 pointer-coarse:min-h-11"
      >
        <Image
          src="/icons/wikipedia-w.svg"
          alt=""
          width={28}
          height={28}
          className="mr-1 shrink-0"
        />
        Read on Wikipedia
        <ArrowTopRightOnSquareIcon className="ml-1.5 size-3.5" aria-hidden="true" />
      </a>
      {sources.length > 1 ? (
        <Disclosure as={Fragment}>
          <DisclosureButton className="group inline-flex min-h-8 cursor-pointer items-center gap-1 rounded-sm text-zinc-500 hover:text-zinc-800 focus-visible:outline-2 focus-visible:outline-offset-4 pointer-coarse:min-h-11">
            Other languages
            <ChevronDownIcon className="size-3.5 group-data-open:rotate-180" aria-hidden="true" />
          </DisclosureButton>
          <DisclosurePanel className="basis-full">
            <ul className="flex flex-wrap justify-end gap-x-4">
              {sources
                .filter(({ url }) => url !== primary.url)
                .map(({ title, url }) => (
                  <li key={url}>
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`${title} on Wikipedia (opens in a new tab)`}
                      className="inline-flex min-h-8 items-center gap-1.5 rounded-sm text-zinc-500 underline underline-offset-4 hover:text-zinc-800 focus-visible:outline-2 focus-visible:outline-offset-2 pointer-coarse:min-h-11"
                    >
                      {new Intl.DisplayNames(["en"], { type: "language" }).of(
                        new URL(url).hostname.split(".")[0],
                      )}
                      <ArrowTopRightOnSquareIcon
                        className="size-3.5 text-zinc-400"
                        aria-hidden="true"
                      />
                    </a>
                  </li>
                ))}
            </ul>
          </DisclosurePanel>
        </Disclosure>
      ) : null}
    </footer>
  );
};
