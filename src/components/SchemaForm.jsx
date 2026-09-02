import { useMemo, useState } from "react";
import { coerce, getPath, humanize, inputType, sampleFromSchema, schemaType, setPath } from "../schema";

export default function SchemaForm({ schema, value, onChange, filter = "" }) {
  const fallback = useMemo(() => sampleFromSchema(schema, "", { emptyArrays: true }), [schema]);
  const current = value == null ? fallback : value;
  return (
    <div className="schema-form">
      <SchemaNode
        schema={schema || { type: "object" }}
        path={[]}
        label="Body"
        value={current}
        onChange={onChange}
        filter={filter.trim()}
      />
    </div>
  );
}

function SchemaNode({ schema, path, label, value, onChange, filter }) {
  const type = schemaType(schema);
  const childFilter = filter && nodeSelfMatches(label, schema, filter) ? "" : filter;
  if (type === "object" && schema && schema.properties) {
    const requiredFields = new Set(schema.required || []);
    const entries = Object.entries(schema.properties).filter(([name, property]) =>
      nodeMatches(name, property, childFilter)
    );
    const scalars = entries.filter(([, property]) => isScalar(property));
    const nested = entries.filter(([, property]) => !isScalar(property));
    const requiredScalars = scalars.filter(([name]) => requiredFields.has(name));
    const optionalScalars = scalars.filter(([name]) => !requiredFields.has(name));

    function renderFields(list) {
      return list.map(([name, property]) => (
        <SchemaField
          key={name}
          schema={property}
          path={path.concat(name)}
          name={name}
          required={requiredFields.has(name)}
          value={value}
          onChange={onChange}
          filter={childFilter}
        />
      ));
    }

    if (!entries.length) {
      return childFilter ? <div className="empty">No fields match.</div> : null;
    }

    return (
      <div className={path.length ? "schema-object" : undefined}>
        {requiredScalars.length ? renderFields(requiredScalars) : null}
        {optionalScalars.length ? renderFields(optionalScalars) : null}
        {nested.map(([name, property]) => (
          <SchemaField
            key={name}
            schema={property}
            path={path.concat(name)}
            name={name}
            required={requiredFields.has(name)}
            value={value}
            onChange={onChange}
            filter={childFilter}
          />
        ))}
      </div>
    );
  }
  if (type === "array") {
    return <ArrayField schema={schema} path={path} label={label} value={value} onChange={onChange} filter={childFilter} />;
  }
  return (
    <SchemaField
      schema={schema}
      path={path}
      name={label}
      required={false}
      value={value}
      onChange={onChange}
      filter={filter}
    />
  );
}

function ArrayField({ schema, path, label, value, onChange, filter }) {
  const items = getPath(value, path) || [];
  const itemSchema = schema.items || { type: "string" };
  return (
    <div className="schema-array">
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
            schema={itemSchema}
            path={path.concat(index)}
            label={label}
            value={value}
            onChange={onChange}
            filter={filter}
          />
        </div>
      ))}
      <button
        type="button"
        className="btn"
        onClick={() => {
          onChange(setPath(value, path, [
            ...items,
            sampleFromSchema(itemSchema, label, { emptyArrays: true })
          ]));
        }}
      >
        Add item
      </button>
      {!items.length ? <div className="hint">No items yet. Add one, or fill sample nested data.</div> : null}
    </div>
  );
}

function SchemaField({ schema, path, name, required, value, onChange, filter }) {
  const type = schemaType(schema);
  if (type === "object" && schema.properties) {
    return (
      <NestedFold
        name={name}
        required={required}
        summary={`${Object.keys(schema.properties).length} fields`}
        forceOpen={Boolean(filter)}
      >
        <SchemaNode schema={schema} path={path} label={name} value={value} onChange={onChange} filter={filter} />
      </NestedFold>
    );
  }
  if (type === "array") {
    const items = getPath(value, path) || [];
    return (
      <NestedFold
        name={name}
        required={required}
        summary={`${items.length} item${items.length === 1 ? "" : "s"}`}
        forceOpen={Boolean(filter)}
      >
        <ArrayField schema={schema} path={path} label={name} value={value} onChange={onChange} filter={filter} />
      </NestedFold>
    );
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

function NestedFold({ name, required, summary, forceOpen, children }) {
  const [open, setOpen] = useState(false);
  const show = forceOpen || open;
  return (
    <div className="schema-fold">
      <button
        type="button"
        className="schema-fold-toggle"
        aria-expanded={show}
        onClick={() => setOpen((current) => !current)}
      >
        <span className="tag-caret">{show ? "▾" : "▸"}</span>
        <span>{humanize(name)}</span>
        {required ? <span className="req">*</span> : null}
        <span className="hint">{summary}</span>
      </button>
      {show ? <div className="schema-fold-body">{children}</div> : null}
    </div>
  );
}

function isScalar(schema) {
  const type = schemaType(schema);
  if (type === "array") return false;
  if (type === "object" && schema && schema.properties) return false;
  return true;
}

function nodeSelfMatches(name, schema, filter) {
  const needle = String(filter || "").trim().toLowerCase();
  if (!needle) return false;
  const haystack = `${name} ${humanize(name)} ${schema?.description || ""}`.toLowerCase();
  return haystack.includes(needle);
}

function nodeMatches(name, schema, filter) {
  const needle = String(filter || "").trim().toLowerCase();
  if (!needle) return true;
  const haystack = `${name} ${humanize(name)} ${schema?.description || ""}`.toLowerCase();
  if (haystack.includes(needle)) return true;
  const type = schemaType(schema);
  if (type === "object" && schema?.properties) {
    return Object.entries(schema.properties).some(([child, property]) => nodeMatches(child, property, filter));
  }
  if (type === "array") {
    return nodeMatches("item", schema.items || {}, filter);
  }
  return false;
}
