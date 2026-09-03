import {
  COMPARE_BODY_FIELDS,
  compareFieldLabel,
  prettyJson,
  snapshotLabel
} from "../runHistory";

function FieldValue({ value }) {
  const shown = prettyJson(value);
  if (!shown) {
    return <span className="hint">—</span>;
  }
  if (shown.includes("\n") || shown.length > 80) {
    return <pre className="json-preview compare-pre">{shown}</pre>;
  }
  return <code>{shown}</code>;
}

export default function RunComparePanel({ compare, onClear }) {
  if (!compare?.left || !compare?.right) {
    return null;
  }
  const differences = compare.differences || [];
  const scalars = differences.filter((item) => !COMPARE_BODY_FIELDS.has(item.field));
  const bodies = differences.filter((item) => COMPARE_BODY_FIELDS.has(item.field));
  const changed = differences.filter((item) => !item.same).length;

  return (
    <div className="card" style={{ marginTop: 16 }}>
      <div className="array-toolbar">
        <div>
          <h3 style={{ margin: 0 }}>Compare</h3>
          <p className="hint" style={{ margin: "6px 0 0" }}>
            {changed ? `${changed} field${changed === 1 ? "" : "s"} differ` : "These snapshots match"}
          </p>
        </div>
        {onClear ? (
          <button type="button" className="btn ghost" onClick={onClear}>Clear compare</button>
        ) : null}
      </div>
      <div className="compare-heads">
        <div>
          <span className="hint">Left</span>
          <strong>{snapshotLabel(compare.left)}</strong>
        </div>
        <div>
          <span className="hint">Right</span>
          <strong>{snapshotLabel(compare.right)}</strong>
        </div>
      </div>
      <table className="table">
        <thead>
          <tr>
            {["Field", "Left", "Right"].map((text) => <th key={text}>{text}</th>)}
          </tr>
        </thead>
        <tbody>
          {scalars.map((item) => (
            <tr key={item.field} className={item.same ? "" : "compare-diff"}>
              <td>{compareFieldLabel(item.field)}</td>
              <td><FieldValue value={item.left} /></td>
              <td><FieldValue value={item.right} /></td>
            </tr>
          ))}
        </tbody>
      </table>
      {bodies.map((item) => (
        <div key={item.field} className="compare-body-block">
          <h3>{compareFieldLabel(item.field)}{item.same ? "" : " · differ"}</h3>
          <div className={`compare-grid ${item.same ? "" : "compare-diff-wrap"}`}>
            <pre className="json-preview compare-pre">{prettyJson(item.left) || "—"}</pre>
            <pre className="json-preview compare-pre">{prettyJson(item.right) || "—"}</pre>
          </div>
        </div>
      ))}
    </div>
  );
}
