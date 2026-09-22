import type { AdminArtifact } from "../../lib/types";
import { ArtifactViewButton } from "./ArtifactViewButton";
import type { SelectedPanel } from "./Preview";

export const GlobalArtifacts = ({
  artifacts,
  onSelectPanel,
}: {
  artifacts: AdminArtifact[];
  onSelectPanel: (panel: SelectedPanel) => void;
}) =>
  artifacts.length > 0 ? (
    <div className="border-b border-amber-200 bg-amber-50 px-4 py-3">
      <div className="flex flex-wrap items-center gap-3">
        <p className="text-xs font-semibold tracking-[0.08em] text-amber-950 uppercase">
          Shared artifacts
        </p>
        <div className="flex min-w-0 flex-1 flex-wrap gap-2">
          {artifacts.map((artifact) => (
            <div
              key={artifact.path}
              className="flex min-w-0 items-center gap-2 rounded-md border border-amber-200 bg-white px-2.5 py-2"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className="truncate text-[0.6875rem] font-semibold text-black/75">
                    {artifact.label}
                  </p>
                  <span
                    className={
                      artifact.versioned
                        ? "rounded bg-emerald-100 px-1.5 py-0.5 text-[0.5625rem] font-medium text-emerald-800"
                        : "rounded bg-gray-200 px-1.5 py-0.5 text-[0.5625rem] font-medium text-gray-600"
                    }
                  >
                    {artifact.versioned ? "Versioned" : "Gitignored"}
                  </span>
                </div>
                <p className="mt-0.5 max-w-72 truncate font-mono text-[0.625rem] text-black/40">
                  {artifact.path}
                </p>
              </div>
              <ArtifactViewButton artifact={artifact} onSelectPanel={onSelectPanel} />
            </div>
          ))}
        </div>
      </div>
    </div>
  ) : null;
