import {
  createPostgresContent,
  catalogWriteSchema,
  categoryCatalogCreateSchema,
  categoryCatalogRenameSchema,
  personUpdateSchema,
  poiCategoriesWriteSchema,
  storyWriteSchema,
  poiTypesWriteSchema,
  typeCategoryRuleWriteSchema,
} from "./postgresContent";
import { publishedCategorySchema, publishedPoiSummarySchema } from "./publishedContent";
import {
  authenticateContentRequest,
  contentErrorResponse,
  ContentHttpError,
  contentJson,
  parseContentInput,
  readContentBody,
} from "./http";
import { z } from "zod";

export const createContentHandler =
  (getRepository: () => ReturnType<typeof createPostgresContent>) =>
  async (request: Request, context: { params: Promise<{ segments: string[] }> }) => {
    try {
      authenticateContentRequest(request);
      const { segments } = await context.params;
      const [resource, identity, action] = segments;
      if (resource === "type-rules" && segments.length === 1) {
        if (request.method === "GET")
          return contentJson(await getRepository().getTypeCategoryRules());
        if (request.method !== "PUT")
          return contentJson(
            { error: { code: "invalid", message: "This method is not supported." } },
            405,
            { Allow: "GET, PUT" },
          );
        const input = parseContentInput(
          typeCategoryRuleWriteSchema,
          await readContentBody(request),
        );
        return contentJson(await getRepository().saveTypeCategoryRule(input));
      }
      if (resource === "categories" && segments.length === 2) {
        if (request.method !== "PUT")
          return contentJson(
            { error: { code: "invalid", message: "This method is not supported." } },
            405,
            { Allow: "PUT" },
          );
        const input = parseContentInput(
          categoryCatalogRenameSchema.omit({ id: true }),
          await readContentBody(request),
        );
        const id = parseContentInput(publishedCategorySchema.shape.id, identity);
        return contentJson(await getRepository().renameCategory({ ...input, id }));
      }
      if (resource === "categories" && segments.length === 1) {
        if (request.method === "GET")
          return contentJson(await getRepository().getCategoryCatalog());
        if (request.method !== "PUT")
          return contentJson(
            { error: { code: "invalid", message: "This method is not supported." } },
            405,
            { Allow: "GET, PUT" },
          );
        const input = parseContentInput(
          categoryCatalogCreateSchema,
          await readContentBody(request),
        );
        return contentJson(await getRepository().createCategory(input));
      }
      if (resource === "catalogs" && segments.length === 3 && action === "types") {
        if (request.method !== "GET")
          return contentJson(
            { error: { code: "invalid", message: "This method is not supported." } },
            405,
            { Allow: "GET" },
          );
        const city = parseContentInput(publishedPoiSummarySchema.shape.city, identity);
        return contentJson(await getRepository().getCityPoiTypes(city));
      }
      const catalog = resource === "catalogs" && segments.length === 2;
      const poi =
        resource === "pois" &&
        segments.length === 3 &&
        ["story", "baseline", "categories", "categories-baseline", "types"].includes(action);
      const person =
        resource === "people" &&
        (segments.length === 2 || (segments.length === 3 && action === "baseline"));
      if (!catalog && !poi && !person)
        throw new ContentHttpError(
          404,
          "not-found",
          "The requested content endpoint does not exist.",
        );
      const allow =
        poi && action === "types"
          ? "GET, PUT"
          : catalog
            ? "GET, PUT"
            : ["baseline", "categories-baseline"].includes(action)
              ? "GET"
              : "PUT";
      if (!allow.split(", ").includes(request.method))
        return contentJson(
          { error: { code: "invalid", message: "This method is not supported." } },
          405,
          { Allow: allow },
        );
      const id = parseContentInput(
        catalog
          ? publishedPoiSummarySchema.shape.city
          : poi
            ? z.uuid().toLowerCase()
            : z.string().min(1),
        identity,
      );
      if (request.method === "GET") {
        const repository = getRepository();
        const result = catalog
          ? await repository.getCatalogBaseline(id)
          : poi
            ? action === "types"
              ? await repository.getPoiTypes(id)
              : action === "categories-baseline"
                ? await repository.getPoiCategoriesBaseline(id)
                : await repository.getPoiBaseline(id)
            : await repository.getPersonBaseline(id);
        if (!result)
          throw new ContentHttpError(404, "not-found", "The requested baseline does not exist.");
        return contentJson(result);
      }
      const body = await readContentBody(request);
      if (catalog) {
        const input = parseContentInput(catalogWriteSchema, body);
        if (input.city !== id)
          throw new ContentHttpError(400, "invalid", "Route and body identities must match.");
        return contentJson({ status: await getRepository().synchronizeCatalog(input) });
      }
      if (poi && action === "types") {
        const input = parseContentInput(poiTypesWriteSchema, body);
        if (input.poiId !== id)
          throw new ContentHttpError(400, "invalid", "Route and body identities must match.");
        return contentJson(await getRepository().savePoiTypes(input));
      }
      if (poi && action === "categories") {
        const input = parseContentInput(poiCategoriesWriteSchema, body);
        if (input.poiId !== id)
          throw new ContentHttpError(400, "invalid", "Route and body identities must match.");
        return contentJson(await getRepository().savePoiCategories(input));
      }
      if (poi) {
        const input = parseContentInput(storyWriteSchema, body);
        if (input.detail.id !== id)
          throw new ContentHttpError(400, "invalid", "Route and body identities must match.");
        return contentJson({ status: await getRepository().saveStory(input) });
      }
      const input = parseContentInput(personUpdateSchema, body);
      if (input.person.id !== id)
        throw new ContentHttpError(400, "invalid", "Route and body identities must match.");
      return contentJson({ status: await getRepository().savePerson(input) });
    } catch (error) {
      return contentErrorResponse(error);
    }
  };
