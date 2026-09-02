const DEFAULT_LABEL = "General";

export function specLabel(spec) {
  const value = String(spec?.label || "").trim();
  return value || DEFAULT_LABEL;
}

export function uniqueLabels(specs) {
  const seen = new Set();
  const labels = [];
  (specs || []).forEach((spec) => {
    const label = specLabel(spec);
    const key = label.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      labels.push(label);
    }
  });
  return labels.sort((left, right) => left.localeCompare(right, undefined, { sensitivity: "base" }));
}

export default function LabelField({
  value,
  onChange,
  suggestions = [],
  id = "spec-label",
  hint,
  onKeyDown
}) {
  const typed = String(value || "").trim().toLowerCase();
  const matches = suggestions.filter((item) => {
    if (!typed) {
      return true;
    }
    return item.toLowerCase().includes(typed) && item.toLowerCase() !== typed;
  });

  return (
    <div className="field">
      <label htmlFor={id}>Label</label>
      <input
        id={id}
        value={value}
        list={`${id}-options`}
        autoComplete="off"
        placeholder={DEFAULT_LABEL}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={onKeyDown}
      />
      <datalist id={`${id}-options`}>
        {suggestions.map((item) => (
          <option key={item} value={item} />
        ))}
      </datalist>
      {matches.length ? (
        <div className="label-suggest" role="listbox" aria-label="Previously used labels">
          {matches.slice(0, 8).map((item) => (
            <button
              type="button"
              className="label-chip"
              key={item}
              onClick={() => onChange(item)}
            >
              {item}
            </button>
          ))}
        </div>
      ) : (
        <div className="hint">
          {hint || `Leave blank to use ${DEFAULT_LABEL}. Previously used labels appear as you type.`}
        </div>
      )}
    </div>
  );
}

export { DEFAULT_LABEL };
