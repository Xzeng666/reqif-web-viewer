"use strict";

const ATTRIBUTE_LAYOUT = { order: [], hidden: [] };
const attributeStorageKey = "reqif-viewer-attributes";
let attributeDrag = null;

function positionAttributeSettings(item) {
  const available = item?.attrs.some(attribute => attribute.kind !== "xhtml");
  const documentView = view === "doc";
  show("docPanelTools", documentView && !!available);
  show("detailTools", !documentView && !!available);
  if (available) {
    $(documentView ? "docPanelTools" : "detailTools").append($("attributeSettings"));
  }
}

function initAttributeLayout() {
  let saved;
  try { saved = JSON.parse(localStorage.getItem(attributeStorageKey)); } catch {}
  const strings = value => Array.isArray(value) && value.every(item => typeof item === "string");
  const names = STATE.model.attrs.filter(attribute => attribute.kind !== "xhtml").map(attribute => attribute.name);
  ATTRIBUTE_LAYOUT.order = [...new Set([...(strings(saved?.order) ? saved.order : []), ...names])];
  ATTRIBUTE_LAYOUT.hidden = strings(saved?.hidden) ? saved.hidden : [];
}

function attributeText(attribute) {
  const { kind, value } = attribute;
  if (!value) return "—";
  if (kind === "boolean") {
    if (value.trim() === "true" || value.trim() === "1") return "是";
    if (value.trim() === "false" || value.trim() === "0") return "否";
  }
  if (kind === "date") {
    const match = value.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2}:\d{2}(?:\.\d+)?)(Z|[+-]\d{2}:\d{2})?$/);
    if (match) return match[1] + " " + match[2] + (match[3] ? " UTC" + (match[3] === "Z" ? "" : match[3]) : "");
  }
  return value;
}

function renderAttributeTable(host) {
  const ranks = new Map(ATTRIBUTE_LAYOUT.order.map((name, index) => [name, index]));
  const attributes = host.attributeValues.filter(attribute => !ATTRIBUTE_LAYOUT.hidden.includes(attribute.name))
    .sort((a, b) => (ranks.get(a.name) ?? ranks.size) - (ranks.get(b.name) ?? ranks.size));
  host.replaceChildren();
  if (!attributes.length) {
    const notice = document.createElement("p");
    notice.className = "muted";
    notice.textContent = "属性已隐藏，可在右下角设置中重新选择。";
    host.append(notice);
    return;
  }
  const table = document.createElement("table");
  table.className = "attr-table";
  for (const attribute of attributes) {
    const row = table.insertRow();
    const label = document.createElement("th");
    label.scope = "row";
    label.textContent = attribute.name;
    const value = document.createElement("td");
    value.title = attribute.value || "";
    if (attribute.kind === "enumeration" && attribute.labels.length) {
      for (const text of attribute.labels) {
        const chip = document.createElement("span");
        chip.className = "enum-value";
        chip.textContent = text;
        value.append(chip);
      }
    } else {
      value.textContent = attributeText(attribute);
    }
    if (attribute.defaulted) {
      const badge = document.createElement("span");
      badge.className = "default-value";
      badge.textContent = "默认值";
      value.append(badge);
    }
    row.append(label, value);
  }
  host.append(table);
}

function saveAttributeLayout() {
  try { localStorage.setItem(attributeStorageKey, JSON.stringify(ATTRIBUTE_LAYOUT)); } catch {}
  for (const host of document.querySelectorAll(".attribute-section")) renderAttributeTable(host);
}

function renderAttributeSettings() {
  const fields = new Set(STATE.model.attrs.filter(attribute => attribute.kind !== "xhtml")
    .map(attribute => attribute.name));
  const names = ATTRIBUTE_LAYOUT.order.filter(name => fields.has(name));
  const list = $("attributeFields");
  list.replaceChildren();
  for (const [index, name] of names.entries()) {
    const row = document.createElement("div");
    row.className = "attribute-option";
    row.dataset.attribute = name;
    const handle = document.createElement("button");
    handle.type = "button";
    handle.className = "attribute-drag icon-button";
    handle.title = "拖动排序";
    handle.setAttribute("aria-label", "拖动 " + name + " 排序");
    handle.innerHTML = '<svg viewBox="0 0 16 20" aria-hidden="true"><path d="M5 4h.01M11 4h.01M5 10h.01M11 10h.01M5 16h.01M11 16h.01"/></svg>';
    handle.addEventListener("pointerdown", event => {
      if (event.button !== 0) return;
      event.preventDefault();
      handle.focus({ preventScroll: true });
      attributeDrag = { row, name, pointer: event.pointerId, start: event.clientY, y: event.clientY, started: false, frame: null };
      list.setPointerCapture(event.pointerId);
    });
    row.append(handle);
    const label = document.createElement("label");
    const check = document.createElement("input");
    check.type = "checkbox";
    check.checked = !ATTRIBUTE_LAYOUT.hidden.includes(name);
    check.addEventListener("change", () => {
      ATTRIBUTE_LAYOUT.hidden = ATTRIBUTE_LAYOUT.hidden.filter(hidden => hidden !== name);
      if (!check.checked) ATTRIBUTE_LAYOUT.hidden.push(name);
      saveAttributeLayout();
    });
    const title = document.createElement("span");
    title.textContent = name;
    label.append(check, title);
    row.append(label);
    for (const [text, direction] of [["↑", -1], ["↓", 1]]) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "icon-button";
      button.textContent = text;
      button.title = direction < 0 ? "上移" : "下移";
      button.setAttribute("aria-label", name + button.title);
      button.disabled = !names[index + direction];
      button.addEventListener("click", () => moveAttribute(name, direction, text));
      row.append(button);
    }
    list.append(row);
  }
}

