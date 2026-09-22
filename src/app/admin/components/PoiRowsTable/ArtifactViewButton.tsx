import { CodeBracketSquareIcon } from "@heroicons/react/20/solid";
import { IconButton } from "@/app/components/ui/IconButton";
import type { AdminArtifact } from "../../lib/types";
import type { SelectedPanel } from "./Preview";

export const ArtifactViewButton = ({
  artifact,
  onSelectPanel,
  disabled = false,
}: {
  artifact: AdminArtifact;
  onSelectPanel: (panel: SelectedPanel) => void;
  disabled?: boolean;
}) => (
  <IconButton
    label={`View ${artifact.label}`}
    size="small"
    disabled={disabled}
    onClick={() =>
      onSelectPanel({
        title: artifact.label,
        kind: "text",
        content: artifact.content,
      })
    }
  >
    <CodeBracketSquareIcon />
  </IconButton>
);
