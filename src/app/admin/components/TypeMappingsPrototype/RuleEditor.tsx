import { useState } from "react";
import type { PrototypeModel } from "./usePrototype";

export const RuleEditor = ({ model, type }: {model: PrototypeModel; type: PrototypeModel["types"][number]}) => {
  const [draft, setDraft] = useState(type.categories ?? []);
  return <section className="space-y-5 rounded-lg border border-gray-200 bg-white p-5">
    <div><h3 className="text-lg font-semibold text-gray-900">{type.label}</h3><p className="mt-1 text-xs text-gray-500">{type.id} · {type.status} · {type.pois.length} POIs in Rome</p></div>
    <fieldset><legend className="mb-3 text-sm font-medium text-gray-900">Assign one or several categories</legend><div className="grid gap-2 sm:grid-cols-2">{model.categories.map(category => <label key={category} className="flex cursor-pointer items-center gap-2 rounded-md border border-gray-200 p-2 text-sm text-gray-700 has-checked:border-indigo-300 has-checked:bg-indigo-50"><input className="size-4 cursor-pointer accent-indigo-600" type="checkbox" checked={draft.includes(category)} onChange={event => setDraft(event.target.checked ? [...draft, category] : draft.filter(value => value !== category))}/>{category}</label>)}</div></fieldset>
    <div className="flex flex-wrap gap-2"><button disabled={!draft.length} onClick={() => model.save(type.id,draft)} className="cursor-pointer rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-40">Save categories</button><button onClick={() => model.save(type.id,[])} className="cursor-pointer rounded-md border border-gray-300 px-3 py-2 text-sm hover:bg-gray-50">Ignore type</button><button onClick={() => model.save(type.id,undefined)} className="cursor-pointer rounded-md px-3 py-2 text-sm text-amber-800 hover:bg-amber-50">Clear rule</button></div>
    <p className="text-xs text-gray-500">Ignore assigns no categories and resolves the warning. Clear returns the type to Unmapped.</p>
    <details className="border-t border-gray-100 pt-3 text-sm"><summary className="cursor-pointer font-medium text-gray-700">Affected POIs ({type.pois.length})</summary><ul className="mt-2 space-y-1 text-gray-500">{type.pois.map(row => <li key={row.id}>{row.transformedPoi?.name ?? row.rawPoi?.name ?? row.id}</li>)}</ul></details>
    <p className="text-xs text-gray-400">Draft: {draft.join(", ") || "No categories selected"}</p>
  </section>;
};
