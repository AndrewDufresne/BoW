import { Card } from "@/components/Card";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/Button";
import { EmptyState } from "@/components/EmptyState";
import { toast } from "@/components/Toast";

export default function ReportsPage() {
  return (
    <>
      <PageHeader
        title="Reports"
        subtitle="Insights and dashboards for Book of Work data."
      />
      <Card>
        <EmptyState
          title="Reports are coming soon"
          description="This area will host filters, charts, and exports for submissions across teams, projects, and months."
          icon={
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 3v18h18" />
              <path d="M7 14l4-4 3 3 5-6" />
            </svg>
          }
          action={
            <Button
              variant="ghost"
              onClick={() => toast.info("Thanks — we'll keep you posted.")}
            >
              Notify me when ready
            </Button>
          }
        />
      </Card>
    </>
  );
}
