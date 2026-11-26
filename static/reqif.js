"use strict";

const imageTypes = new Map(Object.entries({
  png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif",
  webp: "image/webp", bmp: "image/bmp", svg: "image/svg+xml", avif: "image/avif",
}));
const richTags = new Set(("p br b strong i em u s strike sub sup ol ul li table thead tbody " +
  "tfoot tr td th caption colgroup col a hr span div pre code h1 h2 h3 h4 h5 h6 blockquote").split(" "));
const blockedTags = new Set(("script style iframe embed applet form input button select textarea " +
  "link meta base frame frameset noscript svg math head title").split(" "));
const richStyles = new Set(("color background-color font-family font-size font-style font-weight " +
  "text-align text-decoration white-space vertical-align border border-width border-color border-style " +
  "border-collapse padding margin width height").split(" "));

function child(element, name) {
  return Array.from(element?.children ?? []).find(node =>
    node.localName === name && node.namespaceURI === element.namespaceURI);
}

function ref(element, container, name) {
  return child(child(element, container), name)?.textContent.trim() ?? "";
}

function decodeXml(bytes) {
  let encoding = "utf-8";
  if ((bytes[0] === 0xff && bytes[1] === 0xfe) || (bytes[0] === 60 && bytes[1] === 0)) {
    encoding = "utf-16le";
  } else if ((bytes[0] === 0xfe && bytes[1] === 0xff) || (bytes[0] === 0 && bytes[1] === 60)) {
    encoding = "utf-16be";
  } else {
    const prefix = new TextDecoder().decode(bytes.subarray(0, 1024));
    encoding = prefix.match(/^<\?xml\s+[^?]*?\bencoding\s*=\s*["']([^"']+)["']/i)?.[1] ?? encoding;
  }
  try {
    return new TextDecoder(encoding, { fatal: true }).decode(bytes);
  } catch {
    throw new Error("无法读取 ReqIF XML 的字符编码");
  }
}

function normalizedPath(path) {
  const parts = [];
  for (const part of path.replaceAll("\\", "/").split("/")) {
    if (part === "..") parts.pop();
    else if (part && part !== ".") parts.push(part);
  }
  return parts.join("/");
}

