import { requirePageRole } from "@/lib/guard";
import { getRecentQueries } from "@/lib/services/ai-service";
import { describeLlm } from "@/lib/services/llm";
import { Alert, Badge, Card, EmptyState, PageHeader } from "@/components/ui";
import { AssistantForm } from "@/components/forms";
import { relativeTime } from "@/lib/format";

export default async function AssistantPage() {
  const actor = await requirePageRole("ADMIN", "FACULTY", "STUDENT");
  const [recent, llm] = await Promise.all([getRecentQueries(actor), Promise.resolve(describeLlm())]);

  return (
    <>
      <PageHeader
        title="AI assistant"
        description="Ask about your timetable, attendance, results, assignments, notices or campus information."
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card title="Ask a question">
            <AssistantForm />
          </Card>

          <div className="mt-4">
            <Alert tone="info" title="How this assistant works">
              It answers using approved campus documents and your own records, and it will refuse
              requests for another person&apos;s private data (marks, attendance, complaints or
              personal details). It never guesses.{" "}
              {llm.configured
                ? `Answers are phrased by the ${llm.provider} model (${llm.model}); if the model is unavailable, it falls back to verified stored data only.`
                : "No AI model is currently configured, so answers are composed from verified stored data only."}
            </Alert>
          </div>
        </div>

        <Card title="Your recent questions" description="Last 20 queries">
          {recent.length === 0 ? (
            <EmptyState title="No questions yet" description="Your recent questions will appear here." icon="sparkles" />
          ) : (
            <ul className="space-y-3">
              {recent.map((q) => (
                <li key={q.id} className="border-b border-ink-100 pb-3 last:border-0 last:pb-0">
                  <p className="text-sm text-ink-700">{q.question}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <Badge tone={q.answered ? "success" : "neutral"}>{q.intent}</Badge>
                    <span className="text-[11px] text-ink-400">{relativeTime(q.createdAt)}</span>
                  </div>
                  {q.sourcesUsed ? (
                    <p className="mt-1 text-[11px] text-ink-400">Source: {q.sourcesUsed}</p>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
