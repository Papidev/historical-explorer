import {
  ArrowPathIcon,
  DocumentTextIcon,
  EyeIcon,
  PhotoIcon,
  PlusIcon,
  UserGroupIcon,
} from "@heroicons/react/20/solid";
import Image from "next/image";
import type { ReactNode } from "react";
import { IconButton } from "@/app/components/ui/IconButton";
import type {
  AdminAction,
  AdminPoiRow,
  MainImageCandidate,
  MainImageCandidatesArtifact,
} from "../../lib/types";
import { PipelineCell } from "./PipelineCell";
import type { SelectedPanel } from "./Preview";
import { SubmitButton } from "../SubmitButton";

export type Actions = {
  generateDraftStory: AdminAction;
  refreshStoryContent: AdminAction;
  resolveRelatedPeople: AdminAction;
  refreshMainImageCandidates: AdminAction;
};

const refreshConfirmMessages = {
  storyContent: "Refresh Story Content for this POI?",
  relatedPeople:
    "Retry resolving only the unresolved People for this Story without regenerating Story Content?",
  mainImage: "Refresh Main Image Candidates for this POI?",
} as const;

const generateConfirmMessage =
  "Generate this row? This will run the complete pipeline: Point of Interest, Wikipedia Text, Main Image Candidates, Story Content, and Related People.";
const refreshDraftStoryConfirmMessage =
  "Refresh this row? This will rerun the complete pipeline and replace each generated artifact without deleting the current artifacts first.";

const CellContent = ({
  title,
  subtitle,
  generationModel,
  isAvailable = false,
  titleTone = "status",
}: {
  title?: string;
  subtitle?: string;
  generationModel?: string;
  isAvailable?: boolean;
  titleTone?: "poi" | "status";
}) => (
  <div className="grid min-w-0 grid-rows-[1.5rem_1rem]">
    <div className="overflow-hidden">
      {title || !isAvailable ? (
        <p
          title={title}
          className={`truncate ${
            title
              ? titleTone === "poi"
                ? "text-base leading-5 font-semibold text-black"
                : "text-xs leading-4 font-semibold text-emerald-700"
              : "text-sm leading-5 text-black/35"
          }`}
        >
          {title ?? "Not generated"}
        </p>
      ) : null}
    </div>
    <div className="overflow-hidden">
      {subtitle ? (
        <p className="truncate font-mono text-xs leading-4 text-black/65" title={subtitle}>
          {subtitle}
        </p>
      ) : generationModel ? (
        <p className="truncate text-xs leading-4 text-black/55" title={`Model: ${generationModel}`}>
          Model: <span className="font-bold">{generationModel}</span>
        </p>
      ) : null}
    </div>
  </div>
);

const CellFooter = ({
  children,
  updatedAt,
  generationDuration,
  updatedAtLabel = "Updated",
  generationDurationLabel = "Generated",
  relatedPeopleUpdatedAt,
  relatedPeopleGenerationDuration,
}: {
  children?: ReactNode;
  updatedAt?: string;
  generationDuration?: string;
  updatedAtLabel?: string;
  generationDurationLabel?: string;
  relatedPeopleUpdatedAt?: string;
  relatedPeopleGenerationDuration?: string;
}) =>
  updatedAt ||
  generationDuration ||
  relatedPeopleUpdatedAt ||
  relatedPeopleGenerationDuration ||
  children ? (
    <div className="mt-auto flex flex-col items-stretch gap-2 pt-3">
      <div className="min-w-0 text-[0.6875rem] leading-4 text-black/55">
        {updatedAt ? (
          <p className="truncate" title={`${updatedAtLabel}: ${updatedAt}`}>
            {updatedAtLabel}: <span className="font-bold">{updatedAt}</span>
          </p>
        ) : null}
        {generationDuration ? (
          <p className="truncate" title={`${generationDurationLabel}: ${generationDuration}`}>
            {generationDurationLabel}: <span className="font-bold">{generationDuration}</span>
          </p>
        ) : null}
        {relatedPeopleUpdatedAt ? (
          <p className="truncate" title={`People updated: ${relatedPeopleUpdatedAt}`}>
            People updated: <span className="font-bold">{relatedPeopleUpdatedAt}</span>
          </p>
        ) : null}
        {relatedPeopleGenerationDuration ? (
          <p className="truncate" title={`People generated: ${relatedPeopleGenerationDuration}`}>
            People generated: <span className="font-bold">{relatedPeopleGenerationDuration}</span>
          </p>
        ) : null}
      </div>
      {children ? <div className="self-end">{children}</div> : null}
    </div>
  ) : null;

