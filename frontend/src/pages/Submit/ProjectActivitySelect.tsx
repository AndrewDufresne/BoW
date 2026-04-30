import { useProjectSubProjects } from "@/api/hooks";
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

interface SubProjectModeProps extends BaseProps {
  mode: "sub-project";
  subProjectId: string;
  onChange: (subProjectId: string) => void;
}

type Props = ProjectModeProps | SubProjectModeProps;

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
  return <SubProjectDropdown {...props} />;
}

function SubProjectDropdown({ projectId, subProjectId, onChange, invalid }: SubProjectModeProps) {
  const q = useProjectSubProjects(projectId || undefined);
  return (
    <Select
      value={subProjectId}
      onChange={(e) => onChange(e.target.value)}
      disabled={!projectId || q.isLoading}
      invalid={invalid}
    >
      <option value="">{projectId ? "Select sub-project…" : "Select project first"}</option>
      {q.data?.map((s) => (
        <option key={s.id} value={s.id}>
          {s.name}
        </option>
      ))}
    </Select>
  );
}
