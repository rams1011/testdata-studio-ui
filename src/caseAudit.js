function parseInstant(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatWhen(value) {
  const date = parseInstant(value);
  if (!date) return "";
  return date.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short"
  });
}

export function formatCaseAuditLine(item) {
  if (!item) return "";
  const updated = parseInstant(item.updatedAt);
  const created = parseInstant(item.createdAt);
  if (!updated && !created) return "";

  const updatedBy = item.updatedBy?.trim();
  const createdBy = item.createdBy?.trim();

  if (updated) {
    const when = formatWhen(item.updatedAt);
    if (updatedBy) {
      return `Last updated ${when} by ${updatedBy}`;
    }
    return `Last updated ${when}`;
  }
  if (created) {
    const when = formatWhen(item.createdAt);
    if (createdBy) {
      return `Created ${when} by ${createdBy}`;
    }
    return `Created ${when}`;
  }
  return "";
}

export function formatCaseAuditCell(item) {
  const line = formatCaseAuditLine(item);
  return line || "—";
}
