import { pointOfInterest } from "./pointOfInterest";
import { poiTypes } from "./poiTypes";
import { createPoiTypeMappings } from "./poiTypeMappings";
import { storyWorkflow } from "./storyWorkflow";
import type { AiSelection } from "@/app/admin/lib/aiModels";
import { withPoiGeneration } from "./poiGeneration";
import { withGenerationRun } from "./generationRunLog";

export const createDraftStoryGeneration =
  (
    dependencies: {
      pointOfInterest: Pick<typeof pointOfInterest, "generate" | "linkWikidata">;
      poiTypes: Pick<typeof poiTypes, "refresh">;
      draftStory: Pick<typeof storyWorkflow.draftStory, "generate">;
      typeMappings: Pick<ReturnType<typeof createPoiTypeMappings>, "classify">;
      recordRun: typeof withGenerationRun;
    } = {
      pointOfInterest,
      poiTypes,
      draftStory: storyWorkflow.draftStory,
      typeMappings: createPoiTypeMappings(),
      recordRun: withGenerationRun,
    },
  ) =>
  async ({
    geoPlaceId,
    ai,
    onProgress,
    onCategoriesChanged,
  }: {
    geoPlaceId: string;
    ai: AiSelection;
    onProgress?: (message: string) => void;
    onCategoriesChanged?: (cities: string[]) => void;
  }) => {
    const { issues } = await dependencies.recordRun(
      { city: "rome", operation: "draftStory.generate", geoPlaceId, ai },
      async () => {
        onProgress?.("Creating the Point of Interest.");
        const { poiId } = await dependencies.pointOfInterest.generate({ geoPlaceId });
        return withPoiGeneration(poiId, async () => {
          const issues: Array<{
            stage: string;
            label: string;
            message: string;
            name?: string;
          }> = [];
          const result = await dependencies.draftStory.generate({
            poiId,
            ai,
            onProgress,
            onSourcesAcquired: async (sources) => {
              try {
                const wikidataId = sources.find(({ kind }) => kind === "wikipedia")?.wikidataId;
                if (wikidataId)
                  await dependencies.pointOfInterest.linkWikidata({ poiId, wikidataId });
                onProgress?.("Checking POI types.");
                const types = await dependencies.poiTypes.refresh(poiId);
                if (types.error) throw new Error(types.error);
                if (types.types.length) {
                  try {
                    onProgress?.("Matching new types to visitor categories.");
                    const { cities } = await dependencies.typeMappings.classify(
                      ai,
                      types.types.map((type) => type.id),
                    );
                    onCategoriesChanged?.(cities);
                  } catch (error) {
                    console.warn(`[poi-categories] Classification failed for ${poiId}.`, error);
                    issues.push({
                      stage: "poiTypeMappings",
                      label: "POI Type Mappings",
                      message: error instanceof Error ? error.message : String(error),
                    });
                    onProgress?.(
                      "Some category mappings remain unmapped; continuing Story generation.",
                    );
                  }
                }
                if (types.skipped) onProgress?.("Skipping POI types: no Wikidata ID.");
              } catch (error) {
                console.warn(`[poi-types] Refresh failed for ${poiId}.`, error);
                issues.push({
                  stage: "poiTypes",
                  label: "POI Types",
                  message: error instanceof Error ? error.message : String(error),
                });
                onProgress?.("POI Types could not be refreshed; continuing.");
              }
            },
          });
          if (result.mainImageCandidates === "failed") {
            issues.push({
              stage: "mainImageCandidates",
              label: "Main Image Candidates",
              message:
                result.mainImageCandidatesError ?? "Main Image Candidates generation failed.",
            });
          }
          issues.push(
            ...result.relatedPeopleFailures.map(({ name, message }) => ({
              stage: "relatedPeople",
              label: "Related People",
              name,
              message,
            })),
          );
          return {
            poiId,
            issues,
            relatedPeopleFailureCount: result.relatedPeopleFailures.length,
          };
        });
      },
      ({ poiId, issues, relatedPeopleFailureCount }) => ({
        poiId,
        status: issues.length ? "partial" : "success",
        failedSteps: [...new Set(issues.map(({ stage }) => stage))],
        relatedPeopleFailureCount,
        errors: issues.map(({ stage, name, message }) => ({ stage, name, message })),
      }),
    );
    const failedSteps = [...new Set(issues.map(({ label }) => label))];
    return issues.length
      ? {
          failedSteps,
          warning:
            failedSteps.length === 1 && failedSteps[0] === "POI Type Mappings"
              ? {
                  title: "Story generated; some category mappings remain unmapped",
                  description: "Retry classification from Type mappings.",
                  details: issues[0].message,
                }
              : {
                  title: "Draft generated with issues",
                  description: `Failed steps: ${failedSteps.join(", ")}.`,
                },
        }
      : undefined;
  };

export const generateDraftStory = createDraftStoryGeneration();
