import { coerce, getPath, humanize, inputType, sampleFromSchema, schemaType, setPath } from "../schema";

export default function SchemaForm({ schema, value, onChange }) {
  const current = value == null ? sampleFromSchema(schema) : value;
  return (
    <div className="schema-form">
      <SchemaNode
        schema={schema || { type: "object" }}
        path={[]}
        label="Body"
        value={current}
        onChange={onChange}
      />
    </div>
  );
}

function SchemaNode({ schema, path, label, value, onChange }) {
  const type = schemaType(schema);
  if (type === "object" && schema && schema.properties) {
    const requiredFields = new Set(schema.required || []);
    return (
      <div className={path.length ? "schema-object" : undefined}>
        {path.length ? <div className="schema-label">{humanize(label)}</div> : null}
        {Object.entries(schema.properties).map(([name, property]) => (
          <SchemaField
            key={name}
            schema={property}
            path={path.concat(name)}
            name={name}
            required={requiredFields.has(name)}
            value={value}
            onChange={onChange}
          />
        ))}
      </div>
    );
  }
  if (type === "array") {
    return <ArrayField schema={schema} path={path} label={label} value={value} onChange={onChange} />;
  }
  return (
    <SchemaField
      schema={schema}
      path={path}
      name={label}
      required={false}
      value={value}
      onChange={onChange}
    />
  );
}

function ArrayField({ schema, path, label, value, onChange }) {
  const items = getPath(value, path) || [];
  return (
    <div className="schema-field">
      <div className="schema-label">{humanize(label)}</div>
      {items.map((_, index) => (
        <div className="array-item" key={index}>
          <div className="array-toolbar">
            <strong>Item {index + 1}</strong>
            <button
              type="button"
              className="btn danger"
              onClick={() => {
                const next = [...items];
                next.splice(index, 1);
                onChange(setPath(value, path, next));
              }}
            >
              Remove
            </button>
          </div>
          <SchemaNode
            schema={schema.items || { type: "string" }}
            path={path.concat(index)}
            label="value"
            value={value}
            onChange={onChange}
          />
        </div>
      ))}
      <button
        type="button"
        className="btn"
        onClick={() => {
          onChange(setPath(value, path, [...items, sampleFromSchema(schema.items || { type: "string" })]));
        }}
      >
        Add item
      </button>
    </div>
  );
}

function SchemaField({ schema, path, name, required, value, onChange }) {
  const type = schemaType(schema);
  if (type === "object" && schema.properties) {
    return <SchemaNode schema={schema} path={path} label={name} value={value} onChange={onChange} />;
  }
  if (type === "array") {
    return <ArrayField schema={schema} path={path} label={name} value={value} onChange={onChange} />;
  }

  const current = getPath(value, path);
  const displayValue = current != null && typeof current === "object" ? "" : current;
  const label = (
    <div className="schema-label">
      <span>{humanize(name)}</span>
      {required ? <span className="req">*</span> : null}
      {schema && schema.description ? <span className="hint">{schema.description}</span> : null}
    </div>
  );

  if (type === "boolean") {
    return (
      <div className="schema-field">
        {label}
        <label className="check">
          <input
            type="checkbox"
            checked={Boolean(current)}
            onChange={(event) => onChange(setPath(value, path, event.target.checked))}
          />
          Enabled
        </label>
      </div>
    );
  }

  if (type === "json" || (type === "object" && !schema.properties)) {
    return (
      <div className="schema-field">
        {label}
        <textarea
          defaultValue={current == null ? "" : JSON.stringify(current, null, 2)}
          onChange={(event) => {
            try {
              const trimmed = event.target.value.trim();
              if (!trimmed) {
                event.target.style.borderColor = "";
                onChange(setPath(value, path, schema && schema.nullable ? null : ""));
                return;
              }
              try {
                const parsed = JSON.parse(trimmed);
                event.target.style.borderColor = "";
                onChange(setPath(value, path, parsed));
              } catch {
                event.target.style.borderColor = "";
                onChange(setPath(value, path, event.target.value));
              }
            } catch {
              event.target.style.borderColor = "#a33b32";
            }
          }}
        />
      </div>
    );
  }

  if (schema && schema.enum) {
    return (
      <div className="schema-field">
        {label}
        <select
          value={displayValue ?? ""}
          onChange={(event) => onChange(setPath(value, path, coerce(event.target.value, type, schema)))}
        >
          {schema.enum.map((option) => (
            <option key={String(option)} value={String(option)}>
              {String(option)}
            </option>
          ))}
        </select>
      </div>
    );
  }

  return (
    <div className="schema-field">
      {label}
      <input
        type={inputType(schema, type)}
        step={type === "integer" ? "1" : type === "number" ? "any" : undefined}
        value={displayValue == null ? "" : displayValue}
        onChange={(event) => onChange(setPath(value, path, coerce(event.target.value, type, schema)))}
      />
    </div>
  );
}
