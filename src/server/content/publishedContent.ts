// Adapted from Papidev/historical-explorer-backend, commit 2b7b203cb2ba35dadd5a36d6b0ea6eb1bf971b1d.
import { z } from "zod";
import { personContentSchema } from "./personContent";
import { parseStoryContent, storyContentSchema } from "./storyContent";

export const publishedSourceSchema = z
  .object({
    id: z.string().trim().min(1),
    kind: z.literal("wikipedia"),
    language: z.string().regex(/^[a-z][a-z0-9-]*$/),
    pageId: z.number().int().positive(),
    title: z.string().trim().min(1),
    url: z.url(),
    revisionId: z.number().int().positive(),
    acquiredAt: z.iso.datetime(),
  })
  .strict()
  .refine(
    ({ language, pageId, url }) => {
      const reference = URL.parse(url);
      return (
        reference !== null &&
        reference.protocol === "https:" &&
        reference.hostname === `${language}.wikipedia.org` &&
        (reference.pathname.startsWith("/wiki/") ||
          reference.searchParams.get("curid") === String(pageId))
      );
    },
    { message: "A published Source must link to its Wikipedia edition." },
  );

const sourcesSchema = z
  .array(publishedSourceSchema)
  .min(1)
  .refine((sources) => new Set(sources.map(({ id }) => id)).size === sources.length, {
    message: "Published Source IDs must be unique within their owner.",
  });

export const publishedImageSchema = z
  .object({
    id: z.string().trim().min(1),
    commonsPageUrl: z.url(),
    thumbnailUrl: z.url(),
    originalImageUrl: z.url(),
    license: z.string().trim().min(1),
    attribution: z.string().trim().min(1),
    author: z.string().trim().min(1).optional(),
    width: z.number().int().positive().optional(),
    height: z.number().int().positive().optional(),
  })
  .strict()
  .refine(
    ({ license, attribution, width, height }) =>
      Boolean(
        width !== 0 &&
        height !== 0 &&
        attribution &&
        license &&
        (/^CC0(?: 1\.0)?$/i.test(license) ||
          /^Public domain$/i.test(license) ||
          /^CC BY(?:-SA)? [1-9]\d*(?:\.\d+)?(?: [a-z]{2,3})?$/i.test(license)),
      ),
    {
      message: "A published image must have an allowed license and attribution.",
    },
  );

export const publishedPoiSummarySchema = z
  .object({
    id: z.uuid().toLowerCase(),
    city: z.string().regex(/^[a-z0-9][a-z0-9-]*$/),
    name: z.string().trim().min(1),
    coordinates: z
      .object({
        lat: z.number().min(-90).max(90),
        lng: z.number().min(-180).max(180),
      })
      .strict(),
    categoryIds: z
      .array(z.string().trim().min(1))
      .refine((ids) => new Set(ids).size === ids.length, {
        message: "POI category IDs must be unique.",
      }),
  })
  .strict();

export const publishedCategorySchema = z
  .object({
    id: z.string().trim().min(1),
    name: z.string().trim().min(1),
    label: z.string().optional(),
    parentId: z.string().trim().min(1).optional(),
  })
  .strict();

