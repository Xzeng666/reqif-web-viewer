"use strict";

const compareStates = {
  added: ["+", "新增"],
  removed: ["−", "仅旧版"],
  modified: ["~", "修改"],
  unchanged: ["", "不变"],
};
const oldOnlyNote = "仅旧版的工作项可能已删除，也可能未被导出。";
const duplicateIdNote = "重复的 ForeignID 未自动匹配。";
const identityFields = new Set(["ReqIF.ForeignID", "ReqIF.ForignID", "ReqIF.ChapterName"]);

function groupBy(items, keyFor) {
  const groups = new Map();
  for (const item of items) {
    const key = keyFor(item);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);
  }
  return groups;
}

function foreignId(item) {
  return item?.wid.trim() ?? "";
}

function pairItems(before, after) {
  const oldIds = groupBy(before.values(), foreignId);
  const newIds = groupBy(after.values(), foreignId);
  const duplicateId = item => {
    const id = foreignId(item);
    return !!id && ((oldIds.get(id)?.length ?? 0) > 1 || (newIds.get(id)?.length ?? 0) > 1);
  };
  const matches = new Map();
  const used = new Set();
  for (const item of after.values()) {
    const id = foreignId(item);
    const old = id && oldIds.get(id)?.[0];
    if (!old || duplicateId(item)) continue;
    matches.set(item, old);
    used.add(old);
  }
  for (const item of after.values()) {
    if (matches.has(item) || duplicateId(item)) continue;
    const old = before.get(item.rid);
    if (!old || used.has(old) || duplicateId(old) || (foreignId(old) && foreignId(item))) continue;
    matches.set(item, old);
    used.add(old);
  }

  const entries = [];
  const byBefore = new Map(), byAfter = new Map();
  function add(old, current) {
    const item = current ?? old;
    const entry = {
      index: entries.length, id: foreignId(current) || foreignId(old) || item.rid,
      before: old, after: current, duplicateId: duplicateId(item),
    };
    entries.push(entry);
    if (old) byBefore.set(old.rid, entry);
    if (current) byAfter.set(current.rid, entry);
  }
  for (const item of after.values()) add(matches.get(item), item);
  for (const item of before.values()) if (!used.has(item)) add(item);
  return { entries, byBefore, byAfter };
}

function pairSpecs(before, after) {
  const oldById = new Map(before.filter(spec => spec.id).map(spec => [spec.id, spec]));
  const oldByName = groupBy(before, spec => spec.name);
  const newByName = groupBy(after, spec => spec.name);
  const pairs = after.map(spec => ({ before: oldById.get(spec.id), after: spec }));
  const used = new Set(pairs.map(pair => pair.before).filter(Boolean));
  for (const pair of pairs) {
    if (pair.before) continue;
    const previous = oldByName.get(pair.after.name);
    if (previous?.length === 1 && newByName.get(pair.after.name).length === 1 && !used.has(previous[0])) {
      pair.before = previous[0];
      used.add(pair.before);
    }
  }
  for (const spec of before) if (!used.has(spec)) pairs.push({ before: spec });
  return pairs;
}

function specNodes(spec) {
  const tree = spec?.tree ?? [];
  return tree[0]?.docTitle ? tree[0].children : tree;
}

