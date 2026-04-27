import { useProjectActivities } from "@/api/hooks";
import { Select } from "@/components/Form";
import type { Project } from "@/api/types";

interface BaseProps {
  projects: Project[];
  projectId: string;
  invalid?: boolean;
}

interface ProjectModeProps extends BaseProps {
  mode: "project";
  onChange: (projectId: string) => void;
}

interface ActivityModeProps extends BaseProps {
  mode: "activity";
  activityId: string;
  onChange: (activityId: string) => void;
}

type Props = ProjectModeProps | ActivityModeProps;

export function ProjectActivitySelect(props: Props) {
  if (props.mode === "project") {
    return (
      <Select
        value={props.projectId}
        onChange={(e) => props.onChange(e.target.value)}
        invalid={props.invalid}
      >
        <option value="">Select project…</option>
        {props.projects.map((p) => (
          <option key={p.id} value={p.id}>
            {p.code} · {p.name}
          </option>
        ))}
      </Select>
    );
  }
  return <ActivityDropdown {...props} />;
}

function ActivityDropdown({ projectId, activityId, onChange, invalid }: ActivityModeProps) {
  const q = useProjectActivities(projectId || undefined);
  return (
    <Select
      value={activityId}
      onChange={(e) => onChange(e.target.value)}
      disabled={!projectId || q.isLoading}
      invalid={invalid}
    >
      <option value="">{projectId ? "Select activity…" : "Select project first"}</option>
      {q.data?.map((a) => (
        <option key={a.id} value={a.id}>
          {a.name}
        </option>
      ))}
    </Select>
  );
}
