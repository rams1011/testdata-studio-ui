import { formatCaseAuditLine } from "../caseAudit";

export default function CaseAuditMeta({ testCase, className = "hint case-audit" }) {
  const line = formatCaseAuditLine(testCase);
  if (!line) {
    return null;
  }
  return <p className={className}>{line}</p>;
}
