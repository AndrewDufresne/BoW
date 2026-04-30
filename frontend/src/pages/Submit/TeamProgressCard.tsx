import { useTeamProgress } from "@/api/hooks";
import { Card } from "@/components/Card";

interface Props {
  month: string;
}

export function TeamProgressCard({ month }: Props) {
  const q = useTeamProgress(month);
  const data = q.data ?? [];

  const totalActive = data.reduce((s, t) => s + t.total_active, 0);
  const totalSubmitted = data.reduce((s, t) => s + t.submitted_count, 0);
  const overall = totalActive ? (totalSubmitted / totalActive) * 100 : 0;

  return (
    <Card
      title={`Team Progress — ${month}`}
      actions={
        <span className="text-sm text-ink-600 font-mono">
          {totalSubmitted}/{totalActive} ({overall.toFixed(0)}%)
        </span>
      }
      className="mb-6"
    >
      {q.isLoading ? (
        <div className="text-sm text-ink-600">Loading…</div>
      ) : data.length === 0 ? (
        <div className="text-sm text-ink-600">No active teams.</div>
      ) : (
        <div className="space-y-3">
          {data.map((t) => {
            const pct = t.completion_pct;
            const barColor =
              pct >= 100 ? "bg-success" : pct >= 50 ? "bg-warning" : "bg-danger";
            return (
              <div key={t.team_id} className="grid grid-cols-12 items-center gap-3">
                <div className="col-span-3 text-sm text-ink-900 truncate" title={t.team_name}>
                  {t.team_name}
                </div>
                <div className="col-span-7">
                  <div
                    className="h-3 bg-ink-100 rounded-sm overflow-hidden"
                    role="progressbar"
                    aria-valuenow={pct}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label={`${t.team_name} completion`}
                  >
                    <div
                      className={`h-full ${barColor} transition-[width] duration-300`}
                      style={{ width: `${Math.min(100, pct)}%` }}
                    />
                  </div>
                </div>
                <div className="col-span-2 text-right text-sm font-mono text-ink-800">
                  {t.submitted_count}/{t.total_active}{" "}
                  <span className="text-ink-600">({pct.toFixed(0)}%)</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