function focusAttribute(name, control = "handle") {
  const row = Array.from($("attributeFields").children).find(element => element.dataset.attribute === name);
  if (!row) return;
  const button = Array.from(row.querySelectorAll("button")).find(button => button.textContent === control && !button.disabled);
  (button ?? row.querySelector(".attribute-drag")).focus({ preventScroll: true });
}

function moveAttribute(name, direction, control) {
  const names = Array.from($("attributeFields").children, row => row.dataset.attribute);
  const neighbor = names[names.indexOf(name) + direction];
  if (!neighbor) return;
  const from = ATTRIBUTE_LAYOUT.order.indexOf(name);
  const to = ATTRIBUTE_LAYOUT.order.indexOf(neighbor);
  [ATTRIBUTE_LAYOUT.order[from], ATTRIBUTE_LAYOUT.order[to]] = [ATTRIBUTE_LAYOUT.order[to], ATTRIBUTE_LAYOUT.order[from]];
  saveAttributeLayout();
  renderAttributeSettings();
  focusAttribute(name, control);
}

function placeAttributeRow() {
  const list = $("attributeFields");
  const drag = attributeDrag;
  const next = Array.from(list.children).find(row => {
    if (row === drag.row) return false;
    const bounds = row.getBoundingClientRect();
    return drag.y < bounds.top + bounds.height / 2;
  }) ?? null;
  if (drag.row.nextElementSibling !== next) list.insertBefore(drag.row, next);
}

function scrollAttributeDrag() {
  const drag = attributeDrag;
  if (!drag?.started) return;
  const list = $("attributeFields");
  const bounds = list.getBoundingClientRect();
  if (drag.y < bounds.top + 28) list.scrollTop -= 12;
  else if (drag.y > bounds.bottom - 28) list.scrollTop += 12;
  placeAttributeRow();
  drag.frame = requestAnimationFrame(scrollAttributeDrag);
}

function finishAttributeDrag(commit) {
  const drag = attributeDrag;
  if (!drag) return;
  attributeDrag = null;
  cancelAnimationFrame(drag.frame);
  const list = $("attributeFields");
  if (list.hasPointerCapture(drag.pointer)) list.releasePointerCapture(drag.pointer);
  list.classList.remove("sorting");
  drag.row.classList.remove("dragging");
  if (!drag.started) return;
  if (commit && $("attributeDialog").open) {
    const names = Array.from(list.children, row => row.dataset.attribute);
    const current = new Set(names);
    let index = 0;
    ATTRIBUTE_LAYOUT.order = ATTRIBUTE_LAYOUT.order.map(name => current.has(name) ? names[index++] : name);
    saveAttributeLayout();
  }
  renderAttributeSettings();
  if ($("attributeDialog").open) focusAttribute(drag.name);
}

function initAttributeSettings() {
  $("attributeSettings").addEventListener("click", () => {
    renderAttributeSettings();
    $("attributeDialog").showModal();
  });
  enableDialogDismiss($("attributeDialog"));
  $("attributeDialog").addEventListener("cancel", () => finishAttributeDrag(false));
  $("attributeDialog").addEventListener("close", () => finishAttributeDrag(false));
  $("closeAttributes").addEventListener("click", () => $("attributeDialog").close());
  $("resetAttributes").addEventListener("click", () => {
    ATTRIBUTE_LAYOUT.order = STATE.model.attrs.filter(attribute => attribute.kind !== "xhtml")
      .map(attribute => attribute.name);
    ATTRIBUTE_LAYOUT.hidden = [];
    saveAttributeLayout();
    renderAttributeSettings();
  });
  const list = $("attributeFields");
  list.addEventListener("pointermove", event => {
    const drag = attributeDrag;
    if (!drag || drag.pointer !== event.pointerId) return;
    drag.y = event.clientY;
    if (!drag.started && Math.abs(drag.y - drag.start) >= 4) {
      drag.started = true;
      drag.row.classList.add("dragging");
      list.classList.add("sorting");
      scrollAttributeDrag();
    }
    if (drag.started) placeAttributeRow();
  });
  list.addEventListener("pointerup", event => {
    if (attributeDrag?.pointer === event.pointerId) finishAttributeDrag(true);
  });
  list.addEventListener("pointercancel", () => finishAttributeDrag(false));
  list.addEventListener("lostpointercapture", () => finishAttributeDrag(false));
}
