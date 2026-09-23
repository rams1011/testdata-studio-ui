export function hasResponseSchema(schema) {
  if (schema == null || typeof schema !== "object" || Array.isArray(schema)) {
    return false;
  }
  if (Object.keys(schema).length === 0) {
    return false;
  }
  if (schema.properties && Object.keys(schema.properties).length > 0) {
    return true;
  }
  if (schema.items != null) {
    return true;
  }
  if ((schema.oneOf && schema.oneOf.length) || (schema.anyOf && schema.anyOf.length) || (schema.allOf && schema.allOf.length)) {
    return true;
  }
  if (schema.$ref) {
    return true;
  }
  const type = Array.isArray(schema.type)
    ? schema.type.find((item) => item !== "null")
    : schema.type;
  return type === "array" || type === "object" || type === "string" || type === "integer" || type === "number"
    || type === "boolean";
}

export function hasResponseBodySchema(response) {
  if (!response) {
    return false;
  }
  if (hasResponseSchema(response.jsonSchema)) {
    return true;
  }
  const type = String(response.responseType || "").toUpperCase();
  return type === "JSON";
}

export function isFileRef(value) {
  return value != null
    && typeof value === "object"
    && !Array.isArray(value)
    && typeof value.fileId === "string"
    && value.fileId.trim() !== "";
}

export function stripFileRefsForEditor(value) {
  if (value == null) {
    return value;
  }
  if (isFileRef(value)) {
    return {};
  }
  if (typeof value !== "object" || Array.isArray(value)) {
    return value;
  }
  const next = {};
  Object.entries(value).forEach(([key, child]) => {
    if (isFileRef(child)) {
      return;
    }
    next[key] = child;
  });
  return next;
}

export function mergeFileRefs(edited, previous) {
  const files = fileRefEntries(previous);
  if (!files.length) {
    return edited;
  }
  if (edited == null || typeof edited !== "object" || Array.isArray(edited)) {
    if (isFileRef(previous)) {
      return previous;
    }
    const next = {};
    files.forEach(({ key, value }) => {
      next[key] = value;
    });
    return next;
  }
  const next = { ...edited };
  files.forEach(({ key, value }) => {
    if (!isFileRef(next[key])) {
      next[key] = value;
    }
  });
  return next;
}

function fileRefEntries(value) {
  if (isFileRef(value)) {
    return [{ key: "file", value }];
  }
  if (value == null || typeof value !== "object" || Array.isArray(value)) {
    return [];
  }
  return Object.entries(value)
    .filter(([, child]) => isFileRef(child))
    .map(([key, child]) => ({ key, value: child }));
}

export function collectFileFields(schema, path = []) {
  if (!schema) {
    return [];
  }
  const type = schemaType(schema);
  if (type === "file") {
    return [{ path, name: path.length ? path[path.length - 1] : "file", schema }];
  }
  const fields = [];
  if ((type === "object" || type === "json") && schema.properties) {
    Object.entries(schema.properties).forEach(([key, property]) => {
      fields.push(...collectFileFields(property, [...path, key]));
    });
  }
  return fields;
}

export function schemaType(schema) {
  if (!schema) return "object";
  const format = String(schema.format || "").toLowerCase();
  if (format === "binary" || format === "byte") return "file";
  if (Array.isArray(schema.type)) {
    return schema.type.find((item) => item !== "null") || schema.type[0];
  }
  if (schema.type) return schema.type;
  if (schema.properties) return "object";
  if (schema.items) return "array";
  if (schema.enum) return "string";
  if (schema.oneOf || schema.anyOf) return "union";
  if (schema.pattern != null || schema.minLength != null || schema.maxLength != null) {
    return "string";
  }
  if (schema.format) {
    if (["int32", "int64"].includes(schema.format)) return "integer";
    if (["float", "double"].includes(schema.format)) return "number";
    return "string";
  }
  return "string";
}