function comparisonOutline(before, after, { entries, byBefore, byAfter }, specPairs) {
  const objects = new Map(after.objects);
  const displayNodes = new Map(after.displayNodes);
  const byRid = new Map();
  let ghostKey = -1;
  function unusedId(index) {
    let rid = "_compare-" + index;
    while (objects.has(rid) || displayNodes.has(rid)) rid += "_";
    return rid;
  }
  for (const entry of entries) {
    entry.rid = entry.after?.rid ?? unusedId(entry.index);
    byRid.set(entry.rid, entry);
    if (!entry.after) objects.set(entry.rid, { ...entry.before, rid: entry.rid });
  }

  function oldGhosts(node) {
    const entry = byBefore.get(node.rid);
    const children = node.children.flatMap(oldGhosts);
    if (entry.after) return children;
    return [{ ...node, key: ghostKey--, rid: entry.rid, ghost: true, children }];
  }

  function merge(oldNodes, newNodes) {
    if (!oldNodes.length) return newNodes;
    if (!newNodes.length) return oldNodes.flatMap(oldGhosts);
    const groups = groupBy(newNodes.map((node, index) => ({ node, index })),
      ({ node }) => byAfter.get(node.rid));
    const used = new Map();
    const matches = oldNodes.map(node => {
      const entry = byBefore.get(node.rid);
      const index = used.get(entry) ?? 0;
      used.set(entry, index + 1);
      return groups.get(entry)?.[index]?.index ?? -1;
    });
    const oldMatches = new Map();
    const gaps = new Map();
    let following = -1;
    const nextMatch = new Int32Array(matches.length);
    for (let index = matches.length - 1; index >= 0; index--) {
      nextMatch[index] = following;
      if (matches[index] >= 0) following = matches[index];
    }
    let preceding = -1;
    for (const [index, position] of matches.entries()) {
      if (position >= 0) {
        oldMatches.set(position, oldNodes[index]);
        preceding = position;
        continue;
      }
      const ghosts = oldGhosts(oldNodes[index]);
      if (!ghosts.length) continue;
      const slot = nextMatch[index] >= 0 ? nextMatch[index] : preceding + 1;
      if (!gaps.has(slot)) gaps.set(slot, []);
      for (const ghost of ghosts) gaps.get(slot).push(ghost);
    }

    const nodes = [];
    for (const [index, node] of newNodes.entries()) {
      for (const ghost of gaps.get(index) ?? []) nodes.push(ghost);
      const old = oldMatches.get(index);
      const children = old ? merge(old.children, node.children) : node.children;
      nodes.push(children === node.children ? node : { ...node, children });
    }
    return nodes.concat(gaps.get(newNodes.length) ?? []);
  }

  const specs = [];
  const placed = new Set();
  function collectPlaced(nodes) {
    for (const node of nodes) {
      placed.add(node.rid);
      collectPlaced(node.children);
    }
  }
  for (const pair of specPairs) {
    let tree = merge(specNodes(pair.before), specNodes(pair.after));
    if (!tree.length && !pair.after) continue;
    const spec = pair.after ?? pair.before;
    const title = spec.tree[0];
    if (title?.docTitle) {
      if (pair.after) tree = [{ ...title, children: tree }];
      else {
        const rid = unusedId(ghostKey);
        displayNodes.set(rid, { ...before.displayNodes.get(title.rid), rid });
        tree = [{ ...title, key: ghostKey--, rid, children: tree }];
      }
    }
    specs.push({ ...spec, tree });
    collectPlaced(tree);
  }
  const unplaced = [];
  for (const entry of entries) {
    if (placed.has(entry.rid)) continue;
    const item = entry.after ?? entry.before;
    unplaced.push({ key: ghostKey--, rid: entry.rid, wid: item.wid, title: item.title,
      type_name: item.type_name, ghost: !entry.after, unplaced: true, children: [] });
  }
  if (unplaced.length) specs.push({ name: "未列入规格目录", tree: unplaced });
  return { model: { ...after, objects, displayNodes, specs }, byRid };
}

function compareBodyText(attribute) {
  if (attribute.kind !== "xhtml") return attribute.value;
  const template = document.createElement("template");
  template.innerHTML = attribute.html;
  const body = template.content;
  for (const element of body.querySelectorAll("br,p,div,li,pre,blockquote,h1,h2,h3,h4,h5,h6,tr")) {
    element.before("\n");
    element.after("\n");
  }
  for (const element of body.querySelectorAll("td,th")) element.after("  ");
  for (const image of body.querySelectorAll("img")) image.replaceWith("[" + (image.alt || "图片") + "]");
  return body.textContent.split("\n").map(line => line.replace(/\s+/g, " ").trim()).filter(Boolean).join("\n");
}

function comparableValue(attribute) {
  if (attribute.kind === "enumeration") return [...new Set(attribute.labels)].sort();
  if (attribute.kind === "boolean") return attributeText(attribute);
  return compareBodyText(attribute);
}

function fieldContent(attributes) {
  if (!attributes) return { text: null, signature: "" };
  const parts = attributes.map(attribute => [attribute.kind, comparableValue(attribute)]);
  return {
    text: parts.map(([, value]) => Array.isArray(value) ? value.join(" · ") : value).join("\n"),
    signature: JSON.stringify(parts.map(part => JSON.stringify(part)).sort()),
  };
}

function matchingFieldValues(before, after) {
  if (!before || !after || before.length !== after.length) return false;
  return before.every((value, index) => {
    const other = after[index];
    if (value.kind !== other.kind || value.value !== other.value) return false;
    if (value.kind === "xhtml") return value.html === other.html;
    if (value.kind === "enumeration") return JSON.stringify(value.labels) === JSON.stringify(other.labels);
    return true;
  });
}

