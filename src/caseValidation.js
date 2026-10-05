import { isEffectivelyEmpty, missingRequiredSchemaFields } from "./schema";
import { isXmlContentType, looksLikeXml, xmlToJson } from "./xml";

/** @typedef {{ key: string, label: string, anchorId: string }} ValidationItem */
/** @typedef {{ id: string, title: string, items: ValidationItem[] }} ValidationGroup */

export function issueCount(groups) {
  return (groups || []).reduce((total, group) => total + group.items.length, 0);
}

export function blockerTitle(groups, fallback = "") {
  const count = issueCount(groups);
  if (!count) {
    return fallback;
  }
  if (count === 1) {
    return groups.flatMap((group) => group.items)[0].label;
  }
  return `${count} required fields missing`;
}

export function caseSaveIssues(form, operation, requestBody) {
  /** @type {ValidationGroup[]} */
  const groups = [];

  const caseItems = [];
  if (!String(form.testName || "").trim()) {
    caseItems.push({ key: "testName", label: "Test name", anchorId: "op-field-testName" });
  }
  if (!String(form.baseUrl || "").trim()) {
    caseItems.push({ key: "baseUrl", label: "Base URL", anchorId: "op-field-baseUrl" });
  }
  if (!String(form.statusCode ?? "").trim()) {
    caseItems.push({ key: "statusCode", label: "Expected status", anchorId: "op-field-statusCode" });
  }
  if (caseItems.length) {
    groups.push({ id: "case", title: "Test case", items: caseItems });
  }

  appendParamGroups(groups, form, operation, { requiredOnly: true });

  if (operation.requestBody?.jsonSchema) {
    const body = decodeRequestBody(
      requestBody,
      operation.requestBody.jsonSchema,
      form.contentType
    );
    const missingBody = missingRequiredSchemaFields(operation.requestBody.jsonSchema, body);
    if (missingBody.length) {
      groups.push({
        id: "body",
        title: "Request body",
        items: missingBody.map((path) => ({
          key: path,
          label: path,
          anchorId: "op-section-request-body"
        }))
      });
    } else if (operation.requestBody.required && isEffectivelyEmpty(body)) {
      groups.push({
        id: "body",
        title: "Request body",
        items: [{ key: "body", label: "Request body", anchorId: "op-section-request-body" }]
      });
    }
  } else if (operation.requestBody?.required && isEffectivelyEmpty(requestBody)) {
    groups.push({
      id: "body",
      title: "Request body",
      items: [{ key: "body", label: "Request body", anchorId: "op-section-request-body" }]
    });
  }

  return groups;
}

export function draftRunIssues(form, operation) {
  /** @type {ValidationGroup[]} */
  const groups = [];
  const items = [];
  if (!String(form.baseUrl || "").trim()) {
    items.push({ key: "baseUrl", label: "Base URL", anchorId: "op-field-baseUrl" });
  }
  (operation.parameters || [])
    .filter((parameter) => parameter.in === "path")
    .filter((parameter) => !String(form.pathParams?.[parameter.name] || "").trim())
    .forEach((parameter) => {
      items.push({
        key: `path:${parameter.name}`,
        label: parameter.name,
        anchorId: paramAnchorId(parameter)
      });
    });
  if (items.length) {
    groups.push({ id: "try", title: "Try this request", items });
  }
  return groups;
}

/** @returns {Set<string>} keys `in:name` for empty required params */
export function missingRequiredParamKeys(form, operation) {
  const keys = new Set();
  (operation.parameters || []).forEach((parameter) => {
    const required = parameter.required || parameter.in === "path";
    if (!required) {
      return;
    }
    const values = paramValues(form, parameter.in);
    if (!String(values?.[parameter.name] || "").trim()) {
      keys.add(paramKey(parameter));
    }
  });
  return keys;
}

export function jumpToValidationItem(item) {
  if (!item?.anchorId) {
    return;
  }
  const element = document.getElementById(item.anchorId);
  if (!element) {
    return;
  }
  element.scrollIntoView({ behavior: "smooth", block: "center" });
  const focusable = element.querySelector("input:not([type=hidden]), select, textarea, button");
  if (focusable && typeof focusable.focus === "function") {
    focusable.focus({ preventScroll: true });
  }
}

export function paramAnchorId(parameter) {
  return `op-param-${parameter.in}-${parameter.name}`;
}

function appendParamGroups(groups, form, operation, { requiredOnly }) {
  const bySection = {
    path: { title: "Path params", in: "path", items: [] },
    query: { title: "Query params", in: "query", items: [] },
    header: { title: "Headers", in: "header", items: [] },
    cookie: { title: "Cookies", in: "cookie", items: [] }
  };
  (operation.parameters || []).forEach((parameter) => {
    const required = parameter.required || parameter.in === "path";
    if (requiredOnly && !required) {
      return;
    }
    const section = bySection[parameter.in];
    if (!section) {
      return;
    }
    const values = paramValues(form, parameter.in);
    if (!String(values?.[parameter.name] || "").trim()) {
      section.items.push({
        key: paramKey(parameter),
        label: parameter.name,
        anchorId: paramAnchorId(parameter)
      });
    }
  });
  Object.values(bySection).forEach((section) => {
    if (section.items.length) {
      groups.push({ id: `params-${section.in}`, title: section.title, items: section.items });
    }
  });
}

function paramKey(parameter) {
  return `${parameter.in}:${parameter.name}`;
}

function paramValues(form, location) {
  if (location === "path") return form.pathParams;
  if (location === "query") return form.queryParams;
  if (location === "header") return form.headers;
  if (location === "cookie") return form.cookieParams;
  return null;
}

function decodeRequestBody(body, schema, contentType) {
  if (isXmlContentType(contentType) && looksLikeXml(body)) {
    return xmlToJson(body, schema) ?? body;
  }
  return body;
}
