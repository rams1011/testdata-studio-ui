export default function EnvironmentScopeField({
  environments = [],
  value,
  onChange,
  noun = "case"
}) {
  const names = uniqueNames(environments);
  if (names.length < 2) {
    return null;
  }

  const selected = (value || []).map((item) => String(item).trim()).filter(Boolean);
  const selectValue = selected.length === 0
    ? ""
    : selected.length === 1
      ? matchName(names, selected[0]) || selected[0]
      : "__custom__";

  function choose(next) {
    if (!next || next === "__all__") {
      onChange(undefined);
      return;
    }
    if (next === "__custom__") {
      return;
    }
    onChange([next]);
  }

  const hint = selectValue === ""
    ? `This ${noun} stays in the list when you switch Environment.`
    : selectValue === "__custom__"
      ? `Shown only for ${selected.join(", ")}.`
      : `Hidden unless Environment is ${selectValue}.`;

  return (
    <div className="field">
      <label htmlFor="environment-scope">Available in</label>
      <select
        id="environment-scope"
        value={selectValue}
        onChange={(event) => choose(event.target.value)}
      >
        <option value="">Every environment</option>
        {names.map((name) => (
          <option key={name} value={name}>Only {name}</option>
        ))}
        {selectValue === "__custom__" ? (
          <option value="__custom__">{selected.join(", ")}</option>
        ) : null}
      </select>
      <div className="hint">{hint}</div>
    </div>
  );
}

function uniqueNames(environments) {
  const seen = new Set();
  const names = [];
  (environments || []).forEach((item) => {
    const name = typeof item === "string" ? item : item?.name;
    const trimmed = name && String(name).trim();
    if (!trimmed) {
      return;
    }
    const key = trimmed.toLowerCase();
    if (seen.has(key)) {
      return;
    }
    seen.add(key);
    names.push(trimmed);
  });
  return names;
}

function matchName(names, value) {
  const needle = String(value || "").trim().toLowerCase();
  return names.find((name) => name.toLowerCase() === needle) || "";
}