export function sampleFromSchema(schema, name = "", options = {}) {
  const type = schemaType(schema);
  if (!schema) return {};
  if (schema.default !== undefined) {
    return options.emptyArrays ? emptyNestedArrays(cloneSample(schema.default)) : cloneSample(schema.default);
  }
  if (schema.example !== undefined) {
    return options.emptyArrays ? emptyNestedArrays(cloneSample(schema.example)) : cloneSample(schema.example);
  }
  if (schema.enum && schema.enum.length) return schema.enum[0];
  if (type === "file") return null;
  if (type === "object") {
    const value = {};
    Object.entries(schema.properties || {}).forEach(([propertyName, property]) => {
      value[propertyName] = sampleFromSchema(property, propertyName, options);
    });
    return value;
  }
  if (type === "array") {
    if (options.emptyArrays) {
      return [];
    }
    return schema.items ? [sampleFromSchema(schema.items, name, options)] : [];
  }
  if (type === "boolean") return true;
  if (type === "integer" || type === "number") return 0;
  if (type === "union") {
    const variants = schemaVariants(schema);
    return sampleFromSchema(variants[0]?.schema || { type: "object" }, name, options);
  }
  if (type === "json") {
    return schema.properties ? sampleFromSchema({ ...schema, type: "object" }, name, options) : "sample";
  }
  return sampleString(schema, name);
}

export function emptyFromSchema(schema) {
  const type = schemaType(schema);
  if (!schema) {
    return {};
  }
  if (type === "file") {
    return null;
  }
  if (type === "object" || (type === "json" && schema.properties)) {
    const value = {};
    Object.entries(schema.properties || {}).forEach(([propertyName, property]) => {
      const childType = schemaType(property);
      if (childType === "object" || childType === "union" || childType === "array" || childType === "json") {
        value[propertyName] = emptyFromSchema(property);
      }
    });
    return value;
  }
  if (type === "array") {
    return [];
  }
  if (type === "union") {
    const variants = schemaVariants(schema);
    return emptyFromSchema(variants[0]?.schema || { type: "object" });
  }
  return undefined;
}

export function typeWatermark(schema) {
  if (!schema) {
    return "string";
  }
  const type = schemaType(schema);
  const format = String(schema.format || "").toLowerCase();
  if (format && !["int32", "int64", "float", "double"].includes(format)) {
    return format;
  }
  if (type === "json") {
    return "json";
  }
  if (type === "union") {
    return "object";
  }
  return type || "string";
}

function emptyNestedArrays(value) {
  if (Array.isArray(value)) {
    return [];
  }
  if (value != null && typeof value === "object") {
    const next = {};
    Object.entries(value).forEach(([key, child]) => {
      next[key] = emptyNestedArrays(child);
    });
    return next;
  }
  return value;
}

function cloneSample(value) {
  if (value == null || typeof value !== "object") {
    return value;
  }
  return structuredClone(value);
}

function sampleString(schema, name) {
  const format = schema && schema.format;
  if (format === "date") return new Date().toISOString().slice(0, 10);
  if (format === "date-time") return new Date().toISOString();
  if (format === "email") return "user@example.com";
  if (format === "uuid") return "00000000-0000-0000-0000-000000000001";
  if (format === "uri" || format === "url") return "https://example.com";
  if (format === "password") return "secret";
  const lower = String(name || "").toLowerCase();
  if (lower.includes("id")) return "1";
  if (lower.includes("name")) return "sample";
  if (lower.includes("email")) return "user@example.com";
  return "sample";
}