const isCandidateSelectable = (candidate: MainImageCandidate) =>
  Boolean(candidate.license && candidate.attribution);

const getSelectedMainImageCandidate = (artifact?: MainImageCandidatesArtifact) =>
  artifact?.candidates.find(
    (candidate) => candidate.commonsFileName === artifact.selectedCommonsFileName,
  );

const MainImageCellPreview = ({ artifact }: { artifact?: MainImageCandidatesArtifact }) => {
  const selectedCandidate = getSelectedMainImageCandidate(artifact);
  if (!selectedCandidate) {
    return null;
  }

  return (
    <a
      href={selectedCandidate.commonsPageUrl}
      target="_blank"
      rel="noreferrer"
      className="block h-20 w-28 shrink-0 overflow-hidden rounded-md border border-black/10 bg-neutral-100"
    >
      <Image
        src={selectedCandidate.thumbnailUrl}
        alt={selectedCandidate.commonsFileName}
        width={selectedCandidate.width ?? 160}
        height={selectedCandidate.height ?? 120}
        sizes="112px"
        unoptimized
        className="h-full w-full object-cover"
      />
    </a>
  );
};

const getMainImageStatus = (artifact?: MainImageCandidatesArtifact) => {
  if (!artifact) {
    return undefined;
  }

  if (artifact.candidates.length === 0) {
    return "No candidates";
  }

  if (getSelectedMainImageCandidate(artifact)) {
    return undefined;
  }

  if (artifact.candidates.every((candidate) => !isCandidateSelectable(candidate))) {
    return "Missing metadata";
  }

  return "Needs selection";
};

const ProgressMessage = ({ description }: { description: string }) => (
  <div
    role="status"
    className="mt-3 inline-flex w-fit items-center gap-2 rounded-full bg-amber-200 px-2.5 py-1 text-xs font-semibold text-amber-950 shadow-sm"
  >
    <span className="size-2 animate-pulse rounded-full bg-amber-600" aria-hidden="true" />
    <span>{description}</span>
  </div>
);

