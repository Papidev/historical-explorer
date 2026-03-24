"use client";

import { useState } from "react";
import { MDXRemote } from "next-mdx-remote";
import { Callout } from "@/app/components/mdx/Callout";
import { MdxLink } from "@/app/components/mdx/MdxLink";
import type { AdminPoiRow } from "../lib/types";
import { SubmitButton } from "./SubmitButton";

const refreshConfirmMessages = {
  transformed: "Refresh transformed JSON, wiki JSON, and MDX for this POI?",
  wiki: "Refresh wiki JSON and MDX for this POI?",
  mdx: "Refresh MDX for this POI?",
} as const;

const generateConfirmMessage = "Generate transformed JSON, wiki JSON, and MDX for this POI?";

const deleteConfirmMessages = {
  transformed: "Delete transformed JSON, wiki JSON, and MDX for this POI?",
  wiki: "Delete wiki JSON and MDX for this POI?",
  mdx: "Delete MDX for this POI?",
} as const;

const CellContent = ({
  title,
  subtitle,
  updatedAt,
}: {
  title?: string;
  subtitle?: string;
  updatedAt?: string;
}) =>
  title ? (
    <>
      <p className="text-sm font-medium text-black">{title}</p>
      {subtitle ? <p className="mt-1 font-mono text-xs text-black/65">{subtitle}</p> : null}
      {updatedAt ? <p className="mt-1 text-xs text-black/55">Updated {updatedAt}</p> : null}
    </>
  ) : (
    <p className="text-sm text-black/45">Not generated</p>
  );

type SelectedPanel =
  | {
      title: string;
      kind: "text";
      content: string;
    }
  | {
      title: string;
      kind: "mdx";
      source: NonNullable<AdminPoiRow["mdxSource"]>;
    };

