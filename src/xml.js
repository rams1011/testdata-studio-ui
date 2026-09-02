export function isXmlContentType(contentType) {
  const value = String(contentType || "").trim().toLowerCase().split(";")[0].trim();
  return value === "xml"
    || value === "application/xml"
    || value === "text/xml"
    || value.endsWith("+xml");
}

export function looksLikeXml(value) {
  return typeof value === "string" && /^\s*</.test(value);
}

export function jsonToXml(value, schema) {
  if (value == null) {
    return "";
  }
  if (looksLikeXml(value)) {
    return prettyXml(String(value));
  }
  const unwrapped = unwrapRoot(value, schema);
  const xml = xmlMeta(schema);
  const rootName = elementName(schema, inferRootName(unwrapped, schema));
  const namespace = xml.namespace || null;
  const qName = namespace ? qualifiedName(xml, rootName) : rootName;
  const doc = document.implementation.createDocument(namespace, qName, null);
  const root = doc.documentElement;
  applyNamespace(root, xml);
  writeContent(doc, root, unwrapped, schema);
  return serializePretty(root).trim();
}

export function xmlToJson(xml, schema) {
  if (!looksLikeXml(xml)) {
    return null;
  }
  const doc = new DOMParser().parseFromString(String(xml), "application/xml");
  const error = doc.querySelector("parsererror");
  if (error) {
    return null;
  }
  return elementToValue(doc.documentElement, schema);
}

export function validateXml(xml) {
  if (!String(xml || "").trim()) {
    return "";
  }
  const doc = new DOMParser().parseFromString(String(xml), "application/xml");
  const error = doc.querySelector("parsererror");
  if (!error) {
    return "";
  }
  return error.textContent?.trim() || "Invalid XML.";
}

export function prettyXml(xml) {
  const doc = new DOMParser().parseFromString(String(xml), "application/xml");
  if (doc.querySelector("parsererror") || !doc.documentElement) {
    return String(xml);
  }
  return serializePretty(doc.documentElement).trim();
}

function unwrapRoot(value, schema) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return value;
  }
  const keys = Object.keys(value);
  const root = xmlMeta(schema).name;
  if (keys.length === 1 && root && keys[0] === root && value[root] && typeof value[root] === "object") {
    return value[root];
  }
  return value;
}

function writeContent(doc, parent, value, schema) {
  if (value == null) {
    return;
  }
  if (Array.isArray(value)) {
    writeArray(doc, parent, elementName(schema, "item"), value, schema);
    return;
  }
  if (typeof value !== "object") {
    parent.appendChild(doc.createTextNode(String(value)));
    return;
  }
  const properties = schema?.properties || {};
  Object.entries(value).forEach(([key, child]) => {
    const propertySchema = propertySchemaOf(properties, key);
    if (xmlMeta(propertySchema).attribute) {
      if (child != null) {
        parent.setAttribute(elementName(propertySchema, key), String(child));
      }
      return;
    }
    if (Array.isArray(child)) {
      writeArray(doc, parent, key, child, propertySchema);
      return;
    }
    const element = createElement(doc, propertySchema, key);
    applyNamespace(element, xmlMeta(propertySchema));
    if (child && typeof child === "object") {
      writeContent(doc, element, child, propertySchema);
    } else if (child != null) {
      element.appendChild(doc.createTextNode(String(child)));
    }
    parent.appendChild(element);
  });
}

function writeArray(doc, parent, key, list, schema) {
  const items = schema?.items || {};
  const itemName = elementName(items, elementName(schema, key));
  const wrapped = Boolean(xmlMeta(schema).wrapped);
  let target = parent;
  if (wrapped) {
    target = createElement(doc, schema, key);
    applyNamespace(target, xmlMeta(schema));
    parent.appendChild(target);
  }
  list.forEach((item) => {
    const element = createElement(doc, items, itemName);
    applyNamespace(element, xmlMeta(items));
    if (item && typeof item === "object") {
      writeContent(doc, element, item, items);
    } else if (item != null) {
      element.appendChild(doc.createTextNode(String(item)));
    }
    target.appendChild(element);
  });
}