export function humanize(name) {
  return String(name)
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export function getPath(root, path) {
  return path.reduce((acc, key) => (acc == null ? acc : acc[key]), root);
}

export function setPath(root, path, value) {
  if (path.length === 0) return value;
  const next = Array.isArray(root) ? [...root] : { ...(root || {}) };
  const [head, ...rest] = path;
  next[head] = rest.length ? setPath(next[head], rest, value) : value;
  return next;
}

export function coerce(raw, type, schema) {
  if (raw === "") return schema && schema.nullable ? null : "";
  if (isExtractPlaceholder(raw)) {
    return String(raw).trim();
  }
  if (type === "integer") return Number.parseInt(raw, 10);
  if (type === "number") return Number.parseFloat(raw);
  if (schema && schema.enum) {
    const match = schema.enum.find((item) => String(item) === raw);
    return match === undefined ? raw : match;
  }
  return raw;
}

export function inputType(schema, type) {
  const format = schema && schema.format;
  if (format === "email") return "email";
  if (format === "password") return "password";
  if (type === "integer" || type === "number") return "number";
  return "text";
}

export function jsonPathsFromSchema(schema, prefix = "$", depth = 0) {
  const results = [];
  if (!schema || depth > 8) {
    return results;
  }
  const resolved = resolveSchemaBranch(schema);
  const type = schemaType(resolved);

  if (type === "object" && resolved.properties) {
    const required = new Set(resolved.required || []);
    Object.entries(resolved.properties).forEach(([name, property]) => {
      const path = joinJsonPath(prefix, name);
      const propertyType = schemaType(resolveSchemaBranch(property));
      if (propertyType === "object" || propertyType === "array") {
        results.push(...jsonPathsFromSchema(property, path, depth + 1));
        return;
      }
      results.push(leafPath(path, property, required.has(name)));
    });
    return results;
  }

  if (type === "array") {
    const items = resolved.items || { type: "string" };
    const itemPath = `${prefix}[0]`;
    const itemType = schemaType(resolveSchemaBranch(items));
    if (itemType === "object" || itemType === "array") {
      return jsonPathsFromSchema(items, itemPath, depth + 1);
    }
    results.push(leafPath(itemPath, items, false));
    return results;
  }

  if (prefix !== "$") {
    results.push(leafPath(prefix, resolved, false));
  }
  return results;
}

export function jsonPathsFromValue(value, prefix = "$", depth = 0) {
  const results = [];
  if (value == null || depth > 8) {
    return results;
  }
  if (Array.isArray(value)) {
    if (!value.length) {
      return results;
    }
    return jsonPathsFromValue(value[0], `${prefix}[0]`, depth + 1);
  }
  if (typeof value === "object") {
    Object.entries(value).forEach(([name, child]) => {
      const path = joinJsonPath(prefix, name);
      if (child && typeof child === "object") {
        results.push(...jsonPathsFromValue(child, path, depth + 1));
        return;
      }
      results.push({
        path,
        type: child == null ? "null" : typeof child,
        required: false,
        description: "",
        sample: formatAssertionValue(child)
      });
    });
    return results;
  }
  if (prefix !== "$") {
    results.push({
      path: prefix,
      type: typeof value,
      required: false,
      description: "",
      sample: formatAssertionValue(value)
    });
  }
  return results;
}

export function parseExtracts(serialized) {
  const result = [];
  if (!serialized || String(serialized).trim() === "" || String(serialized).trim().toUpperCase() === "NA") {
    return result;
  }
  String(serialized).split("|").forEach((pair) => {
    const trimmed = pair.trim();
    if (!trimmed) {
      return;
    }
    const separator = trimmed.indexOf("=");
    if (separator < 0) {
      return;
    }
    const name = trimmed.slice(0, separator).trim();
    const source = trimmed.slice(separator + 1).trim();
    if (name && source) {
      result.push({ name, source });
    }
  });
  return result;
}

export function serializeExtracts(items) {
  const pairs = (items || [])
    .filter((item) => item.name && item.source)
    .map((item) => `${String(item.name).trim()}=${String(item.source).trim()}`);
  return pairs.length ? pairs.join("|") : "";
}

const EXTRACT_PLACEHOLDER = /^\{\{([A-Za-z_][A-Za-z0-9_]*)\}\}$/;

export function extractPlaceholderName(value) {
  const match = String(value ?? "").trim().match(EXTRACT_PLACEHOLDER);
  return match ? match[1] : "";
}

export function isExtractPlaceholder(value) {
  return Boolean(extractPlaceholderName(value));
}

export function formatExtractPlaceholder(name) {
  return `{{${name}}}`;
}

export function collectPlanExtracts(planCases, currentCaseId) {
  const result = [];
  const seen = new Set();
  (planCases || []).forEach((testCase) => {
    if (currentCaseId && testCase.id === currentCaseId) {
      return;
    }
    if (String(testCase.enabled || "Y").toUpperCase() === "N") {
      return;
    }
    parseExtracts(testCase.extracts).forEach((item) => {
      if (!item.name || seen.has(item.name)) {
        return;
      }
      seen.add(item.name);
      result.push({
        name: item.name,
        source: item.source,
        testName: testCase.testName || "Untitled case",
        method: testCase.method || "",
        caseId: testCase.id
      });
    });
  });
  return result;
}

export function parseJsonPathAssertions(serialized) {
  const result = new Map();
  if (!serialized || serialized.trim() === "" || serialized.trim().toUpperCase() === "NA") {
    return result;
  }
  serialized.split("|").forEach((pair) => {
    const separator = pair.indexOf("=");
    if (separator < 0) {
      const path = pair.trim();
      if (path) {
        result.set(path, "");
      }
      return;
    }
    const path = pair.slice(0, separator).trim();
    let value = pair.slice(separator + 1);
    if (value === "{}") {
      value = "";
    }
    if (path) {
      result.set(path, value);
    }
  });
  return result;
}

export function serializeJsonPathAssertions(selections) {
  const pairs = (selections || [])
    .filter((item) => item.selected && item.path && item.path.trim())
    .map((item) => `${item.path.trim()}=${item.value == null ? "" : String(item.value)}`);
  return pairs.length ? pairs.join("|") : "NA";
}

export function schemaVariants(schema) {
  const list = schema?.oneOf || schema?.anyOf;
  if (!list?.length) {
    return [];
  }
  return list.map((item, index) => ({
    index,
    schema: item,
    label: variantLabel(item, index)
  }));
}

export function matchVariantIndex(schema, value) {
  const variants = schema?.oneOf || schema?.anyOf || [];
  if (!variants.length) {
    return 0;
  }
  const discriminator = schema?.discriminator;
  const propertyName = discriminator?.propertyName;
  if (propertyName && value && typeof value === "object" && !Array.isArray(value) && value[propertyName] != null) {
    const tag = String(value[propertyName]);
    const mapped = discriminator.mapping?.[tag];
    const mappedIndex = variants.findIndex((item) =>
      (item.title && String(item.title) === tag)
      || (mapped && (item.$ref === mapped || String(item.$ref || "").endsWith(String(mapped))))
      || (item.properties?.[propertyName]?.enum || []).map(String).includes(tag)
      || String(item.properties?.[propertyName]?.const ?? "") === tag
    );
    if (mappedIndex >= 0) {
      return mappedIndex;
    }
  }
  return 0;
}

function variantLabel(schema, index) {
  if (!schema) {
    return `Option ${index + 1}`;
  }
  if (schema.title) {
    return schema.title;
  }
  if (schema.description) {
    return schema.description;
  }
  if (schema.type) {
    return String(schema.type);
  }
  return `Option ${index + 1}`;
}

function resolveSchemaBranch(schema) {
  if (!schema) {
    return schema;
  }
  if (schema.oneOf && schema.oneOf.length) {
    return schema.oneOf[0];
  }
  if (schema.anyOf && schema.anyOf.length) {
    return schema.anyOf[0];
  }
  if (schema.allOf && schema.allOf.length) {
    return schema.allOf.reduce((merged, part) => ({
      ...merged,
      ...part,
      properties: { ...(merged.properties || {}), ...(part.properties || {}) },
      required: [...new Set([...(merged.required || []), ...(part.required || [])])]
    }), {});
  }
  return schema;
}

function joinJsonPath(prefix, name) {
  if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) {
    return prefix === "$" ? `$.${name}` : `${prefix}.${name}`;
  }
  const escaped = String(name).replace(/'/g, "\\'");
  return `${prefix}['${escaped}']`;
}

function leafPath(path, schema, required) {
  const resolved = resolveSchemaBranch(schema) || {};
  const type = schemaType(resolved);
  return {
    path,
    type,
    required,
    description: resolved.description || "",
    sample: formatAssertionValue(sampleFromSchema(resolved))
  };
}

export function formatAssertionValue(value) {
  if (value == null) {
    return "";
  }
  if (typeof value === "object") {
    return JSON.stringify(value);
  }
  return String(value);
}

export function missingRequiredSchemaFields(schema, value) {
  const names = [];
  collectMissingRequired(schema, value, [], names);
  return names;
}

function collectMissingRequired(schema, value, path, names) {
  if (!schema) {
    return;
  }
  if (schema.oneOf || schema.anyOf) {
    const variants = schemaVariants(schema);
    const index = matchVariantIndex(schema, value);
    collectMissingRequired(variants[index]?.schema || resolveSchemaBranch(schema), value, path, names);
    return;
  }
  const resolved = resolveSchemaBranch(schema);
  const type = schemaType(resolved);
  if (type === "object" && resolved?.properties) {
    const required = new Set(resolved.required || []);
    Object.entries(resolved.properties).forEach(([name, property]) => {
      const child = value != null && typeof value === "object" && !Array.isArray(value)
        ? value[name]
        : undefined;
      const childRequired = required.has(name);
      if (!childRequired && isEffectivelyEmpty(child)) {
        return;
      }
      collectRequiredChild(property, child, path.concat(name), names, childRequired);
    });
    return;
  }
  if (type === "array") {
    if (!Array.isArray(value)) {
      return;
    }
    value.forEach((item, index) => {
      collectMissingRequired(resolved.items || { type: "string" }, item, path.concat(String(index + 1)), names);
    });
  }
}

function collectRequiredChild(schema, value, path, names, required) {
  const resolved = resolveSchemaBranch(schema);
  const type = schemaType(resolved);
  if (type === "object" || type === "union" || schema?.oneOf || schema?.anyOf) {
    if (required && isEffectivelyEmpty(value)) {
      names.push(labelForPath(path));
      return;
    }
    collectMissingRequired(schema, value, path, names);
    return;
  }
  if (type === "array") {
    if (required && !Array.isArray(value)) {
      names.push(labelForPath(path));
      return;
    }
    collectMissingRequired(schema, value, path, names);
    return;
  }
  if (required && isBlankRequiredValue(value)) {
    names.push(labelForPath(path));
  }
}

function isBlankRequiredValue(value) {
  if (value == null) {
    return true;
  }
  if (typeof value === "string") {
    return value.trim() === "";
  }
  if (typeof value === "number") {
    return Number.isNaN(value);
  }
  if (typeof value === "object" && !Array.isArray(value) && typeof value.fileId === "string") {
    return value.fileId.trim() === "";
  }
  return false;
}

export function isEffectivelyEmpty(value) {
  if (value == null) {
    return true;
  }
  if (typeof value === "string") {
    return value.trim() === "";
  }
  if (typeof value === "number") {
    return Number.isNaN(value);
  }
  if (Array.isArray(value)) {
    return value.length === 0;
  }
  if (typeof value === "object") {
    if (typeof value.fileId === "string") {
      return value.fileId.trim() === "";
    }
    return Object.values(value).every(isEffectivelyEmpty);
  }
  return false;
}

function labelForPath(path) {
  return path.map((part) => (/^\d+$/.test(part) ? part : humanize(part))).join(" / ");
}

export function parseJsonDocument(value) {
  if (value == null) {
    return undefined;
  }
  const text = String(value).trim();
  if (!text || text.toUpperCase() === "NA") {
    return undefined;
  }
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

export function getJsonPathValue(root, jsonPath) {
  if (root === undefined || root === null || !jsonPath) {
    return undefined;
  }
  const path = String(jsonPath).trim();
  if (path === "$") {
    return root;
  }
  if (!path.startsWith("$")) {
    return undefined;
  }
  let current = root;
  let index = 1;
  while (index < path.length) {
    if (current == null) {
      return undefined;
    }
    const ch = path[index];
    if (ch === ".") {
      index += 1;
      const match = path.slice(index).match(/^[A-Za-z_][A-Za-z0-9_]*/);
      if (!match) {
        return undefined;
      }
      current = current[match[0]];
      index += match[0].length;
      continue;
    }
    if (ch === "[") {
      const close = path.indexOf("]", index);
      if (close < 0) {
        return undefined;
      }
      const token = path.slice(index + 1, close);
      if ((token.startsWith("'") && token.endsWith("'")) || (token.startsWith("\"") && token.endsWith("\""))) {
        current = current[token.slice(1, -1).replace(/\\'/g, "'")];
      } else if (/^\d+$/.test(token)) {
        current = current[Number(token)];
      } else {
        return undefined;
      }
      index = close + 1;
      continue;
    }
    return undefined;
  }
  return current;
}

export function applyExpectedToJsonPathAssertions(serialized, expectedResponse) {
  const document = parseJsonDocument(expectedResponse);
  if (document === undefined) {
    return serialized;
  }
  const saved = parseJsonPathAssertions(serialized);
  if (saved.size === 0) {
    return serialized;
  }
  const next = [];
  let changed = false;
  saved.forEach((oldValue, path) => {
    const extracted = getJsonPathValue(document, path);
    const value = extracted !== undefined ? formatAssertionValue(extracted) : oldValue;
    if (value !== oldValue) {
      changed = true;
    }
    next.push({ path, selected: true, value });
  });
  return changed ? serializeJsonPathAssertions(next) : serialized;
}
