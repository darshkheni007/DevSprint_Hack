const DATE_FMT = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

const DATETIME_FMT = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export function formatDate(value: Date | string): string {
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "—";
  return DATE_FMT.format(d);
}

export function formatDateTime(value: Date | string): string {
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "—";
  return DATETIME_FMT.format(d);
}

export function relativeTime(value: Date | string): string {
  const d = typeof value === "string" ? new Date(value) : value;
  const diff = Date.now() - d.getTime();
  const mins = Math.round(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  return formatDate(d);
}

export function statusTone(status: string): "success" | "warn" | "danger" | "info" | "neutral" {
  switch (status) {
    case "APPROVED":
    case "RESOLVED":
    case "RETURNED":
    case "PUBLISHED":
      return "success";
    case "IN_REVIEW":
    case "GENERATED":
    case "BORROWED":
      return "info";
    case "OVERDUE":
    case "REJECTED":
      return "danger";
    case "DRAFT":
      return "neutral";
    default:
      return "neutral";
  }
}