export const PoiRowsTable = ({
  rows,
  generateAction,
  refreshTransformedAction,
  refreshWikiAction,
  refreshMdxAction,
  deleteTransformedAction,
  deleteWikiAction,
  deleteMdxAction,
}: {
  rows: AdminPoiRow[];
  generateAction: (formData: FormData) => Promise<void>;
  refreshTransformedAction: (formData: FormData) => Promise<void>;
  refreshWikiAction: (formData: FormData) => Promise<void>;
  refreshMdxAction: (formData: FormData) => Promise<void>;
  deleteTransformedAction: (formData: FormData) => Promise<void>;
  deleteWikiAction: (formData: FormData) => Promise<void>;
  deleteMdxAction: (formData: FormData) => Promise<void>;
}) => {
  const [selectedPanel, setSelectedPanel] = useState<SelectedPanel | null>(null);

  return (
    <>
      <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-black/10 bg-white">
        <div className="grid shrink-0 grid-cols-4 border-b border-black/10 bg-black/[0.03] text-xs font-semibold uppercase tracking-[0.08em] text-black/65">
          <div className="px-4 py-3">Raw</div>
          <div className="border-l border-black/10 px-4 py-3">POLISHED</div>
          <div className="border-l border-black/10 px-4 py-3">Wiki JSON</div>
          <div className="border-l border-black/10 px-4 py-3">MDX</div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {rows.length === 0 ? (
            <p className="px-4 py-4 text-sm text-black/55">No POIs available.</p>
          ) : (
            <ul>
              {rows.map((row) => (
                <li key={row.id} className="grid grid-cols-4 divide-x divide-black/10 border-b border-black/10 last:border-b-0">
                  <div className="px-4 py-3">
                    <CellContent title={row.rawPoi?.name} subtitle={row.id} updatedAt={row.rawUpdatedAt} />
                    {row.rawPoi ? (
                      <form action={generateAction} className="mt-3">
                        <input type="hidden" name="rawFeatureIndex" value={row.rawPoi.featureIndex} />
                        <SubmitButton
                          idleLabel="Generate"
                          pendingLabel="Generating..."
                          confirmMessage={generateConfirmMessage}
                          tone="primary"
                        />
                      </form>
                    ) : null}
                  </div>
                  <div className="px-4 py-3">
                    <CellContent title={row.transformedPoi ? "Available" : undefined} updatedAt={row.transformedUpdatedAt} />
                    {row.transformedPoi ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            row.transformedJson
                              ? setSelectedPanel({ title: `${row.id} Rome JSON`, kind: "text", content: row.transformedJson })
                              : null
                          }
                          className="inline-flex items-center rounded-md border border-black/15 bg-white px-3 py-1.5 text-xs font-medium text-black transition hover:bg-black/[0.03]"
                        >
                          View JSON
                        </button>
                        <form action={refreshTransformedAction}>
                          <input type="hidden" name="poiId" value={row.id} />
                          <SubmitButton
                            idleLabel="Refresh"
                            pendingLabel="Refreshing..."
                            confirmMessage={refreshConfirmMessages.transformed}
                            tone="primary"
                          />
                        </form>
                        <form action={deleteTransformedAction}>
                          <input type="hidden" name="poiId" value={row.id} />
                          <SubmitButton
                            idleLabel="Delete"
                            pendingLabel="Deleting..."
                            confirmMessage={deleteConfirmMessages.transformed}
                            tone="danger"
                          />
                        </form>
                      </div>
                    ) : null}
                  </div>
                  <div className="px-4 py-3">
                    <CellContent title={row.wikiPoi ? "Available" : undefined} updatedAt={row.wikiUpdatedAt} />
                    {row.wikiPoi ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            row.wikiJson ? setSelectedPanel({ title: `${row.id} Wiki JSON`, kind: "text", content: row.wikiJson }) : null
                          }
                          className="inline-flex items-center rounded-md border border-black/15 bg-white px-3 py-1.5 text-xs font-medium text-black transition hover:bg-black/[0.03]"
                        >
                          View JSON
                        </button>
                        <form action={refreshWikiAction}>
                          <input type="hidden" name="poiId" value={row.id} />
                          <SubmitButton
                            idleLabel="Refresh"
                            pendingLabel="Refreshing..."
                            confirmMessage={refreshConfirmMessages.wiki}
                            tone="primary"
                          />
                        </form>
                        <form action={deleteWikiAction}>
                          <input type="hidden" name="poiId" value={row.id} />
                          <SubmitButton
                            idleLabel="Delete"
                            pendingLabel="Deleting..."
                            confirmMessage={deleteConfirmMessages.wiki}
                            tone="danger"
                          />
                        </form>
                      </div>
                    ) : null}
                  </div>
                  <div className="px-4 py-3">
                    <CellContent title={row.mdxPoi ? "Available" : undefined} updatedAt={row.mdxUpdatedAt} />
                    {row.mdxPoi ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            row.mdxSource ? setSelectedPanel({ title: `${row.id} MDX`, kind: "mdx", source: row.mdxSource }) : null
                          }
                          className="inline-flex items-center rounded-md border border-black/15 bg-white px-3 py-1.5 text-xs font-medium text-black transition hover:bg-black/[0.03]"
                        >
                          View Rendered
                        </button>
                        <form action={refreshMdxAction}>
                          <input type="hidden" name="poiId" value={row.id} />
                          <SubmitButton
                            idleLabel="Refresh"
                            pendingLabel="Refreshing..."
                            confirmMessage={refreshConfirmMessages.mdx}
                            tone="primary"
                          />
                        </form>
                        <form action={deleteMdxAction}>
                          <input type="hidden" name="poiId" value={row.id} />
                          <SubmitButton
                            idleLabel="Delete"
                            pendingLabel="Deleting..."
                            confirmMessage={deleteConfirmMessages.mdx}
                            tone="danger"
                          />
                        </form>
                      </div>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
      {selectedPanel ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/25 p-6">
          <div className="flex h-[min(80vh,720px)] w-[min(960px,100%)] flex-col overflow-hidden rounded-2xl border border-black/10 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-black/10 px-5 py-4">
              <p className="text-sm font-semibold text-black">{selectedPanel.title}</p>
              <button
                type="button"
                onClick={() => setSelectedPanel(null)}
                className="inline-flex items-center rounded-md border border-black/15 bg-white px-3 py-1.5 text-xs font-medium text-black transition hover:bg-black/[0.03]"
              >
                Close
              </button>
            </div>
            {selectedPanel.kind === "text" ? (
              <pre className="flex-1 overflow-auto whitespace-pre-wrap break-words bg-neutral-50 px-5 py-4 text-xs leading-5 text-black">
                {selectedPanel.content}
              </pre>
            ) : null}
            {selectedPanel.kind === "mdx" ? (
              <div className="flex-1 overflow-auto bg-neutral-50 px-5 py-4 text-sm leading-6 text-black">
                <div className="poi-dialog-content">
                  <MDXRemote {...selectedPanel.source} components={{ Callout, a: MdxLink }} />
                </div>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
};
