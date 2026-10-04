import {
  existsSync,
  readdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
  unlinkSync,
} from "node:fs";
import path from "node:path";
import { expandPoiCategorySelection, type PoiCategory } from "@/types/PoiCategory";
import type { MappingPoi, PoiTypeMapping, TypeMappingCatalog } from "@/types/PoiTypeMapping";
import type { PoiType } from "@/server/poiTypes";
import { derivePoiCategories } from "@/server/poiCategories";
import { readPoiCategoryCatalog, type PoiCategoryCatalog } from "@/server/poiCategoryCatalog";
import { sanitizePoiIdForFile } from "@/server/wikiPipeline/normalize";
import type { GeoJson } from "@/server/wikiPipeline/types";
import type { AiSelection } from "@/app/admin/lib/aiModels";
import { classifyTypes } from "./classifyTypes";

type MappingFile = {
  version: number;
  mappings: Record<string, PoiCategory[]>;
  origins?: Record<string, "manual" | "automatic">;
  reasons?: Record<string, string>;
};

export const createPoiTypeMappings = (directory = path.join(process.cwd(), "data")) => {
  const mappingPath = path.join(directory, "poi-type-category-map.json");
  const categoryPath = path.join(directory, "poi-category-catalog.json");
  const readMapping = () => JSON.parse(readFileSync(mappingPath, "utf-8")) as MappingFile;
  const readPois = () =>
    readdirSync(directory, { withFileTypes: true })
      .filter(
        (entry) =>
          entry.isDirectory() &&
          existsSync(path.join(directory, entry.name, "pois", "pois.geojson")),
      )
      .flatMap((entry) => {
        const city = entry.name;
        return (
          (
            JSON.parse(
              readFileSync(path.join(directory, city, "pois", "pois.geojson"), "utf-8"),
            ) as GeoJson
          ).features ?? []
        ).map((feature) => {
          const id = String(feature.id);
          const typesPath = path.join(
            directory,
            city,
            "generated",
            "wikidata",
            `${sanitizePoiIdForFile(id)}.json`,
          );
          return {
            id,
            city,
            name: String(feature.properties?.name ?? id),
            types:
              feature.wikidataId && existsSync(typesPath)
                ? (JSON.parse(readFileSync(typesPath, "utf-8")) as { types: PoiType[] }).types
                : [],
          };
        });
      });
  const getCatalog = (): TypeMappingCatalog => {
    const mapping = readMapping();
    const types = new Map<string, PoiTypeMapping>();
    const missingTypes: MappingPoi[] = [];
    for (const { types: poiTypes, ...poi } of readPois()) {
      if (!poiTypes.length) missingTypes.push(poi);
      for (const type of new Map(poiTypes.map((type) => [type.id, type])).values()) {
        const existing = types.get(type.id);
        if (existing) existing.pois.push(poi);
        else
          types.set(type.id, {
            ...type,
            categories: mapping.mappings[type.id],
            origin:
              mapping.origins?.[type.id] ??
              (mapping.mappings[type.id] === undefined ? undefined : "initial"),
            reason: mapping.reasons?.[type.id],
            pois: [poi],
          });
      }
    }
    return {
      version: mapping.version,
      types: [...types.values()].sort((a, b) => a.label.localeCompare(b.label, "en")),
      missingTypes,
      categories: readPoiCategoryCatalog(directory).categories,
    };
  };
  const persist = (
    mapping: MappingFile,
    categoryCatalog: PoiCategoryCatalog,
    changedTypes: string[],
    saveCategories = false,
  ) => {
    const pois = readPois();
    const affected = pois.filter((poi) => poi.types.some((type) => changedTypes.includes(type.id)));
    const cities = [...new Set((saveCategories ? pois : affected).map((poi) => poi.city))];
    const changes = [
      { file: mappingPath, content: `${JSON.stringify(mapping, null, 2)}\n` },
      ...(saveCategories
        ? [{ file: categoryPath, content: `${JSON.stringify(categoryCatalog, null, 2)}\n` }]
        : []),
      ...[...new Set(affected.map((poi) => poi.city))].map((city) => {
        const file = path.join(directory, city, "pois", "categories.json");
        const saved = existsSync(file)
          ? (JSON.parse(readFileSync(file, "utf-8")) as {
              version: number;
              pois: Record<string, PoiCategory[]>;
            })
          : { version: 1, pois: {} };
        for (const poi of affected.filter((poi) => poi.city === city))
          saved.pois[poi.id] = derivePoiCategories(
            poi.types,
            mapping.mappings,
            poi.name,
            categoryCatalog.categories,
          );
        return { file, content: `${JSON.stringify(saved, null, 2)}\n` };
      }),
    ].map((change) => ({
      ...change,
      previous: existsSync(change.file) ? readFileSync(change.file, "utf-8") : null,
    }));
    const written: typeof changes = [];
    try {
      for (const change of changes) {
        writeFileSync(`${change.file}.tmp`, change.content, "utf-8");
        renameSync(`${change.file}.tmp`, change.file);
        written.push(change);
      }
    } catch (error) {
      for (const change of written.reverse()) {
        if (change.previous === null) unlinkSync(change.file);
        else {
          writeFileSync(`${change.file}.tmp`, change.previous, "utf-8");
          renameSync(`${change.file}.tmp`, change.file);
        }
      }
      for (const change of changes)
        if (existsSync(`${change.file}.tmp`)) unlinkSync(`${change.file}.tmp`);
      throw error;
    }
    return { updatedPois: affected.length, cities };
  };
  const checkName = (name: string) => {
    if (
      typeof name !== "string" ||
      !name.trim() ||
      name.trim().length > 80 ||
      /[\n\r<>]/.test(name)
    )
      throw new Error("Use a category name of 1–80 characters.");
    return name.trim().replace(/\s+/g, " ");
  };
  return {
    getCatalog,
    save: (id: string, categories: PoiCategory[] | null) => {
      if (!/^Q[1-9]\d*$/.test(id)) throw new Error("Invalid Wikidata type ID.");
      const catalog = readPoiCategoryCatalog(directory);
      if (
        categories !== null &&
        (!Array.isArray(categories) ||
          categories.some((category) => !catalog.categories.some(({ id }) => id === category)))
      )
        throw new Error("Choose categories from the existing vocabulary.");
      if (!getCatalog().types.some((type) => type.id === id))
        throw new Error("This type is no longer present in the catalog. Reload and try again.");
      const mapping = readMapping();
      if (categories === null) delete mapping.mappings[id];
      else mapping.mappings[id] = expandPoiCategorySelection(categories, catalog.categories);
      mapping.origins = { ...mapping.origins, [id]: "manual" };
      if (mapping.reasons) delete mapping.reasons[id];
      return persist(mapping, catalog, [id]);
    },
    saveCategory: (id: string | null, rawName: string) => {
      const name = checkName(rawName);
      const catalog = readPoiCategoryCatalog(directory);
      if (
        catalog.categories.some(
          (category) => category.id !== id && category.name.toLowerCase() === name.toLowerCase(),
        )
      )
        throw new Error("A category with this name already exists.");
      if (id === null) {
        if (catalog.categories.some((category) => category.id === name))
          throw new Error("This name is already used as a category ID. Choose another name.");
        catalog.categories.push({ id: name, name });
        catalog.deletedNames = catalog.deletedNames.filter(
          (deleted) => deleted.toLowerCase() !== name.toLowerCase(),
        );
      } else {
        const category = catalog.categories.find((category) => category.id === id);
        if (!category) throw new Error("Category not found.");
        category.name = name;
        category.label = name;
      }
      return persist(readMapping(), catalog, [], true);
    },
    moveCategory: (id: string, parent: string | null) => {
      const catalog = readPoiCategoryCatalog(directory);
      const category = catalog.categories.find((category) => category.id === id);
      if (!category) throw new Error("Category not found.");
      if (parent === id) throw new Error("A category cannot contain itself.");
      if (parent !== null) {
        const target = catalog.categories.find((category) => category.id === parent);
        if (!target) throw new Error("Parent category not found.");
        if (target.parent || catalog.categories.some((child) => child.parent === id))
          throw new Error(
            "Only two category levels are supported. Move child categories to the top level first.",
          );
      }
      if ((category.parent ?? null) === parent) return { updatedPois: 0, cities: [] };
      const previousDefinitions = structuredClone(catalog.categories);
      const previousParent = category.parent;
      category.parent = parent ?? undefined;
      for (const definition of catalog.categories)
        definition.supersedes = definition.supersedes?.filter(
          (id) =>
            catalog.categories.find((category) => category.id === id)?.parent === definition.parent,
        );
      const mapping = readMapping();
      for (const [typeId, assigned] of Object.entries(mapping.mappings)) {
        const expanded = expandPoiCategorySelection(assigned, previousDefinitions);
        if (!expanded.includes(id)) continue;
        mapping.mappings[typeId] = [
          ...new Set([
            ...expanded.filter(
              (value) =>
                value !== previousParent ||
                catalog.categories.some(
                  (child) => child.parent === previousParent && expanded.includes(child.id),
                ),
            ),
            ...(parent ? [parent] : []),
          ]),
        ];
        mapping.origins = { ...mapping.origins, [typeId]: "manual" };
        if (mapping.reasons) delete mapping.reasons[typeId];
      }
      return persist(
        mapping,
        catalog,
        getCatalog().types.map((type) => type.id),
        true,
      );
    },
    deleteCategory: (id: string) => {
      const catalog = readPoiCategoryCatalog(directory);
      const deleted = catalog.categories.find((category) => category.id === id);
      if (!deleted) throw new Error("Category not found.");
      const removed = catalog.categories.filter(
        (category) => category.id === id || category.parent === id,
      );
      const removedIds = new Set(removed.map((category) => category.id));
      catalog.categories = catalog.categories
        .filter((category) => !removedIds.has(category.id))
        .map((category) => ({
          ...category,
          supersedes: category.supersedes?.filter((value) => !removedIds.has(value)),
        }));
      catalog.deletedNames = [
        ...new Set([
          ...catalog.deletedNames,
          ...removed.flatMap((category) => [
            category.id,
            category.name,
            ...(category.label ? [category.label] : []),
          ]),
        ]),
      ];
      const mapping = readMapping();
      const changed = Object.keys(mapping.mappings).filter((typeId) =>
        mapping.mappings[typeId].some((category) => removedIds.has(category)),
      );
      for (const typeId of changed) {
        const assigned = mapping.mappings[typeId];
        mapping.mappings[typeId] = assigned.filter(
          (category) =>
            !removedIds.has(category) &&
            !removed.some(
              (child) =>
                child.parent === category &&
                assigned.includes(child.id) &&
                !catalog.categories.some(
                  (sibling) => sibling.parent === category && assigned.includes(sibling.id),
                ),
            ),
        );
        if (!mapping.mappings[typeId].length) delete mapping.mappings[typeId];
        mapping.origins = { ...mapping.origins, [typeId]: "manual" };
        if (mapping.reasons) delete mapping.reasons[typeId];
      }
      return persist(
        mapping,
        catalog,
        getCatalog().types.map((type) => type.id),
        true,
      );
    },
    classify: async (ai: AiSelection, typeIds?: string[]) => {
      const candidates = getCatalog().types.filter(
        (type) =>
          type.categories === undefined &&
          type.origin !== "manual" &&
          (!typeIds || typeIds.includes(type.id)),
      );
      let classified = 0;
      let createdCategories = 0;
      const changedPois = new Set<string>();
      const cities = new Set<string>();
      for (let index = 0; index < candidates.length; index += 10) {
        const before = readPoiCategoryCatalog(directory);
        const proposed = await classifyTypes(
          candidates.slice(index, index + 10),
          before.categories,
          before.deletedNames,
          ai,
        );
        const mapping = readMapping();
        const catalog = readPoiCategoryCatalog(directory);
        const changed: string[] = [];
        const newCategoriesBefore = catalog.categories.length;
        for (const rule of proposed) {
          if (
            mapping.mappings[rule.id] !== undefined ||
            mapping.origins?.[rule.id] === "manual" ||
            rule.decision === "unmapped"
          )
            continue;
          if (
            rule.categoryIds.some(
              (id) => !catalog.categories.some((category) => category.id === id),
            )
          )
            throw new Error("Categories changed during classification. Try again.");
          const assigned = [...rule.categoryIds];
          for (const rawName of rule.newCategoryNames) {
            const name = checkName(rawName);
            if (
              catalog.deletedNames.some((deleted) => deleted.toLowerCase() === name.toLowerCase())
            )
              throw new Error("The AI proposed a deleted category. The type remains unmapped.");
            const existing = catalog.categories.find(
              (category) => category.name.toLowerCase() === name.toLowerCase(),
            );
            if (existing) assigned.push(existing.id);
            else {
              if (catalog.categories.some((category) => category.id === name))
                throw new Error("The AI proposed a category with a conflicting ID.");
              catalog.categories.push({ id: name, name });
              assigned.push(name);
            }
          }
          mapping.mappings[rule.id] = expandPoiCategorySelection(assigned, catalog.categories);
          mapping.origins = { ...mapping.origins, [rule.id]: "automatic" };
          mapping.reasons = { ...mapping.reasons, [rule.id]: rule.reason };
          changed.push(rule.id);
        }
        if (!changed.length) continue;
        const result = persist(
          mapping,
          catalog,
          changed,
          catalog.categories.length !== newCategoriesBefore,
        );
        result.cities.forEach((city) => cities.add(city));
        for (const poi of readPois().filter((poi) =>
          poi.types.some((type) => changed.includes(type.id)),
        ))
          changedPois.add(`${poi.city}/${poi.id}`);
        classified += changed.length;
        createdCategories += catalog.categories.length - newCategoriesBefore;
      }
      return { classified, createdCategories, updatedPois: changedPois.size, cities: [...cities] };
    },
  };
};