function attachmentReader(archive, main, missing) {
  const entries = [];
  const exact = new Map();
  const byName = new Map();
  const images = new Map();
  const urls = new Set();
  let disposed = false;
  for (const entry of archive?.entries.values() ?? []) {
    if (entry === main) continue;
    const path = normalizedPath(entry.name);
    const name = path.split("/").pop();
    const asset = { index: entries.length, name, entry, type: imageTypes.get(name.split(".").pop().toLowerCase()) };
    entries.push(asset);
    exact.set(path, exact.has(path) ? null : asset);
    byName.set(name, byName.has(name) ? null : asset);
  }
  const mainFolder = main?.name.replaceAll("\\", "/").split("/").slice(0, -1).join("/") ?? "";

  function resolve(value, image) {
    const source = value.trim();
    if (image && /^data:image\/(?:png|jpeg|gif|webp|bmp|avif);base64,[a-z\d+/=\s]+$/i.test(source)) {
      return { url: source };
    }
    if (!source || /^(?:[a-z][a-z0-9+.-]*:|[/\\]{2}|#)/i.test(source)) {
      if (image && source) missing.add(source);
      return null;
    }
    let path = source.split(/[?#]/, 1)[0];
    try { path = decodeURIComponent(path); } catch {}
    const name = normalizedPath(path).split("/").pop();
    const asset = exact.get(normalizedPath(mainFolder + "/" + path)) ??
      exact.get(normalizedPath(path)) ?? byName.get(name);
    if (!asset) missing.add(source);
    return asset;
  }

  async function loadImage(asset) {
    const blob = new Blob([await archive.read(asset.entry)], { type: asset.type });
    if (disposed) return "";
    if (asset.type === "image/svg+xml") {
      // A standalone SVG must not inherit the viewer's origin.
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(blob);
      });
    }
    const url = URL.createObjectURL(blob);
    urls.add(url);
    return url;
  }

  return {
    resolve,
    image(index) {
      if (!images.has(index)) images.set(index, loadImage(entries[index]));
      return images.get(index);
    },
    async download(index) {
      const { entry, name } = entries[index];
      const bytes = await archive.read(entry);
      return { blob: new Blob([bytes], { type: "application/octet-stream" }), name };
    },
    dispose() {
      disposed = true;
      urls.forEach(url => URL.revokeObjectURL(url));
      urls.clear();
      images.clear();
    },
  };
}

function cleanRich(source, target, resolve, issues) {
  for (const node of source.childNodes) {
    if (node.nodeType === Node.TEXT_NODE || node.nodeType === Node.CDATA_SECTION_NODE) {
      target.append(node.nodeValue);
      continue;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) continue;
    const tag = node.localName.toLowerCase();
    if (blockedTags.has(tag)) {
      issues.dropped++;
      continue;
    }
    if (tag === "img" || tag === "object") {
      const path = node.getAttribute(tag === "img" ? "src" : "data") ?? "";
      const label = node.getAttribute("alt") || path.split(/[/\\]/).pop()?.slice(0, 60) || "附件";
      const asset = resolve(path, true);
      const preview = asset?.url || asset?.type;
      const element = document.createElement(preview ? "img" : asset ? "button" : "span");
      if (preview) {
        element.alt = label;
        element.decoding = "async";
        if (asset.url) {
          element.loading = "lazy";
          element.src = asset.url;
        } else {
          element.dataset.image = asset.index;
        }
        for (const dimension of ["width", "height"]) {
          const size = node.getAttribute(dimension);
          if (/^\d{1,4}%?$/.test(size ?? "")) element.setAttribute(dimension, size);
        }
      } else if (asset) {
        element.type = "button";
        element.dataset.download = asset.index;
        element.textContent = label;
      } else {
        element.className = "miss-attach";
        element.textContent = "[缺失附件：" + label + "]";
      }
      target.append(element);
      if (!asset && tag === "object") cleanRich(node, target, resolve, issues);
      continue;
    }
    if (!richTags.has(tag)) {
      cleanRich(node, target, resolve, issues);
      continue;
    }
    const asset = tag === "a" ? resolve(node.getAttribute("href") ?? "", false) : null;
    const element = document.createElement(tag === "a" ? "span" : tag);
    const title = node.getAttribute("title");
    if (title) element.title = title.slice(0, 200);
    for (const attribute of ["colspan", "rowspan", "span"]) {
      const value = node.getAttribute(attribute);
      if (value && /^\d{1,4}$/.test(value)) element.setAttribute(attribute, value);
    }
    for (const declaration of (node.getAttribute("style") ?? "").split(";")) {
      const colon = declaration.indexOf(":");
      if (colon < 0) continue;
      const property = declaration.slice(0, colon).trim().toLowerCase();
      const value = declaration.slice(colon + 1).trim();
      if (richStyles.has(property) && !/[\\()]/.test(value)) element.style.setProperty(property, value);
    }
    cleanRich(node, element, resolve, issues);
    if (asset) {
      const download = document.createElement("button");
      download.type = "button";
      download.dataset.download = asset.index;
      if (element.querySelector("[data-download]")) download.textContent = element.textContent.trim() || asset.name;
      else if (element.textContent.trim() || element.querySelector("img")) download.append(...element.childNodes);
      else download.textContent = asset.name;
      download.title = title || "下载 " + asset.name;
      target.append(download);
    } else {
      target.append(element);
    }
  }
}

async function readReqif(file) {
  if (!/\.reqifz?$/i.test(file.name)) throw new Error("仅支持 .reqif / .reqifz 文件");
  if (file.size > 512 * 1024 * 1024) throw new Error("文件超过 512 MiB");
  const archive = /\.reqifz$/i.test(file.name) ? await readZip(file) : null;
  const documents = archive ? [...archive.entries.values()].filter(entry => /\.reqif$/i.test(entry.name)) : [];
  if (archive && documents.length !== 1) {
    throw new Error(documents.length ? "ReqIFz 包含多个 .reqif 文件" : "ReqIFz 中没有 .reqif 文件");
  }
  const main = documents[0];
  if ((main?.size ?? file.size) > 200 * 1024 * 1024) throw new Error("ReqIF XML 超过 200 MiB");
  const bytes = archive ? await archive.read(main) : new Uint8Array(await file.arrayBuffer());
  const text = decodeXml(bytes);
  if (/^\s*(?:<\?[\s\S]*?\?>\s*|<!--[\s\S]*?-->\s*)*<!DOCTYPE\b/.test(text)) {
    throw new Error("ReqIF 文件不能包含 DTD");
  }
  const xml = new DOMParser().parseFromString(text, "application/xml");
  const root = xml.documentElement;
  if (xml.doctype || root.localName !== "REQ-IF" ||
      xml.getElementsByTagNameNS("http://www.mozilla.org/newlayout/xml/parsererror.xml", "parsererror").length) {
    throw new Error("无法解析 ReqIF XML，请检查文件格式");
  }

  const issues = { dropped: 0, missing: new Set() };
  const assets = attachmentReader(archive, main, issues.missing);
  return {
    ...parseReqif(root, assets.resolve, issues),
    source: file.name,
    attachments: archive ? archive.entries.size - 1 : 0,
    assets,
  };
}

function parseReqif(root, resolve, issues) {
  const elements = name => root.getElementsByTagNameNS(root.namespaceURI, name);
  const typeNames = new Map(Array.from(elements("SPEC-OBJECT-TYPE"), node =>
    [node.getAttribute("IDENTIFIER"), node.getAttribute("LONG-NAME") || ""]));
  const enumLabels = new Map();
  const datatypes = new Map();
  for (const type of elements("DATATYPE-DEFINITION-ENUMERATION")) {
    const values = Array.from(type.getElementsByTagNameNS(root.namespaceURI, "ENUM-VALUE"), node => {
      const id = node.getAttribute("IDENTIFIER");
      const label = node.getAttribute("LONG-NAME") || id;
      enumLabels.set(id, label);
      return label;
    });
    datatypes.set(type.getAttribute("IDENTIFIER"), values);
  }

  const definitions = new Map();
  const filters = new Map();
  for (const kind of ["string", "xhtml", "enumeration", "integer", "real", "boolean", "date"]) {
    for (const node of elements("ATTRIBUTE-DEFINITION-" + kind.toUpperCase())) {
      const name = node.getAttribute("LONG-NAME") || "(未命名属性)";
      const values = datatypes.get(ref(node, "TYPE", "DATATYPE-DEFINITION-ENUMERATION-REF")) ?? [];
      const id = node.getAttribute("IDENTIFIER");
      definitions.set(id, { id, name, kind, defaultValue: child(node, "DEFAULT-VALUE")?.firstElementChild });
      if (!filters.has(name)) filters.set(name, { name, kind, values: new Set(), count: 0 });
      values.forEach(value => filters.get(name).values.add(value));
    }
  }

  const typeDefinitions = new Map();
  for (const type of elements("SPEC-OBJECT-TYPE")) {
    typeDefinitions.set(type.getAttribute("IDENTIFIER"),
      Array.from(child(type, "SPEC-ATTRIBUTES")?.children ?? [], node =>
        definitions.get(node.getAttribute("IDENTIFIER"))).filter(Boolean));
  }

  function readValue(value, definition, defaulted = false) {
    const { id, name, kind } = definition ?? {
      name: "(未知属性)", kind: value.localName.slice("ATTRIBUTE-VALUE-".length).toLowerCase(),
    };
    const raw = value.getAttribute("THE-VALUE") ?? "";
    const attribute = { id, name, kind, value: raw, defaulted };
    if (kind === "xhtml") {
      const content = child(value, "THE-VALUE");
      const host = document.createElement("div");
      if (content) cleanRich(content, host, resolve, issues);
      else host.textContent = raw;
      attribute.text = host.textContent;
      attribute.value = attribute.text.replace(/\s+/g, " ").trim();
      attribute.html = host.innerHTML;
    } else if (kind === "enumeration") {
      const ids = [...value.getElementsByTagNameNS(root.namespaceURI, "ENUM-VALUE-REF")]
        .map(element => element.textContent.trim()).filter(Boolean);
      if (raw) ids.unshift(raw);
      attribute.labels = [...new Set(ids)].map(id => enumLabels.get(id) || id);
      attribute.value = attribute.labels.join(", ");
    }
    return attribute;
  }

  const objects = new Map();
  const bodyFields = new Set();
  for (const node of elements("SPEC-OBJECT")) {
    const rid = node.getAttribute("IDENTIFIER");
    if (!rid) continue;
    const typeId = ref(node, "TYPE", "SPEC-OBJECT-TYPE-REF");
    const type_name = typeNames.get(typeId) || "(未知类型)";
    const attrs = [];
    const explicit = new Set();
    for (const value of child(node, "VALUES")?.children ?? []) {
      if (!value.localName.startsWith("ATTRIBUTE-VALUE-") || value.namespaceURI !== root.namespaceURI) continue;
      const suffix = value.localName.slice("ATTRIBUTE-VALUE-".length);
      const id = ref(value, "DEFINITION", "ATTRIBUTE-DEFINITION-" + suffix + "-REF");
      explicit.add(id);
      attrs.push(readValue(value, definitions.get(id)));
    }
    for (const definition of typeDefinitions.get(typeId) ?? []) {
      if (definition.defaultValue && !explicit.has(definition.id)) {
        attrs.push(readValue(definition.defaultValue, definition, true));
      }
    }
    let title = "";
    let wid = "";
    let legacyId = "";
    for (const attribute of attrs) {
      if (filters.has(attribute.name)) filters.get(attribute.name).count++;
      if (attribute.name === "ReqIF.ChapterName") title = attribute.value;
      if (attribute.name === "ReqIF.ForeignID") wid ||= attribute.value;
      if (attribute.name === "ReqIF.ForignID") legacyId ||= attribute.value;
    }
    wid ||= legacyId;
    title ||= node.getAttribute("LONG-NAME") || "";
    for (const attribute of attrs) {
      if (attribute.html?.trim() || (attribute.kind === "string" && attribute.value)) {
        bodyFields.add(attribute.name);
      }
    }
    const searchFields = [{ name: "工作项 ID", value: wid || rid }, { name: "标题", value: title }];
    if (wid && wid !== rid) searchFields.push({ name: "内部标识", value: rid });
    for (const { name, value } of attrs) if (value) searchFields.push({ name, value });
    for (const field of searchFields) field.lower = field.value.toLowerCase();
    objects.set(rid, { rid, wid, title, type_name, fallback: !wid, attrs, related: [], searchFields });
  }
  if (!objects.size) throw new Error("ReqIF 中没有工作项（SPEC-OBJECT）");

  let key = 0;
  function hierarchy(holder, depth = 0) {
    if (depth > 512) throw new Error("ReqIF 文档层级超过 512 层");
    const nodes = [];
    for (const node of holder?.children ?? []) {
      if (node.localName !== "SPEC-HIERARCHY" || node.namespaceURI !== root.namespaceURI) continue;
      const rid = ref(node, "OBJECT", "SPEC-OBJECT-REF");
      const nodeKey = key++;
      const children = hierarchy(child(node, "CHILDREN"), depth + 1);
      const item = objects.get(rid);
      if (item) nodes.push({ key: nodeKey, rid, wid: item.wid, title: item.title, type_name: item.type_name, children });
      else nodes.push(...children);
    }
    return nodes;
  }

  const specs = Array.from(elements("SPECIFICATION"), node => ({
    name: node.getAttribute("LONG-NAME") || "(未命名文档)",
    tree: hierarchy(child(node, "CHILDREN")),
  }));
  const displayNodes = new Map();
  specs.forEach((spec, index) => {
    if (!spec.name || spec.name === "(未命名文档)") return;
    const exists = (function has(nodes) {
      return nodes.some(node => node.title === spec.name || has(node.children));
    })(spec.tree);
    if (exists) return;
    let rid = "_doc-title-" + index;
    while (objects.has(rid)) rid += "_";
    displayNodes.set(rid, {
      rid, wid: "", title: spec.name, type_name: "文档标题", displayOnly: true,
      attrs: [], related: [],
      searchFields: [{ name: "文档标题", value: spec.name, lower: spec.name.toLowerCase() }],
    });
    spec.tree = [{ key: key++, rid, wid: "", title: spec.name,
      type_name: "文档标题", docTitle: true, children: spec.tree }];
  });
  const warnings = [];
  if (!specs.length) {
    const tree = Array.from(objects.values(), ({ rid, wid, title, type_name }) =>
      ({ key: key++, rid, wid, title, type_name, children: [] }));
    specs.push({ name: "全部工作项", tree });
    warnings.push("文件不含规格层级，已按工作项列表展示");
  }
  const missingIds = [...objects.values()].filter(item => item.fallback).length;
  if (missingIds) warnings.push(missingIds + " 个工作项使用内部标识");
  if (issues.dropped) warnings.push("已移除 " + issues.dropped + " 个不支持的富文本元素");
  if (issues.missing.size) warnings.push(issues.missing.size + " 个附件引用不可用");

  let relations = 0;
  for (const node of elements("SPEC-RELATION")) {
    const source = ref(node, "SOURCE", "SPEC-OBJECT-REF");
    const target = ref(node, "TARGET", "SPEC-OBJECT-REF");
    if (!source || !target) continue;
    const from = objects.get(source);
    const to = objects.get(target);
    from?.related.push({ dir: "out", rid: target });
    if (source !== target) to?.related.push({ dir: "in", rid: source });
    relations++;
  }

  const attrs = [...filters.values()].filter(attribute =>
    attribute.count && attribute.name !== "ReqIF.Text").sort((a, b) => b.count - a.count)
    .map(attribute => ({ ...attribute, values: [...attribute.values].sort() }));
  return { objects, displayNodes, specs, attrs, relations, warnings, bodyFields: [...bodyFields].sort() };
}

const bodyNames = new Set([
  "text", "description", "body", "requirementtext", "requirementdescription", "objecttext",
  "正文", "描述", "需求正文", "需求描述", "内容", "需求内容",
]);

function bodyAttributes(item, field) {
  return item.attrs.filter(attribute => {
    if (field && attribute.name !== field) return false;
    if (attribute.kind === "xhtml") return attribute.html.trim();
    if (attribute.kind !== "string" || !attribute.value) return false;
    const name = attribute.name.toLowerCase().replace(/^reqif[. _-]+/, "").replace(/[. _-]/g, "");
    return field || bodyNames.has(name);
  });
}

function documentItems(model, field) {
  const items = [];
  let lastHeading = "";
  let base = Infinity;
  function walk(nodes, level) {
    for (const node of nodes) {
      if (node.docTitle) {
        items.push({ key: node.key, rid: node.rid, wid: "", level,
          kind: "heading", title: node.title, caption: "", body: [], length: 0, docTitle: true });
        walk(node.children, level);
        continue;
      }
      const item = model.objects.get(node.rid);
      const body = bodyAttributes(item, field);
      const heading = item.type_name.toLowerCase() === "heading";
      items.push({
        key: node.key, rid: item.rid, wid: item.wid, level,
        kind: heading ? "heading" : body.length ? "text" : "plain",
        title: item.title, caption: heading || item.title === lastHeading ? "" : item.title,
        body, length: body.reduce((total, attribute) => total + attribute.value.length, 0),
      });
      if (heading) {
        lastHeading = item.title;
        base = Math.min(base, level);
      }
      walk(node.children, level + 1);
    }
  }
  model.specs.forEach(spec => walk(spec.tree, 1));
  if (!Number.isFinite(base)) base = 1;
  const counters = [];
  for (const item of items) {
    item.level = Math.max(1, item.level - base + 1);
    if (item.kind !== "heading" || item.docTitle) continue;
    const index = item.level - 1;
    counters[index] = (counters[index] || 0) + 1;
    counters.length = item.level;
    item.num = Array.from(counters, value => value || 1).join(".");
  }
  return items;
}

function searchItems(model, query, filters, mode) {
  const lower = query.toLowerCase();
  const terms = [...new Set(lower.split(/\s+/).filter(Boolean))];
  const active = filters.filter(filter => filter.value.length).map(filter => ({
    ...filter, terms: filter.mode === "enum" ? filter.value : filter.value.toLowerCase().split(/\s+/),
  }));
  const exact = [];
  const results = [];
  for (const item of [...model.objects.values(), ...model.displayNodes.values()]) {
    if (!active.every(filter => item.attrs.some(attribute => attribute.name === filter.attr &&
      (filter.mode === "enum"
        ? filter.terms.some(term => attribute.labels?.includes(term))
        : filter.terms.some(term => attribute.value.toLowerCase().includes(term)))))) continue;

    let match = null;
    if (terms.length) {
      const matched = new Set();
      let best = 0;
      for (const field of item.searchFields) {
        let count = 0;
        for (const term of terms) {
          if (!field.lower.includes(term)) continue;
          matched.add(term);
          count++;
        }
        if (count > best) {
          match = field;
          best = count;
        }
      }
      if (!matched.size || (mode === "all" && matched.size < terms.length)) continue;
    }
    const group = lower && (item.wid.toLowerCase() === lower || item.rid.toLowerCase() === lower) ? exact : results;
    group.push({ item, match });
  }
  return exact.concat(results);
}

function viewerStats(model) {
  const counts = new Map();
  for (const item of model.objects.values()) {
    counts.set(item.type_name, (counts.get(item.type_name) || 0) + 1);
  }
  return {
    source: model.source, objects: model.objects.size, specs: model.specs.length,
    relations: model.relations, attachments: model.attachments,
    types: Array.from(counts, ([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count),
  };
}