function elementToValue(element, schema) {
  const properties = schema?.properties || {};
  const object = {};
  [...element.attributes].forEach((attr) => {
    const name = localName(attr.name);
    if (name.startsWith("xmlns")) {
      return;
    }
    object[propertyKey(properties, name)] = coerce(attr.value, propertySchemaOf(properties, name));
  });
  const grouped = {};
  [...element.children].forEach((child) => {
    const name = localName(child.tagName);
    (grouped[name] ||= []).push(child);
  });
  if (!element.children.length) {
    const text = (element.textContent || "").trim();
    if (!Object.keys(object).length) {
      return coerce(text, schema);
    }
    if (text) {
      object["#text"] = text;
    }
    return object;
  }
  Object.entries(grouped).forEach(([name, elements]) => {
    const propertySchema = propertySchemaOf(properties, name);
    const wrapped = Boolean(xmlMeta(propertySchema).wrapped);
    const key = propertyKey(properties, name);
    const itemSchema = propertySchema?.items || propertySchema;
    if (wrapped && elements.length === 1) {
      object[key] = [...elements[0].children].map((child) => elementToValue(child, itemSchema));
      return;
    }
    const values = elements.map((child) => elementToValue(child, itemSchema));
    object[key] = propertySchema?.type === "array" || values.length > 1 ? values : values[0];
  });
  return object;
}

function xmlMeta(schema) {
  return schema?.xml && typeof schema.xml === "object" ? schema.xml : {};
}

function elementName(schema, fallback) {
  const named = xmlMeta(schema).name;
  if (named) {
    return safeName(named, fallback || "Request");
  }
  return fallback ? safeName(fallback, "Request") : "Request";
}

function inferRootName(value, schema) {
  const named = xmlMeta(schema).name;
  if (named) {
    return named;
  }
  if (schema?.title) {
    return schema.title;
  }
  return "Request";
}

function qualifiedName(xml, name) {
  return xml.prefix ? `${xml.prefix}:${name}` : name;
}

function createElement(doc, schema, fallback) {
  const xml = xmlMeta(schema);
  const name = qualifiedName(xml, elementName(schema, fallback));
  if (xml.namespace) {
    return doc.createElementNS(xml.namespace, name);
  }
  return doc.createElement(name);
}

function applyNamespace(element, xml) {
  if (!xml?.namespace) {
    return;
  }
  if (xml.prefix) {
    element.setAttribute(`xmlns:${xml.prefix}`, xml.namespace);
  } else if (!element.getAttribute("xmlns")) {
    element.setAttribute("xmlns", xml.namespace);
  }
}

function propertySchemaOf(properties, name) {
  if (properties[name]) {
    return properties[name];
  }
  return Object.values(properties).find((property) => xmlMeta(property).name === name) || {};
}

function propertyKey(properties, xmlName) {
  if (properties[xmlName]) {
    return xmlName;
  }
  const match = Object.entries(properties).find(([, property]) => xmlMeta(property).name === xmlName);
  return match ? match[0] : xmlName;
}

function localName(name) {
  const index = String(name).lastIndexOf(":");
  return index >= 0 ? name.slice(index + 1) : name;
}

function safeName(name, fallback) {
  const cleaned = String(name || "").trim().replace(/[^A-Za-z0-9._:-]/g, "_");
  if (!cleaned) {
    return fallback;
  }
  return /^[A-Za-z_:]/.test(cleaned) ? cleaned : `_${cleaned}`;
}

function coerce(text, schema) {
  const type = schema?.type;
  if (type === "integer" || type === "number") {
    const number = Number(text);
    return Number.isNaN(number) ? text : number;
  }
  if (type === "boolean") {
    return String(text).toLowerCase() === "true";
  }
  return text;
}

function serializePretty(node, indent = 0) {
  const pad = "  ".repeat(indent);
  const name = node.tagName;
  const attrs = [...node.attributes].map((attr) => ` ${attr.name}="${escapeAttr(attr.value)}"`).join("");
  const elements = [...node.children];
  const text = [...node.childNodes]
    .filter((child) => child.nodeType === Node.TEXT_NODE)
    .map((child) => child.textContent)
    .join("")
    .trim();
  if (!elements.length && !text) {
    return `${pad}<${name}${attrs}/>\n`;
  }
  if (!elements.length) {
    return `${pad}<${name}${attrs}>${escapeXml(text)}</${name}>\n`;
  }
  const inner = elements.map((child) => serializePretty(child, indent + 1)).join("");
  return `${pad}<${name}${attrs}>\n${inner}${pad}</${name}>\n`;
}

function escapeXml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function escapeAttr(value) {
  return escapeXml(value).replaceAll('"', "&quot;");
}
