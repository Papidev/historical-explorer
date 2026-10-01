export const getPersonDisplayName = (name: string) =>
  name.replace(/(?:\s*\([^()]*\))+\s*$/, "").trim();
