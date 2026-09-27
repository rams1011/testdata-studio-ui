import { issueCount, jumpToValidationItem } from "../caseValidation";

export default function ValidationSummary({ groups, className = "", onJump = jumpToValidationItem }) {
  const count = issueCount(groups);
  if (!count) {
    return null;
  }

  return (
    <div className={`validation-summary ${className}`.trim()} role="status">
      <p className="validation-summary-lead">
        {count === 1 ? "1 required field missing" : `${count} required fields missing`}
      </p>
      <ul className="validation-summary-groups">
        {groups.map((group) => (
          <li key={group.id} className="validation-summary-group">
            <span className="validation-summary-group-title">{group.title}</span>
            <span className="validation-summary-chips">
              {group.items.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  className="validation-chip"
                  onClick={() => onJump(item)}
                  title={`Go to ${item.label}`}
                >
                  {item.label}
                </button>
              ))}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