export const publishedCityMapSchema = z
  .object({
    city: publishedPoiSummarySchema.shape.city,
    categoryDefinitions: z.array(publishedCategorySchema),
    pois: z.array(publishedPoiSummarySchema),
  })
  .strict()
  .superRefine(({ city, categoryDefinitions, pois }, context) => {
    const categories = new Map(categoryDefinitions.map((category) => [category.id, category]));
    if (categories.size !== categoryDefinitions.length)
      context.addIssue({
        code: "custom",
        path: ["categoryDefinitions"],
        message: "Duplicate category ID.",
      });
    for (const [index, category] of categoryDefinitions.entries()) {
      const visited = new Set([category.id]);
      let parentId = category.parentId;
      while (parentId) {
        if (!categories.has(parentId) || visited.has(parentId)) {
          context.addIssue({
            code: "custom",
            path: ["categoryDefinitions", index, "parentId"],
            message: "Category hierarchy must reference existing parents without cycles.",
          });
          break;
        }
        visited.add(parentId);
        parentId = categories.get(parentId)?.parentId;
      }
    }
    if (new Set(pois.map(({ id }) => id)).size !== pois.length)
      context.addIssue({ code: "custom", path: ["pois"], message: "Duplicate POI ID." });
    for (const [index, poi] of pois.entries()) {
      if (poi.city !== city)
        context.addIssue({
          code: "custom",
          path: ["pois", index, "city"],
          message: "POI belongs to another city.",
        });
      if (poi.categoryIds.some((id) => !categories.has(id)))
        context.addIssue({
          code: "custom",
          path: ["pois", index, "categoryIds"],
          message: "Unknown category.",
        });
    }
  });

export const publishedPoiDetailSchema = publishedPoiSummarySchema
  .extend({
    publicationId: z.uuid().toLowerCase(),
    publishedAt: z.iso.datetime(),
    story: storyContentSchema.extend({
      relatedPeople: z
        .array(storyContentSchema.shape.relatedPeople.element.required())
        .max(10)
        .refine(
          (people) => new Set(people.map(({ personId }) => personId)).size === people.length,
          { message: "A Story cannot link the same Person more than once." },
        ),
    }),
    sources: sourcesSchema,
    gallery: z.array(publishedImageSchema),
    mainImageId: z.string().trim().min(1).nullable(),
  })
  .superRefine(({ story, sources, gallery, mainImageId }, context) => {
    try {
      parseStoryContent(
        story,
        sources.map(({ id }) => id),
      );
    } catch (error) {
      context.addIssue({
        code: "custom",
        path: ["story"],
        message: error instanceof Error ? error.message : "Invalid published Story.",
      });
    }
    if (new Set(gallery.map(({ id }) => id.toLowerCase())).size !== gallery.length)
      context.addIssue({ code: "custom", path: ["gallery"], message: "Duplicate gallery image." });
    if (gallery.length ? !gallery.some(({ id }) => id === mainImageId) : mainImageId !== null)
      context.addIssue({
        code: "custom",
        path: ["mainImageId"],
        message: "Select a gallery image, or use null for an empty gallery.",
      });
  });

export const publishedPersonSchema = z
  .object({
    id: z.string().trim().min(1),
    name: z.string().trim().min(1),
    textFormat: z.literal("markdown"),
    content: personContentSchema,
    sources: sourcesSchema,
    linkedPois: z
      .array(publishedPoiSummarySchema)
      .min(1)
      .refine((pois) => new Set(pois.map(({ id }) => id)).size === pois.length, {
        message: "Duplicate linked POI.",
      }),
    updatedAt: z.iso.datetime(),
  })
  .strict()
  .superRefine(({ content, sources }, context) => {
    const knownIds = new Set(sources.map(({ id }) => id));
    for (const field of ["description", "curiosities"] as const) {
      for (const [index, block] of content[field].entries()) {
        if (block.sourceIds.some((id) => !knownIds.has(id)))
          context.addIssue({
            code: "custom",
            path: ["content", field, index, "sourceIds"],
            message: "Person content references an unknown Source.",
          });
      }
    }
  });

export type PublishedSource = z.infer<typeof publishedSourceSchema>;
export type PublishedImage = z.infer<typeof publishedImageSchema>;
export type PublishedPoiSummary = z.infer<typeof publishedPoiSummarySchema>;
export type PublishedCategory = z.infer<typeof publishedCategorySchema>;
export type PublishedCityMap = z.infer<typeof publishedCityMapSchema>;
export type PublishedPoiDetail = z.infer<typeof publishedPoiDetailSchema>;
export type PublishedPerson = z.infer<typeof publishedPersonSchema>;
