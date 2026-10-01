import { describe, expect, it } from "vitest";
import { getPersonDisplayName } from "./getPersonDisplayName";

describe("Person display names", () => {
  it.each([
    ["Decimus Junius Brutus Scaeva (consul 292)", "Decimus Junius Brutus Scaeva"],
    ["John Smith (architect)", "John Smith"],
    ["Pope Innocent X", "Pope Innocent X"],
    ["John (Jack) Smith", "John (Jack) Smith"],
  ])("shows %s as %s", (title, name) => {
    expect(getPersonDisplayName(title)).toBe(name);
  });
});