function compareFields(before, after, common) {
  const changes = [];
  const oldId = foreignId(before) || before.rid;
  const newId = foreignId(after) || after.rid;
  if (oldId !== newId) changes.push({ name: "工作项 ID", before: oldId, after: newId });
  if (before.title !== after.title) changes.push({ name: "标题", before: before.title, after: after.title });
  if (before.type_name !== after.type_name) changes.push({ name: "工作项类型", before: before.type_name, after: after.type_name });
  const previous = groupBy(before.attrs, attribute => attribute.name);
  const current = groupBy(after.attrs, attribute => attribute.name);
  const body = new Set([...bodyAttributes(before, ""), ...bodyAttributes(after, "")].map(attribute => attribute.name));
  for (const name of new Set([...previous.keys(), ...current.keys()])) {
    if (identityFields.has(name) || !common.has(name)) continue;
    const old = previous.get(name), next = current.get(name);
    if (matchingFieldValues(old, next)) continue;
    const oldContent = fieldContent(old), newContent = fieldContent(next);
    if (oldContent.signature === newContent.signature) continue;
    const field = { name: body.has(name) ? "正文 · " + name : name, before: oldContent.text, after: newContent.text };
    if (field.before === field.after) {
      field.before += "（" + old.map(attribute => attribute.kind).join(" / ") + "）";
      field.after += "（" + next.map(attribute => attribute.kind).join(" / ") + "）";
    }
    changes.push(field);
  }
  return changes;
}

async function buildComparison(before, after, progress) {
  await progress("对齐工作项");
  const matches = pairItems(before.objects, after.objects);
  const { entries } = matches;
  const pairs = pairSpecs(before.specs, after.specs);
  const outline = comparisonOutline(before, after, matches, pairs);
  const common = new Set([...before.fieldNames].filter(name => after.fieldNames.has(name)));
  const counts = Object.fromEntries(Object.keys(compareStates).map(status => [status, 0]));
  const notes = [];
  if (pairs.some(pair => pair.before?.name !== pair.after?.name)) {
    notes.push("规格名称或范围不同，请核对导出范围。");
  }
  for (const [old, next, label] of [[before, after, "仅旧版字段"], [after, before, "仅新版字段"]]) {
    const names = [...old.fieldNames].filter(name => !next.fieldNames.has(name) && !identityFields.has(name)).sort();
    if (names.length) notes.push(label + "（不计为工作项修改）：" + names.join("、"));
  }

  await progress("对比工作项", 0, entries.length);
  for (const entry of entries) {
    const { before: old, after: next } = entry;
    if (!old) entry.status = "added";
    else if (!next) entry.status = "removed";
    else {
      entry.fields = compareFields(old, next, common);
      entry.status = entry.fields.length ? "modified" : "unchanged";
    }
    counts[entry.status]++;
    await progress("对比工作项", entry.index + 1, entries.length);
  }
  if (counts.removed) notes.push(oldOnlyNote);
  if (entries.some(entry => entry.duplicateId)) notes.push(duplicateIdNote);
  return { before, after, entries, ...outline, counts, notes, changesOnly: false, filter: "" };
}

function comparisonFields(entry) {
  const { before, after } = entry;
  if (before && after) return entry.fields;
  const fields = [];
  const item = after ?? before;
  const field = (name, text) => ({ name, before: before ? text : null, after: after ? text : null });
  if (item.title) fields.push(field("标题", item.title));
  for (const [name, attributes] of groupBy(item.attrs, attribute => attribute.name)) {
    if (!identityFields.has(name)) fields.push(field(name, fieldContent(attributes).text));
  }
  return fields;
}

function compareTextParts(before, after) {
  let start = 0, end = 0;
  if (before !== null && after !== null) {
    const length = Math.min(before.length, after.length);
    while (start < length && before[start] === after[start]) start++;
    if (/[\uD800-\uDBFF]/.test(before[start - 1] ?? "")) start--;
    while (end < length - start && before.at(-1 - end) === after.at(-1 - end)) end++;
    if (/[\uDC00-\uDFFF]/.test(before[before.length - end] ?? "")) end--;
  }
  const split = value => value === null ? ["", "未提供", ""] :
    [value.slice(0, start), value.slice(start, value.length - end), value.slice(value.length - end)];
  return [split(before), split(after)];
}
