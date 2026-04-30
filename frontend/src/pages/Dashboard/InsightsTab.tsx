import { Card } from "@/components/Card";
import { EmptyState } from "@/components/EmptyState";

export default function InsightsTab() {
  return (
    <Card>
      <EmptyState
        title="Insights are coming soon"
        description="Aggregated trends, project allocation breakdowns, and forecasting will appear here."
      />
    </Card>
  );
}
