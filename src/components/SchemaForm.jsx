import { createContext, useContext, useMemo, useState } from "react";
import { Api } from "../api";
import ExtractValueField from "./ExtractValueField";
import { coerce, collectFileFields, emptyFromSchema, getPath, humanize, inputType, isFileRef, matchVariantIndex, schemaType, schemaVariants, setPath, typeWatermark } from "../schema";

const AllowExtractsContext = createContext(false);
const FileCommitContext = createContext(null);

export function SchemaFilePickers({ schema, value, onChange, caseId, onEnsureCase, onFileCommitted }) {
  const fields = collectFileFields(schema);
  if (!fields.length) {
    return null;
  }
  return (
    <FileCommitContext.Provider value={onFileCommitted}>
      <div className="schema-file-pickers">
        <p className="hint">
          This API sends a multipart file{fields.length === 1 ? ` as part '${fields[0].name}'` : ""}.
          Choose it here. File bytes are not JSON, so they do not appear in the JSON body.
        </p>
        {fields.map((field) => (
          <FileField
            key={field.path.join(".") || "file"}
            caseId={caseId}
            onEnsureCase={onEnsureCase}
            schema={field.schema}
            path={field.path}
            name={field.name}
            required
            value={value}
            onChange={onChange}
          />
        ))}
      </div>
    </FileCommitContext.Provider>
  );
}

export default function SchemaForm({ schema, value, onChange, filter = "", caseId, onEnsureCase, onFileCommitted, allowExtracts = false }) {
  const fallback = useMemo(() => emptyFromSchema(schema) ?? {}, [schema]);
  const current = value == null ? fallback : value;
  return (
    <FileCommitContext.Provider value={onFileCommitted}>
    <AllowExtractsContext.Provider value={allowExtracts}>
      <div className="schema-form">
        <SchemaNode
          schema={schema || { type: "object" }}
          path={[]}
          label="Body"
          value={current}
          onChange={onChange}
          filter={filter.trim()}
          caseId={caseId}
          onEnsureCase={onEnsureCase}
        />
      </div>
    </AllowExtractsContext.Provider>
    </FileCommitContext.Provider>
  );
}

function SchemaNode({ schema, path, label, value, onChange, filter, caseId, onEnsureCase }) {
  const type = schemaType(schema);
  const childFilter = filter && nodeSelfMatches(label, schema, filter) ? "" : filter;
  if ((schema?.oneOf || schema?.anyOf) && schemaVariants(schema).length) {
    return (
      <PolymorphicField
        schema={schema}
        path={path}
        label={label}
        value={value}
        onChange={onChange}
        filter={childFilter}
        caseId={caseId}
        onEnsureCase={onEnsureCase}
      />
    );
  }
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
          caseId={caseId}
          onEnsureCase={onEnsureCase}
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
            caseId={caseId}
            onEnsureCase={onEnsureCase}
          />
        ))}
      </div>
    );
  }
  if (type === "array") {
    return (
      <ArrayField
        schema={schema}
        path={path}
        label={label}
        value={value}
        onChange={onChange}
        filter={childFilter}
        caseId={caseId}
        onEnsureCase={onEnsureCase}
      />
    );
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
      caseId={caseId}
      onEnsureCase={onEnsureCase}
    />
  );
}

function ArrayField({ schema, path, label, value, onChange, filter, caseId, onEnsureCase }) {
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
            caseId={caseId}
            onEnsureCase={onEnsureCase}
          />
        </div>
      ))}
      <button
        type="button"
        className="btn"
        onClick={() => {
          const item = emptyFromSchema(itemSchema);
          onChange(setPath(value, path, [
            ...items,
            item === undefined ? "" : item
          ]));
        }}
      >
        Add item
      </button>
      {!items.length ? <div className="hint">No items yet. Add one, or fill sample nested data.</div> : null}
    </div>
  );
}