export const Row = ({
  row,
  actions,
  isInProgress,
  progressDescription,
  onSelectPanel,
  runSingleAction,
}: {
  row: AdminPoiRow;
  actions: Actions;
  isInProgress: boolean;
  progressDescription: string | null;
  onSelectPanel: (panel: SelectedPanel) => void;
  runSingleAction: (
    poiId: string,
    description: string,
    action: AdminAction,
    formData: FormData,
    includeAiSelection?: boolean,
  ) => Promise<void>;
}) => {
  const isRowEmpty =
    !row.transformedPoi && !row.wikiPoi && !row.storyContent && !row.mainImageArtifact;

  return (
    <tr
      aria-busy={isInProgress}
      className={
        isInProgress ? "shadow-[inset_0_0_0_1px_var(--color-amber-300)]" : "hover:bg-gray-50/60"
      }
    >
      <PipelineCell inProgress={isInProgress}>
        <CellContent
          title={row.rawPoi?.name}
          subtitle={row.rawPoi?.wikidata ?? row.rawPoi?.id}
          titleTone="poi"
        />
        {progressDescription ? <ProgressMessage description={progressDescription} /> : null}
        <CellFooter>
          {row.rawPoi ? (
            isRowEmpty ? (
              <form
                action={(formData) =>
                  runSingleAction(
                    row.id,
                    "Generating Draft Story...",
                    actions.generateDraftStory,
                    formData,
                    true,
                  )
                }
              >
                <input type="hidden" name="geoPlaceId" value={row.rawPoi.id} />
                <SubmitButton
                  idleLabel="Generate"
                  pendingLabel="Generating..."
                  confirmMessage={generateConfirmMessage}
                  icon={<PlusIcon />}
                  tone="primary"
                  disabled={isInProgress}
                />
              </form>
            ) : (
              <form
                action={(formData) =>
                  runSingleAction(
                    row.id,
                    "Refreshing Draft Story...",
                    actions.generateDraftStory,
                    formData,
                    true,
                  )
                }
              >
                <input type="hidden" name="geoPlaceId" value={row.rawPoi.id} />
                <SubmitButton
                  idleLabel="Refresh"
                  pendingLabel="Refreshing..."
                  confirmMessage={refreshDraftStoryConfirmMessage}
                  icon={<ArrowPathIcon />}
                  tone="danger"
                  disabled={isInProgress}
                />
              </form>
            )
          ) : null}
        </CellFooter>
      </PipelineCell>
      <PipelineCell available={Boolean(row.transformedPoi)} inProgress={isInProgress}>
        <CellContent subtitle={row.transformedPoi?.id} isAvailable={Boolean(row.transformedPoi)} />
        <CellFooter
          updatedAt={row.transformedUpdatedAt}
          generationDuration={row.transformedGenerationDuration}
        >
          {row.transformedPoi ? (
            <div className="flex flex-wrap items-center gap-1.5">
              <IconButton
                type="button"
                label="View POI JSON"
                disabled={isInProgress}
                onClick={() =>
                  row.transformedJson
                    ? onSelectPanel({
                        title: `${row.id} Rome JSON`,
                        kind: "text",
                        content: row.transformedJson,
                      })
                    : null
                }
              >
                <EyeIcon />
              </IconButton>
            </div>
          ) : null}
        </CellFooter>
      </PipelineCell>
      <PipelineCell available={Boolean(row.wikiPoi)} inProgress={isInProgress}>
        <CellContent isAvailable={Boolean(row.wikiPoi)} />
        <CellFooter updatedAt={row.wikiUpdatedAt} generationDuration={row.wikiGenerationDuration}>
          {row.wikiPoi ? (
            <IconButton
              type="button"
              label="View Wikipedia Text"
              disabled={isInProgress}
              onClick={() =>
                row.wikiText
                  ? onSelectPanel({
                      title: `${row.id} Wikipedia Text`,
                      kind: "text",
                      content: row.wikiText,
                    })
                  : null
              }
            >
              <EyeIcon />
            </IconButton>
          ) : null}
        </CellFooter>
      </PipelineCell>
      <PipelineCell available={Boolean(row.storyContent)} inProgress={isInProgress}>
        <CellContent
          generationModel={[
            row.storyContentGenerationMode,
            row.storyContentGenerationProvider,
            row.storyContentGenerationModel,
          ]
            .filter(Boolean)
            .join(" / ")}
          isAvailable={Boolean(row.storyContent)}
        />
        <CellFooter
          updatedAt={row.storyContentUpdatedAt}
          generationDuration={row.storyContentGenerationDuration}
          updatedAtLabel="Story updated"
          generationDurationLabel="Story generated"
          relatedPeopleUpdatedAt={row.relatedPeopleUpdatedAt}
          relatedPeopleGenerationDuration={row.relatedPeopleGenerationDuration}
        >
          <div className="flex flex-wrap items-center gap-1.5">
            {row.storyContent ? (
              <IconButton
                type="button"
                label="View Story Content"
                disabled={isInProgress}
                onClick={() =>
                  row.storyContent
                    ? onSelectPanel({
                        title: `${row.id} Story Content`,
                        kind: "storyContent",
                        content: row.storyContent,
                        sources: row.storyContentSources ?? [],
                      })
                    : null
                }
              >
                <EyeIcon />
              </IconButton>
            ) : null}
            {row.wikiPoi ? (
              <form
                action={(formData) =>
                  runSingleAction(
                    row.id,
                    "Generating Story Content...",
                    actions.refreshStoryContent,
                    formData,
                    true,
                  )
                }
              >
                <input type="hidden" name="poiId" value={row.id} />
                <SubmitButton
                  idleLabel={row.storyContent ? "Refresh" : "Generate"}
                  pendingLabel="Generating..."
                  confirmMessage={refreshConfirmMessages.storyContent}
                  icon={row.storyContent ? <ArrowPathIcon /> : <DocumentTextIcon />}
                  tone={row.storyContent ? "danger" : "primary"}
                  disabled={isInProgress}
                />
              </form>
            ) : null}
            {row.storyContent?.relatedPeople.some(({ personId }) => !personId) ? (
              <form
                action={(formData) =>
                  runSingleAction(
                    row.id,
                    "Resolving Related People...",
                    actions.resolveRelatedPeople,
                    formData,
                    true,
                  )
                }
              >
                <input type="hidden" name="poiId" value={row.id} />
                <SubmitButton
                  idleLabel="Resolve People"
                  pendingLabel="Resolving..."
                  confirmMessage={refreshConfirmMessages.relatedPeople}
                  icon={<UserGroupIcon />}
                  tone="danger"
                  disabled={isInProgress}
                />
              </form>
            ) : null}
          </div>
        </CellFooter>
      </PipelineCell>
      <PipelineCell
        available={Boolean(getSelectedMainImageCandidate(row.mainImageArtifact))}
        inProgress={isInProgress}
      >
        <div className="flex min-w-0 items-start gap-3">
          <MainImageCellPreview artifact={row.mainImageArtifact} />
          <CellContent
            title={getMainImageStatus(row.mainImageArtifact)}
            subtitle={
              row.mainImageArtifact
                ? `${row.mainImageArtifact.candidates.length} candidate${
                    row.mainImageArtifact.candidates.length === 1 ? "" : "s"
                  }`
                : undefined
            }
            isAvailable={Boolean(getSelectedMainImageCandidate(row.mainImageArtifact))}
          />
        </div>
        <CellFooter
          updatedAt={row.mainImageUpdatedAt}
          generationDuration={row.mainImageGenerationDuration}
        >
          {row.mainImageArtifact ? (
            <div className="flex flex-wrap items-center gap-1.5">
              <IconButton
                type="button"
                label="View Main Image Candidates"
                disabled={isInProgress}
                onClick={() =>
                  row.mainImageArtifact
                    ? onSelectPanel({
                        title: `${row.id} Main Image Candidates`,
                        kind: "mainImage",
                        poiId: row.id,
                        artifact: row.mainImageArtifact,
                      })
                    : null
                }
              >
                <EyeIcon />
              </IconButton>
              <form
                action={(formData) =>
                  runSingleAction(
                    row.id,
                    "Generating Main Image Candidates...",
                    actions.refreshMainImageCandidates,
                    formData,
                  )
                }
              >
                <input type="hidden" name="poiId" value={row.id} />
                <SubmitButton
                  idleLabel="Refresh"
                  pendingLabel="Refreshing..."
                  confirmMessage={refreshConfirmMessages.mainImage}
                  icon={<ArrowPathIcon />}
                  tone="danger"
                  disabled={isInProgress}
                />
              </form>
            </div>
          ) : row.transformedPoi ? (
            <form
              action={(formData) =>
                runSingleAction(
                  row.id,
                  "Generating Main Image Candidates...",
                  actions.refreshMainImageCandidates,
                  formData,
                )
              }
            >
              <input type="hidden" name="poiId" value={row.id} />
              <SubmitButton
                idleLabel="Generate"
                pendingLabel="Generating..."
                confirmMessage={refreshConfirmMessages.mainImage}
                icon={<PhotoIcon />}
                tone="primary"
                disabled={isInProgress}
              />
            </form>
          ) : null}
        </CellFooter>
      </PipelineCell>
    </tr>
  );
};
