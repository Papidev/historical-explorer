import { Dialog, DialogBackdrop, DialogPanel } from "@headlessui/react";
import Image from "next/image";
import type { Source, StoryContent } from "@/server/storyWorkflow";
import type { MainImageCandidate, MainImageCandidatesArtifact } from "../../lib/types";
import { SubmitButton } from "../SubmitButton";

export type SelectedPanel =
  | {
      title: string;
      kind: "text";
      content: string;
    }
  | {
      title: string;
      kind: "storyContent";
      content: StoryContent;
      sources: Source[];
    }
  | {
      title: string;
      kind: "mainImage";
      poiId: string;
      artifact: MainImageCandidatesArtifact;
    };

const isCandidateSelectable = (candidate: MainImageCandidate) =>
  Boolean(candidate.license && candidate.attribution);

const SourceLinks = ({ sourceIds, sources }: { sourceIds: string[]; sources: Source[] }) => (
  <p className="mt-1 flex flex-wrap gap-2 text-sm text-black/70">
    Sources:
    {sourceIds.map((sourceId) => {
      const source = sources.find((item) => item.id === sourceId);
      return source ? (
        <a
          key={sourceId}
          href={source.url}
          target="_blank"
          rel="noreferrer"
          className="font-medium text-blue-700 underline"
        >
          {source.title}
        </a>
      ) : (
        <span key={sourceId}>{sourceId}</span>
      );
    })}
  </p>
);

const StoryContentPreview = ({
  content,
  sources,
}: {
  content: StoryContent;
  sources: Source[];
}) => (
  <div className="flex-1 space-y-6 overflow-auto bg-neutral-50 px-5 py-4 text-base leading-7 text-black">
    <section>
      <h3 className="font-semibold">Introduction</h3>
      <p>{content.introduction.text}</p>
      <SourceLinks sourceIds={content.introduction.sourceIds} sources={sources} />
    </section>
    {Object.entries(content.topics).map(([topic, insights]) =>
      insights.length > 0 ? (
        <section key={topic}>
          <h3 className="font-semibold capitalize">{topic}</h3>
          <div className="mt-2 space-y-4">
            {insights.map((insight) => (
              <article key={insight.id} className="rounded-lg border border-black/10 bg-white p-3">
                {"time" in insight && insight.time ? (
                  <p className="font-mono text-sm text-black/70">{JSON.stringify(insight.time)}</p>
                ) : null}
                <p>{insight.description}</p>
                <SourceLinks sourceIds={insight.sourceIds} sources={sources} />
              </article>
            ))}
          </div>
        </section>
      ) : null,
    )}
    {content.relatedPeople.length > 0 ? (
      <section>
        <h3 className="font-semibold text-violet-900">Related People</h3>
        <div className="mt-2 space-y-4">
          {content.relatedPeople.map((person) => (
            <article key={person.name} className="rounded-lg border border-black/10 bg-white p-3">
              <p className="font-semibold text-violet-900">{person.name}</p>
              <p className="font-mono text-sm text-black/70">{person.personId ?? "Unresolved"}</p>
              <SourceLinks sourceIds={person.sourceIds} sources={sources} />
            </article>
          ))}
        </div>
      </section>
    ) : null}
  </div>
);