function SchemaField({ schema, path, name, required, value, onChange, filter, caseId, onEnsureCase }) {
  if (schema?.oneOf || schema?.anyOf) {
    return (
      <PolymorphicField
        schema={schema}
        path={path}
        label={name}
        required={required}
        value={value}
        onChange={onChange}
        filter={filter}
        caseId={caseId}
        onEnsureCase={onEnsureCase}
      />
    );
  }
  const type = schemaType(schema);
  if (type === "object" && schema.properties) {
    return (
      <NestedFold
        name={name}
        required={required}
        summary={`${Object.keys(schema.properties).length} fields`}
        forceOpen={Boolean(filter)}
      >
        <SchemaNode schema={schema} path={path} label={name} value={value} onChange={onChange} filter={filter} caseId={caseId} onEnsureCase={onEnsureCase} />
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
        <ArrayField schema={schema} path={path} label={name} value={value} onChange={onChange} filter={filter} caseId={caseId} onEnsureCase={onEnsureCase} />
      </NestedFold>
    );
  }
  if (type === "file") {
    return (
      <FileField
        caseId={caseId}
        onEnsureCase={onEnsureCase}
        schema={schema}
        path={path}
        name={name}
        required={required}
        value={value}
        onChange={onChange}
      />
    );
  }

  const allowExtracts = useContext(AllowExtractsContext);
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
          defaultValue={current == null || current === "" ? "" : JSON.stringify(current, null, 2)}
          placeholder={typeWatermark(schema)}
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
          <option value="">{typeWatermark(schema)}</option>
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
      {allowExtracts ? (
        <ExtractValueField
          type={inputType(schema, type)}
          step={type === "integer" ? "1" : type === "number" ? "any" : undefined}
          value={displayValue == null ? "" : displayValue}
          placeholder={typeWatermark(schema)}
          onChange={(next) => onChange(setPath(value, path, coerce(next, type, schema)))}
        />
      ) : (
        <input
          type={inputType(schema, type)}
          step={type === "integer" ? "1" : type === "number" ? "any" : undefined}
          value={displayValue == null ? "" : displayValue}
          placeholder={typeWatermark(schema)}
          onChange={(event) => onChange(setPath(value, path, coerce(event.target.value, type, schema)))}
        />
      )}
    </div>
  );
}

function FileField({ caseId, onEnsureCase, schema, path, name, required, value, onChange }) {
  const current = getPath(value, path);
  const meta = isFileRef(current) ? current : null;
  const onFileCommitted = useContext(FileCommitContext);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const label = (
    <div className="schema-label">
      <span>{humanize(name)}</span>
      {required ? <span className="req">*</span> : null}
      {schema && schema.description ? <span className="hint">{schema.description}</span> : null}
    </div>
  );

  async function pick(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) {
      return;
    }
    setBusy(true);
    setError("");
    try {
      const id = caseId || (onEnsureCase ? await onEnsureCase() : null);
      if (!id) {
        setError("Save the case before uploading a file.");
        return;
      }
      const uploaded = await Api.uploadRequestFile(id, file, name || "file");
      const next = setPath(value, path, {
        fileId: uploaded.fileId,
        testCaseId: uploaded.testCaseId || id,
        fileName: uploaded.fileName,
        contentType: uploaded.contentType,
        sizeBytes: uploaded.sizeBytes
      });
      onChange(next);
      if (onFileCommitted) {
        await onFileCommitted(next, id);
      }
    } catch (exception) {
      setError(exception.message || "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    const next = setPath(value, path, null);
    onChange(next);
    if (onFileCommitted) {
      await onFileCommitted(next, caseId);
    }
  }

  return (
    <div className="schema-field file-field">
      {label}
      {meta ? (
        <div className="file-field-meta">
          <span className="file-field-name">{meta.fileName}</span>
          {meta.sizeBytes != null ? <span className="hint">{formatSize(meta.sizeBytes)}</span> : null}
          <button
            type="button"
            className="btn"
            onClick={remove}
            disabled={busy}
          >
            Remove
          </button>
        </div>
      ) : (
        <div className="hint">No file selected. Uploads are stored on this test case.</div>
      )}
      <input type="file" onChange={pick} disabled={busy} />
      {busy ? <div className="hint">Uploading…</div> : null}
      {error ? <div className="body-json-error">{error}</div> : null}
    </div>
  );
}

function PolymorphicField({ schema, path, label, required, value, onChange, filter, caseId, onEnsureCase }) {
  const variants = schemaVariants(schema);
  const current = path.length ? getPath(value, path) : value;
  const selected = matchVariantIndex(schema, current);
  const branch = variants[selected]?.schema || { type: "object" };
  return (
    <div className="schema-object">
      <div className="schema-field">
        <div className="schema-label">
          <span>{humanize(label || "Type")}</span>
          {required ? <span className="req">*</span> : null}
          <span className="hint">oneOf / anyOf</span>
        </div>
        <select
          value={String(selected)}
          onChange={(event) => {
            const next = variants[Number(event.target.value)]?.schema || branch;
            const empty = emptyFromSchema(next);
            onChange(path.length ? setPath(value, path, empty) : empty);
          }}
        >
          {variants.map((item) => (
            <option key={item.index} value={String(item.index)}>{item.label}</option>
          ))}
        </select>
      </div>
      <SchemaNode
        schema={branch}
        path={path}
        label={label}
        value={value}
        onChange={onChange}
        filter={filter}
        caseId={caseId}
        onEnsureCase={onEnsureCase}
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
  if (type === "array" || type === "union" || schema?.oneOf || schema?.anyOf) return false;
  if (type === "object" && schema && schema.properties) return false;
  return true;
}

function formatSize(bytes) {
  const size = Number(bytes);
  if (!Number.isFinite(size) || size < 0) {
    return "";
  }
  if (size < 1024) {
    return `${size} B`;
  }
  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(1)} KB`;
  }
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
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
