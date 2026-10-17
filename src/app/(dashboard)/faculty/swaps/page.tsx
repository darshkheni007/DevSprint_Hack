import { requirePageRole } from "@/lib/guard";
import {
  listIncomingSwaps,
  listMyPublishedSlots,
  listOutgoingSwaps,
  listPeerPublishedSlots,
} from "@/lib/services/swap-service";
import { Badge, Card, EmptyState, PageHeader, StatCard } from "@/components/ui";
import { CancelSwapForm, CreateSwapForm, SwapDecisionForm } from "@/components/forms";

const STATUS_TONE: Record<string, "success" | "warn" | "danger" | "info" | "neutral"> = {
  PENDING: "warn",
  ACCEPTED: "info",
  FINALIZED: "success",
  REJECTED: "neutral",
  CANCELLED: "neutral",
  FAILED: "danger",
};

function formatWhen(value: Date | null): string {
  if (!value) return "—";
  return value.toISOString().slice(0, 16).replace("T", " ");
}

export default async function FacultySwapsPage() {
  const actor = await requirePageRole("FACULTY");
  const [mySlots, peerSlots, outgoing, incoming] = await Promise.all([
    listMyPublishedSlots(actor),
    listPeerPublishedSlots(actor),
    listOutgoingSwaps(actor),
    listIncomingSwaps(actor),
  ]);

  const pendingIncoming = incoming.filter((r) => r.status === "PENDING");

  return (
    <>
      <PageHeader
        title="Lecture swaps"
        description="Exchange the time of two published lectures with another faculty member. Nothing changes until both of you agree."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="My lectures" value={mySlots.length} icon="calendar" />
        <StatCard
          label="Awaiting my decision"
          value={pendingIncoming.length}
          icon="inbox"
          tone={pendingIncoming.length > 0 ? "warn" : "neutral"}
        />
        <StatCard label="My requests" value={outgoing.length} icon="refresh" tone="neutral" />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card title="Request a swap">
          {mySlots.length === 0 || peerSlots.length === 0 ? (
            <EmptyState
              title="No swappable lectures"
              description="You need at least one published lecture of your own and another faculty member's published lecture."
              icon="refresh"
            />
          ) : (
            <CreateSwapForm
              mySlots={mySlots.map((s) => ({ value: s.id, label: s.label }))}
              peerSlots={peerSlots.map((s) => ({ value: s.id, label: s.label }))}
            />
          )}
        </Card>

        <Card title="Requests to decide">
          {pendingIncoming.length === 0 ? (
            <EmptyState
              title="Nothing waiting"
              description="Swap requests sent to you by other faculty appear here."
              icon="inbox"
            />
          ) : (
            <ul className="space-y-4">
              {pendingIncoming.map((r) => (
                <li key={r.id} className="rounded-lg border border-ink-100 p-3">
                  <p className="text-sm text-ink-700">
                    <span className="font-semibold">{r.requesterName}</span> wants to swap their
                    lecture with yours.
                  </p>
                  <dl className="mt-2 space-y-1 text-xs text-ink-500">
                    <div>
                      <dt className="inline font-medium text-ink-600">Theirs: </dt>
                      <dd className="inline">{r.requesterSlot.label}</dd>
                    </div>
                    <div>
                      <dt className="inline font-medium text-ink-600">Yours: </dt>
                      <dd className="inline">{r.recipientSlot.label}</dd>
                    </div>
                    {r.reason ? (
                      <div>
                        <dt className="inline font-medium text-ink-600">Reason: </dt>
                        <dd className="inline">{r.reason}</dd>
                      </div>
                    ) : null}
                  </dl>
                  <div className="mt-3">
                    <SwapDecisionForm requestId={r.id} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card title="My requests">
          {outgoing.length === 0 ? (
            <EmptyState
              title="You have not requested a swap"
              description="Requests you send appear here with their current status."
              icon="refresh"
            />
          ) : (
            <ul className="space-y-3">
              {outgoing.map((r) => (
                <li key={r.id} className="rounded-lg border border-ink-100 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="text-xs text-ink-500">
                      <p>
                        <span className="font-medium text-ink-600">My lecture: </span>
                        {r.requesterSlot.label}
                      </p>
                      <p>
                        <span className="font-medium text-ink-600">With: </span>
                        {r.recipientName} — {r.recipientSlot.label}
                      </p>
                      <p className="mt-1 text-ink-400">
                        Requested {formatWhen(r.createdAt)}
                        {r.finalizedAt ? ` · applied ${formatWhen(r.finalizedAt)}` : ""}
                      </p>
                      {r.failureReason ? (
                        <p className="mt-1 text-danger-600">{r.failureReason}</p>
                      ) : null}
                    </div>
                    <Badge tone={STATUS_TONE[r.status] ?? "neutral"}>{r.status}</Badge>
                  </div>
                  {r.canCancel ? (
                    <div className="mt-2">
                      <CancelSwapForm requestId={r.id} />
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Requests I received (history)">
          {incoming.length === 0 ? (
            <EmptyState
              title="No received requests"
              description="A record of swap requests sent to you."
              icon="inbox"
            />
          ) : (
            <ul className="space-y-3">
              {incoming.map((r) => (
                <li key={r.id} className="rounded-lg border border-ink-100 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="text-xs text-ink-500">
                      <p>
                        <span className="font-medium text-ink-600">{r.requesterName}</span> offered{" "}
                        {r.requesterSlot.label}
                      </p>
                      <p>
                        <span className="font-medium text-ink-600">For my: </span>
                        {r.recipientSlot.label}
                      </p>
                      <p className="mt-1 text-ink-400">{formatWhen(r.createdAt)}</p>
                    </div>
                    <Badge tone={STATUS_TONE[r.status] ?? "neutral"}>{r.status}</Badge>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