export const Preview = ({
  panel,
  onClose,
  selectMainImageCandidateAction,
}: {
  panel: SelectedPanel;
  onClose: () => void;
  selectMainImageCandidateAction: (formData: FormData) => Promise<void>;
}) => (
  <Dialog open onClose={onClose} className="relative z-50" aria-label={panel.title}>
    <DialogBackdrop className="fixed inset-0 bg-black/25" />
    <div className="fixed inset-0 flex items-center justify-center p-6">
      <DialogPanel className="flex h-[min(80vh,720px)] w-[min(960px,100%)] flex-col overflow-hidden rounded-2xl border border-black/10 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-black/10 px-5 py-4">
          <p className="text-sm font-semibold text-black">{panel.title}</p>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex cursor-pointer items-center rounded-md border border-black/15 bg-white px-3 py-1.5 text-xs font-medium text-black transition hover:bg-black/[0.03]"
          >
            Close
          </button>
        </div>
        {panel.kind === "text" ? (
          <pre className="flex-1 overflow-auto bg-neutral-50 px-5 py-4 text-base leading-7 font-medium break-words whitespace-pre-wrap text-black">
            {panel.content}
          </pre>
        ) : null}
        {panel.kind === "storyContent" ? (
          <StoryContentPreview content={panel.content} sources={panel.sources} />
        ) : null}
        {panel.kind === "mainImage" ? (
          <div className="flex-1 overflow-auto bg-neutral-50 px-5 py-4 text-sm text-black">
            {panel.artifact.candidates.length === 0 ? (
              <p className="text-sm text-black/55">No candidates found.</p>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {panel.artifact.candidates.map((candidate) => {
                  const isSelected =
                    candidate.commonsFileName === panel.artifact.selectedCommonsFileName;
                  const isSelectable = isCandidateSelectable(candidate);

                  return (
                    <article
                      key={candidate.commonsFileName}
                      className="overflow-hidden rounded-lg border border-black/10 bg-white"
                    >
                      <a
                        href={candidate.commonsPageUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="block bg-neutral-100"
                      >
                        <Image
                          src={candidate.thumbnailUrl}
                          alt={candidate.commonsFileName}
                          width={candidate.width ?? 640}
                          height={candidate.height ?? 360}
                          sizes="(min-width: 768px) 448px, 100vw"
                          unoptimized
                          className="h-56 w-full object-contain"
                        />
                      </a>
                      <div className="space-y-2 p-4">
                        <div className="flex flex-wrap items-center gap-2">
                          {candidate.isProposed ? (
                            <span className="rounded bg-amber-100 px-2 py-1 text-xs font-medium text-amber-900">
                              Proposed
                            </span>
                          ) : null}
                          {isSelected ? (
                            <span className="rounded bg-emerald-100 px-2 py-1 text-xs font-medium text-emerald-900">
                              Selected
                            </span>
                          ) : null}
                          {!isSelectable ? (
                            <span className="rounded bg-red-100 px-2 py-1 text-xs font-medium text-red-900">
                              Missing license or attribution
                            </span>
                          ) : null}
                        </div>
                        <p className="font-mono text-xs break-words text-black/75">
                          {candidate.commonsFileName}
                        </p>
                        <dl className="space-y-1 text-xs text-black/65">
                          <div>
                            <dt className="font-semibold text-black">License</dt>
                            <dd>{candidate.license ?? "Missing"}</dd>
                          </div>
                          <div>
                            <dt className="font-semibold text-black">Attribution</dt>
                            <dd>{candidate.attribution ?? "Missing"}</dd>
                          </div>
                          {candidate.author ? (
                            <div>
                              <dt className="font-semibold text-black">Author</dt>
                              <dd>{candidate.author}</dd>
                            </div>
                          ) : null}
                          <div>
                            <dt className="font-semibold text-black">Discovery</dt>
                            <dd>{candidate.discoveredVia}</dd>
                          </div>
                          {candidate.width && candidate.height ? (
                            <div>
                              <dt className="font-semibold text-black">Size</dt>
                              <dd>
                                {candidate.width} x {candidate.height}
                              </dd>
                            </div>
                          ) : null}
                        </dl>
                        <form action={selectMainImageCandidateAction}>
                          <input type="hidden" name="poiId" value={panel.poiId} />
                          <input
                            type="hidden"
                            name="commonsFileName"
                            value={candidate.commonsFileName}
                          />
                          <SubmitButton
                            idleLabel={isSelected ? "Selected" : "Select"}
                            pendingLabel="Selecting..."
                            tone="primary"
                            disabled={isSelected || !isSelectable}
                          />
                        </form>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        ) : null}
      </DialogPanel>
    </div>
  </Dialog>
);
