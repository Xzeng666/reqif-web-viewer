"use strict";

const BODY_SEARCH = { pattern: null, hits: [], offsets: new Map(), active: -1, navigation: 0 };

function queryPattern(query) {
  const terms = [...new Set(query.trim().split(/\s+/).filter(Boolean))].sort((a, b) => b.length - a.length);
  return terms.length ? new RegExp(terms.map(term =>
    term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|"), "giu") : null;
}

function highlightBody(block) {
  for (const mark of block.querySelectorAll("mark.body-hit")) {
    const parent = mark.parentNode;
    mark.replaceWith(...mark.childNodes);
    parent.normalize();
  }
  const pattern = BODY_SEARCH.pattern;
  const offset = BODY_SEARCH.offsets.get(block.dataset.searchKey + "|" + block.dataset.bodyIndex);
  if (!pattern || offset === undefined) return;

  const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT);
  const nodes = [];
  let text = "";
  while (walker.nextNode()) {
    nodes.push({ node: walker.currentNode, start: text.length });
    text += walker.currentNode.nodeValue;
  }
  const matches = [...text.matchAll(pattern)];
  for (const { node, start } of nodes) {
    const content = node.nodeValue;
    const fragment = document.createDocumentFragment();
    let position = 0;
    matches.forEach((match, index) => {
      const from = Math.max(0, match.index - start);
      const to = Math.min(content.length, match.index + match[0].length - start);
      if (from >= to) return;
      const mark = document.createElement("mark");
      mark.className = "body-hit" + (offset + index === BODY_SEARCH.active ? " current-hit" : "");
      mark.dataset.hit = offset + index;
      mark.textContent = content.slice(from, to);
      fragment.append(content.slice(position, from), mark);
      position = to;
    });
    if (!position) continue;
    fragment.append(content.slice(position));
    node.replaceWith(fragment);
  }
}

function refreshBodySearch() {
  const pattern = queryPattern($("searchInput").value);
  const previous = BODY_SEARCH.hits[BODY_SEARCH.active];
  const sameQuery = pattern?.source === BODY_SEARCH.pattern?.source;
  BODY_SEARCH.navigation++;
  BODY_SEARCH.pattern = pattern;
  BODY_SEARCH.hits = [];
  BODY_SEARCH.offsets.clear();
  BODY_SEARCH.active = -1;
  let groups = DOC.items;
  if (view !== "doc") {
    const item = currentItem(STATE.activeRid);
    groups = item && !compareEntry(item.rid) ? [{ key: "detail", body: bodyAttributes(item, $("bodySelect").value) }] : [];
  }
  if (pattern) {
    for (const group of groups) {
      group.body.forEach((attribute, attributeIndex) => {
        BODY_SEARCH.offsets.set(group.key + "|" + attributeIndex, BODY_SEARCH.hits.length);
        const count = [...(attribute.text ?? attribute.value).matchAll(pattern)].length;
        for (let index = 0; index < count; index++) {
          BODY_SEARCH.hits.push({ key: String(group.key), attribute: attributeIndex, index });
        }
      });
    }
    if (sameQuery && previous) {
      BODY_SEARCH.active = BODY_SEARCH.hits.findIndex(hit =>
        hit.key === previous.key && hit.attribute === previous.attribute && hit.index === previous.index);
    }
  }
  const host = view === "doc" ? $("docSpacer") : $("detail");
  for (const block of host.querySelectorAll("[data-search-key]")) highlightBody(block);
  updateHitCount();
}

function updateHitCount() {
  const { hits, active, pattern } = BODY_SEARCH;
  show("hitControls", !!pattern);
  show("readerTools", !!pattern || !$("bodyPicker").classList.contains("hidden"));
  $("hitCount").textContent = active < 0 ? "正文 " + hits.length + " 处" :
    "正文 " + (active + 1) + " / " + hits.length;
  $("previousHit").disabled = !hits.length;
  $("nextHit").disabled = !hits.length;
}

async function activateBodyHit(index) {
  const hit = BODY_SEARCH.hits[index];
  if (!hit) return;
  BODY_SEARCH.active = index;
  updateHitCount();
  const navigation = ++BODY_SEARCH.navigation;
  if (view === "doc") {
    const block = DOC.index.get(Number(hit.key));
    if (block === undefined) return;
    selectDocBlock(block, false);
    doJumpToIndex(block, false);
  }
  await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  if (navigation !== BODY_SEARCH.navigation) return;
  const host = view === "doc" ? $("docSpacer") : $("detail");
  for (const mark of host.querySelectorAll("mark.body-hit")) {
    mark.classList.toggle("current-hit", Number(mark.dataset.hit) === index);
  }
  host.querySelector('[data-hit="' + index + '"]')?.scrollIntoView({ block: "center", inline: "nearest" });
  updateHitCount();
}

function focusItemHit(key) {
  const index = BODY_SEARCH.hits.findIndex(hit => hit.key === String(key));
  if (index >= 0) activateBodyHit(index);
}

function initBodySearch() {
  $("previousHit").addEventListener("click", () => {
    const { hits, active } = BODY_SEARCH;
    if (hits.length) activateBodyHit(((active < 0 ? hits.length : active) - 1 + hits.length) % hits.length);
  });
  $("nextHit").addEventListener("click", () => {
    const { hits, active } = BODY_SEARCH;
    if (hits.length) activateBodyHit((active + 1) % hits.length);
  });
  $("right").addEventListener("click", event => {
    const mark = event.target.closest("mark.body-hit");
    if (!mark) return;
    BODY_SEARCH.active = Number(mark.dataset.hit);
    const host = view === "doc" ? $("docSpacer") : $("detail");
    for (const hit of host.querySelectorAll("mark.body-hit")) {
      hit.classList.toggle("current-hit", hit.dataset.hit === mark.dataset.hit);
    }
    updateHitCount();
  });
}
