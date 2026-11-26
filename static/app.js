
"use strict";

const STATE = { model: null, activeRid: null, activeKey: null, filters: [] };
let view = "doc";
let opening = false;

const DOC = {
  loaded: false, items: [], heights: [], offs: [], total: 0,
  rendered: new Map(), index: new Map(), scrollTop: 0,
};
const BUFFER = 8;
let rafPending = false;

function $(id) { return document.getElementById(id); }
function show(id, on) { $(id).classList.toggle("hidden", !on); }

function currentItem(rid) {
  return STATE.model?.objects.get(rid) ?? STATE.model?.displayNodes.get(rid);
}

function initFileInput() {
  $("loadingDialog").addEventListener("cancel", event => event.preventDefault());
  const input = $("fileInput");
  $("btnOpen").addEventListener("click", () => input.click());
  input.addEventListener("change", () => {
    if (input.files.length) openFile(input.files[0]);
    input.value = "";
  });
  const zone = $("dropZone");
  document.body.addEventListener("dragover", event => {
    event.preventDefault();
    if (!STATE.model) zone.classList.add("drag");
  });
  document.body.addEventListener("dragleave", event => {
    if (!event.relatedTarget) zone.classList.remove("drag");
  });
  document.body.addEventListener("drop", event => {
    event.preventDefault();
    zone.classList.remove("drag");
    if (event.dataTransfer.files.length) openFile(event.dataTransfer.files[0]);
  });
}

async function openFile(file) {
  if (opening) return;
  opening = true;
  $("btnOpen").disabled = true;
  const message = $("fileMessage");
  const dialog = $("loadingDialog");
  message.classList.remove("err");
  show("fileMessage", false);
  dialog.title = file.name;
  dialog.showModal();
  let lastStage = "", lastUpdate = 0;
  const progress = async (stage, completed = 0, total = 0) => {
    const now = performance.now();
    if (stage === lastStage && completed !== total && now - lastUpdate < 32) return;
    lastStage = stage;
    lastUpdate = now;
    $("fileStage").textContent = stage;
    const bar = $("fileProgress");
    if (total) {
      bar.max = total;
      bar.value = completed;
      $("filePercent").textContent = Math.floor(completed / total * 100) + "%";
    } else {
      bar.removeAttribute("value");
      $("filePercent").textContent = "";
    }
    await new Promise(resolve => setTimeout(resolve, 0));
  };
  try {
    const model = await readReqif(file, progress);
    await enterViewer(model, progress);
    await progress("完成", 1, 1);
  } catch (error) {
    message.classList.add("err");
    message.textContent = error.message || "无法打开文件";
    show("fileMessage", true);
  } finally {
    opening = false;
    $("btnOpen").disabled = false;
    dialog.close();
  }
}

async function enterViewer(model, progress) {
  $("mediaDialog").close();
  $("attributeDialog").close();
  STATE.model?.assets.dispose();
  STATE.model = model;
  STATE.activeRid = null;
  STATE.activeKey = null;
  STATE.filters = [];
  clearTimeout(filterTimer);
  $("fileInfo").textContent = model.source;
  $("fileInfo").title = model.source;
  $("filterChips").replaceChildren();
  $("searchInput").value = "";
  clearContent($("detail"));
  clearContent($("docPanelBody"));
  $("searchMode").value = "all";
  show("searchMode", false);
  $("docPanel").classList.remove("collapsed");
  for (const id of ["welcome", "docPanel", "filterMenu", "comboMenu", "ctxMenu", "statsModal",
    "searchResults", "searchClear", "detail"]) show(id, false);
  show("viewer", true);
  show("tree", true);
  $("filterBar").classList.remove("hidden");
  $("viewSelect").classList.remove("hidden");

  const { objects, specs, relations, attachments } = model;
  $("statText").textContent = objects.size + " 个工作项 · " + specs.length + " 个规格" +
    (relations ? " · " + relations + " 个关联" : "") + (attachments ? " · " + attachments + " 个附件" : "");
  setWarn(model.warnings);
  $("bodySelect").replaceChildren(new Option("自动识别", ""),
    ...model.bodyFields.map(name => new Option(name, name)));
  initAttributeLayout();
  resetDocument();
  await renderTree(specs, progress);
  await progress("生成文档");
  switchView($("viewSelect").value);
}

function setWarn(warnings) {
  var el = $("statWarn");
  if (warnings && warnings.length) {
    el.textContent = "⚠ " + warnings.join("；");
    el.title = warnings.join("\n");
    show("statWarn", true);
  } else {
    show("statWarn", false);
  }
}

function initViewSwitch() {
  $("viewSelect").addEventListener("change", event => switchView(event.target.value));
  $("bodySelect").addEventListener("change", refreshBody);
}

function locationPath(location) {
  const names = [];
  for (let parent = location.parent; parent; parent = parent.parent) {
    const { title, wid, rid } = parent.node;
    if (!parent.node.docTitle) names.push(title || wid || rid);
  }
  names.push(location.specName);
  return names.reverse().filter((name, index, all) => index === 0 || name !== all[index - 1]).join(" / ");
}

function switchView(next) {
  if (!STATE.model) return;
  if (view === "doc" && DOC.loaded) DOC.scrollTop = $("docScroll").scrollTop;
  view = next;
  const isDocument = view === "doc";
  show("docWrap", isDocument);
  show("docPanel", false);
  show("bodyPicker", isDocument && STATE.model.bodyFields.length > 0);
  show("detailScroll", !isDocument);
  positionAttributeSettings(isDocument ? null : currentItem(STATE.activeRid));
  if (isDocument) {
    showDocument();
  } else {
    show("detailEmpty", !STATE.activeRid);
    show("detail", !!STATE.activeRid);
    if (STATE.activeRid) renderDetail(currentItem(STATE.activeRid), STATE.activeRid);
  }
  refreshBodySearch();
}

function showDocument() {
  const firstOpen = !DOC.loaded;
  if (firstOpen) buildDoc(documentItems(STATE.model, $("bodySelect").value));
  const scroll = $("docScroll");
  scroll.scrollTop = DOC.scrollTop;
  const selected = DOC.index.get(STATE.activeKey);
  if (selected !== undefined) {
    doJumpToIndex(selected, false);
    return;
  }
  renderWindow();
  if (firstOpen) {
    const firstText = DOC.items.findIndex(item => item.kind === "text");
    if (firstText >= 0 && DOC.offs[firstText] > scroll.clientHeight * 0.6) {
      doJumpToIndex(firstText, false);
    }
  }
}

function refreshBody() {
  const scroll = $("docScroll");
  const index = findIndex(scroll.scrollTop);
  const key = DOC.items[index]?.key;
  const offset = scroll.scrollTop - (DOC.offs[index] || 0);
  resetDocument();
  buildDoc(documentItems(STATE.model, $("bodySelect").value));
  const anchor = DOC.index.get(key);
  if (anchor !== undefined) {
    scroll.scrollTop = DOC.offs[anchor] + offset;
    renderWindow();
    scroll.scrollTop = DOC.offs[anchor] + Math.min(offset, DOC.heights[anchor] - 1);
  }
  refreshBodySearch();
  renderWindow();
}

var leftHidden = false;
var LEFT_MIN_W = 220;
var LEFT_MAX_RATIO = 0.6;

function initLeftPanel() {
  $("leftCollapse").addEventListener("click", function () {
    leftHidden = true;
    applyLeftVisible();
  });
  $("leftReveal").addEventListener("click", function () {
    leftHidden = false;
    applyLeftVisible();
  });

  var rz = $("leftResizer");
  rz.addEventListener("mousedown", function (e) {
    e.preventDefault();
    rz.classList.add("dragging");
    document.body.style.userSelect = "none";
    var onMove = function (ev) {
      var rect = $("viewer").getBoundingClientRect();
      var w = Math.max(LEFT_MIN_W,
        Math.min(ev.clientX - rect.left, rect.width * LEFT_MAX_RATIO));
      $("left").style.width = w + "px";
      if (view === "doc") renderWindow();
    };
    var onUp = function () {
      rz.classList.remove("dragging");
      document.body.style.userSelect = "";
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      try { localStorage.setItem("reqif-viewer-sidebar", $("left").style.width); } catch {}
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  });
  var saved = null;
  try { saved = localStorage.getItem("reqif-viewer-sidebar"); } catch {}
  if (saved) $("left").style.width = saved;
  applyLeftVisible();
}

function applyLeftVisible() {
  show("left", !leftHidden);
  show("leftResizer", !leftHidden);
  show("leftReveal", leftHidden);
}

function doJumpToIndex(i, animate) {
  if (!DOC.loaded || i < 0 || i >= DOC.items.length) return;
  var sc = $("docScroll");
  var vh = sc.clientHeight || 600;
  var targetAbs = Math.max(0, DOC.offs[i] - 60);
  var dist = Math.abs(sc.scrollTop - targetAbs);
  if (animate && dist <= vh * 1.5) {

    sc.scrollTo({ top: targetAbs, behavior: "smooth" });
  } else {
    sc.scrollTop = targetAbs;
    renderWindow();
    var passes = 0;
    while (passes++ < 10) {
      var rel, el = DOC.rendered.get(i);
      if (!el || !el.isConnected) { renderWindow(); continue; }
      rel = el.getBoundingClientRect().top - sc.getBoundingClientRect().top;
      if (rel >= -30 && rel <= vh - 30) break;
      var docY = rel + sc.scrollTop;
      var ny = Math.max(0, Math.min(docY - 60, DOC.total - vh));
      if (Math.abs(sc.scrollTop - ny) < 1) break;
      sc.scrollTop = ny;
      renderWindow();
    }
  }
  DOC.rendered.forEach(function (el2, k) {
    el2.classList.toggle("active", k === i);
  });
}

async function renderTree(specs, progress) {
  STATE.nodes = new Map();
  STATE.firstNode = new Map();
  const host = document.createDocumentFragment();
  const count = nodes => nodes.reduce((total, node) => total + 1 + count(node.children), 0);
  const total = specs.reduce((sum, spec) => sum + count(spec.tree), 0);
  await progress("生成目录", 0, total);
  for (const spec of specs) {
    const heading = document.createElement("div");
    heading.className = "spec-name";
    heading.textContent = spec.name;
    host.appendChild(heading);
    const pending = spec.tree.slice().reverse().map(node => ({ node, depth: 0, parent: null, host }));
    while (pending.length) {
      const { node, depth, parent, host: target } = pending.pop();
      target.appendChild(buildNode(node, depth, parent, spec.name));
      const entry = STATE.nodes.get(node.key);
      for (let index = node.children.length - 1; index >= 0; index--) {
        pending.push({ node: node.children[index], depth: depth + 1, parent: entry, host: entry.kids });
      }
      await progress("生成目录", STATE.nodes.size, total);
    }
  }
  $("tree").replaceChildren(host);
}

function buildNode(n, depth, parent, specName) {
  var wrap = document.createElement("div");
  var row = document.createElement("div");
  row.className = "node-row";
  row.dataset.rid = n.rid;
  var hasKids = n.children && n.children.length > 0;

  var caret = document.createElement("span");
  caret.className = "caret" + (hasKids ? " open" : "");
  caret.textContent = hasKids ? "▶" : "";
  row.appendChild(caret);

  var label = document.createElement("span");
  if (n.docTitle) {
    const label = document.createElement("span");
    label.className = "display-label";
    label.textContent = "文档";
    row.appendChild(label);
  } else if (n.wid) {
    var w = document.createElement("span");
    w.className = "wid";
    w.textContent = n.wid;
    label.appendChild(w);
  } else {
    var r = document.createElement("span");
    r.className = "rid";
    r.textContent = "内部:" + n.rid.slice(0, 13) + "…";
    label.appendChild(r);
  }
  var t = document.createElement("span");
  t.className = "ttl";
  t.textContent = n.title || "(无标题)";
  t.title = n.title || "";
  label.appendChild(t);

  var badge = document.createElement("span");
  var tn = (n.type_name || "").toLowerCase();
  badge.className = "badge" + (tn === "heading" ? " heading" : tn.indexOf("info") >= 0 ? " info" : "");
  badge.textContent = n.docTitle ? "展示节点" : n.type_name || "";
  label.appendChild(badge);

  row.appendChild(label);

  const kids = hasKids ? document.createElement("div") : null;
  const entry = { node: n, parent, specName, kids, caret, row };
  STATE.nodes.set(n.key, entry);
  if (!STATE.firstNode.has(n.rid)) STATE.firstNode.set(n.rid, entry);
  if (kids) kids.className = "node-children";
  row.addEventListener("click", () => openItem(n.rid, n.key));
  caret.addEventListener("click", event => {
    event.stopPropagation();
    if (kids) setExpand(n.key, kids.style.display === "none");
  });
  row.addEventListener("contextmenu", event => {
    event.preventDefault();
    showCtxMenu(event.clientX, event.clientY, n.key);
  });
  if (depth >= 1) setExpand(n.key, false);

  wrap.appendChild(row);
  if (kids) wrap.appendChild(kids);
  return wrap;
}

function markActive(rid, key) {
  document.querySelectorAll(".node-row.active").forEach(element => element.classList.remove("active"));
  const row = STATE.nodes.get(key)?.row;
  row?.classList.add("active");
  const result = Array.from($("searchResults").querySelectorAll(".node-row"))
    .find(element => element.dataset.rid === rid);
  result?.classList.add("active");
  if ($("tree").classList.contains("hidden")) result?.scrollIntoView({ block: "nearest" });
  else row?.scrollIntoView({ block: "nearest" });
}

function setExpand(key, open, deep = false) {
  const node = STATE.nodes.get(key);
  if (!node?.kids) return;
  node.kids.style.display = open ? "" : "none";
  node.caret.classList.toggle("open", open);
  if (deep) node.node.children.forEach(child => setExpand(child.key, open, true));
}

function showCtxMenu(x, y, key) {
  var menu = $("ctxMenu");
  menu.dataset.key = key;
  show("ctxMenu", true);
  var mw = menu.offsetWidth, mh = menu.offsetHeight;
  menu.style.left = Math.min(x, window.innerWidth - mw - 8) + "px";
  menu.style.top = Math.min(y, window.innerHeight - mh - 8) + "px";
}

function hideCtxMenu() { show("ctxMenu", false); }

function initCtxMenu() {
  document.addEventListener("click", function (e) {
    if (!$("ctxMenu").classList.contains("hidden") &&
        !$("ctxMenu").contains(e.target)) {
      hideCtxMenu();
      return;
    }
    if ($("ctxMenu").classList.contains("hidden")) return;
    var item = e.target.closest ? e.target.closest(".ctx-item") : null;
    if (!item) return;
    var act = item.dataset.act;
    const key = Number($("ctxMenu").dataset.key);
    hideCtxMenu();
    if (act === "expand-all-tree") {
      STATE.nodes.forEach((node, key) => setExpand(key, true));
    } else if (act === "collapse-all-tree") {
      STATE.nodes.forEach((node, key) => setExpand(key, false));
    } else if (act === "expand-subtree") {
      setExpand(key, true, true);
    } else if (act === "expand-one") {
      setExpand(key, true, false);
    } else if (act === "collapse-subtree") {
      setExpand(key, false, true);
    } else if (act === "open-item") {
      $("viewSelect").value = "workitem";
      const rid = STATE.nodes.get(key).row.dataset.rid;
      selectItem(rid, key);
      switchView("workitem");
    }
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") hideCtxMenu();
  });
  $("tree").addEventListener("scroll", hideCtxMenu);
}

function selectItem(rid, key) {
  STATE.activeRid = rid;
  STATE.activeKey = key;
  let parent = STATE.nodes.get(key)?.parent;
  while (parent) {
    setExpand(parent.node.key, true);
    parent = parent.parent;
  }
  markActive(rid, key);
}

function openItem(rid, key = STATE.firstNode.get(rid)?.node.key) {
  const index = DOC.index.get(key);
  if (view === "doc" && index !== undefined) {
    selectDocBlock(index, true);
    return;
  }
  selectItem(rid, key);
  if (view === "doc") {
    $("viewSelect").value = "workitem";
    switchView("workitem");
  } else {
    renderDetail(currentItem(rid), rid);
    refreshBodySearch();
  }
  focusItemHit("detail");
}

function renderAttrsInto(d, it, body = [], includeBody = false) {
  const attributes = it.attrs.filter(attribute => attribute.kind !== "xhtml" && !body.includes(attribute));
  if (attributes.length) {
    const host = document.createElement("div");
    host.className = "attribute-section";
    host.attributeValues = attributes;
    renderAttributeTable(host);
    d.append(host);
  }

  const additional = it.attrs.filter(attribute => attribute.kind === "xhtml" && attribute.html.trim() &&
    !body.includes(attribute));
  for (const attribute of [...(includeBody ? body : []), ...additional]) {
    const heading = document.createElement("div");
    heading.className = "section-h";
    heading.textContent = attribute.name;
    d.append(heading, renderBody(attribute, includeBody && body.includes(attribute) ? "detail" : null,
      body.indexOf(attribute)));
  }

  if (it.related && it.related.length) {
    var rh = document.createElement("div");
    rh.className = "section-h";
    rh.textContent = "关联关系";
    d.appendChild(rh);
    var ul = document.createElement("ul");
    ul.className = "rel-list";
    it.related.forEach(function (r) {
      var li = document.createElement("li");
      var dir = document.createElement("span");
      dir.className = "dir";
      dir.textContent = r.dir === "out" ? "→ 源出" : "← 指向";
      li.appendChild(dir);
      const other = STATE.model.objects.get(r.rid);
      const link = document.createElement("button");
      link.type = "button";
      link.className = "related-link";
      link.textContent = other?.wid || "内部：" + r.rid;
      link.addEventListener("click", () => openItem(r.rid));
      li.appendChild(link);
      if (other?.title) li.append("　" + other.title);

      ul.appendChild(li);
    });
    d.appendChild(ul);
  }
}

function renderDetail(it, rid) {
  show("detail", true);
  show("detailEmpty", false);
  $("detailScroll").scrollTop = 0;
  const d = $("detail");
  clearContent(d);
  positionAttributeSettings(it);

  var h1 = document.createElement("h1");
  if (!it) {
    h1.textContent = rid;
    d.append(h1, "该引用在文件中没有对应的工作项");
    return;
  }
  if (it.displayOnly) {
    h1.textContent = it.title;
    d.append(h1, displayNotice());
    return;
  }
  h1.textContent = (it.wid || "内部标识 " + it.rid) + (it.title ? "　" + it.title : "");
  d.appendChild(h1);

  var meta = document.createElement("div");
  meta.className = "meta";
  meta.innerHTML = "类型: <b>" + esc(it.type_name) + "</b>" +
    (it.fallback ? " · <b>提示：该工作项无 Work Item ID，以上为内部标识</b>" : "");
  d.appendChild(meta);

  renderAttrsInto(d, it, bodyAttributes(it, $("bodySelect").value), true);
}

function displayNotice() {
  const notice = document.createElement("div");
  notice.className = "meta";
  notice.textContent = "文档标题由规格名称补充，仅用于展示。";
  return notice;
}

function esc(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

const imageObserver = new IntersectionObserver(entries => {
  for (const { target, isIntersecting } of entries) {
    if (!isIntersecting || !target.isConnected) continue;
    imageObserver.unobserve(target);
    loadImage(target);
  }
});

async function loadImage(image) {
  const assets = STATE.model.assets;
  try {
    const url = await assets.image(Number(image.dataset.image));
    if (!image.isConnected || STATE.model.assets !== assets) return;
    image.src = url;
    await image.decode();
  } catch {
    if (image.isConnected) {
      const notice = document.createElement("span");
      notice.className = "miss-attach";
      notice.textContent = "无法预览 " + image.alt;
      image.replaceWith(notice);
    }
  }
}

function unobserveImages(container) {
  for (const image of container.querySelectorAll("[data-image]")) imageObserver.unobserve(image);
}

function clearContent(container) {
  unobserveImages(container);
  container.replaceChildren();
}

function renderBody(attribute, searchKey = null, index = 0) {
  const block = document.createElement("div");
  if (attribute.kind === "xhtml") {
    block.className = "rich";
    block.innerHTML = attribute.html;
    for (const image of block.querySelectorAll("[data-image]")) imageObserver.observe(image);
  } else {
    block.className = "plain-body";
    block.textContent = attribute.value;
  }
  prepareMedia(block);
  if (searchKey !== null) {
    block.dataset.searchKey = searchKey;
    block.dataset.bodyIndex = index;
    highlightBody(block);
  }
  return block;
}

async function downloadAttachment(event) {
  const button = event.target.closest("button[data-download]");
  if (!button || button.disabled) return;
  const assets = STATE.model.assets;
  button.classList.remove("download-error");
  button.disabled = true;
  try {
    const { blob, name } = await assets.download(Number(button.dataset.download));
    if (STATE.model.assets !== assets) return;
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.href = url;
    link.download = name;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  } catch {
    button.classList.add("download-error");
  } finally {
    button.disabled = false;
  }
}

const docObserver = new ResizeObserver(entries => {
  for (const { target } of entries) {
    const index = Number(target.dataset.index);
    if (DOC.rendered.get(index) === target) correctHeight(index, target.offsetHeight);
  }
});

function resetDocument() {
  DOC.loaded = false;
  DOC.items = [];
  DOC.scrollTop = 0;
  DOC.index.clear();
  docObserver.disconnect();
  DOC.rendered.clear();
  clearContent($("docSpacer"));
  $("docSpacer").style.height = "0";
}

function buildDoc(items) {
  DOC.loaded = true;
  DOC.items = items;
  DOC.index = new Map(items.map((item, index) => [item.key, index]));
  DOC.heights = items.map(estimateHeight);
  DOC.offs = [0];
  for (const height of DOC.heights) DOC.offs.push(DOC.offs[DOC.offs.length - 1] + height);
  DOC.total = DOC.offs[items.length];
  $("docSpacer").style.height = DOC.total + "px";
  show("docEmpty", !items.length);
}

function estimateHeight(it) {
  if (!it.length) return 56;
  var lines = Math.ceil(it.length / 60);
  return 60 + lines * 24;
}

function findIndex(y) {
  var lo = 0, hi = DOC.items.length - 1, ans = 0;
  while (lo <= hi) {
    var mid = (lo + hi) >> 1;
    if (DOC.offs[mid] <= y) { ans = mid; lo = mid + 1; } else { hi = mid - 1; }
  }
  return ans;
}

function renderWindow() {
  if (!DOC.loaded || !DOC.items.length) return;
  var sc = $("docScroll");
  var st = sc.scrollTop, vh = sc.clientHeight;
  var start = Math.max(0, findIndex(st) - BUFFER);
  var end = Math.min(DOC.items.length - 1, findIndex(st + vh) + BUFFER);

  DOC.rendered.forEach(function (el, k) {
    if (k < start || k > end) {
      docObserver.unobserve(el);
      unobserveImages(el);
      el.remove();
      DOC.rendered.delete(k);
    }
  });
  var spacer = $("docSpacer");
  for (var i = start; i <= end; i++) {
    if (!DOC.rendered.has(i)) {
      var el = makeBlock(i);
      el.style.transform = "translateY(" + DOC.offs[i] + "px)";
      spacer.appendChild(el);
      DOC.rendered.set(i, el);
      correctHeight(i, el.offsetHeight);
      docObserver.observe(el);
    }
  }
}

function makeBlock(i) {
  var it = DOC.items[i];
  var el = document.createElement("div");
  var lv = Math.min(Math.max(it.level, 1), 6);
  el.className = "doc-block lvl" + lv + " kind-" + it.kind +
    (it.docTitle ? " doc-title-block" : "") +
    (it.key === STATE.activeKey ? " active" : "");
  if (it.kind !== "heading" && lv > 1) {
    el.className += " indent" + (lv - 1);
  }
  el.dataset.index = i;

  if (it.kind === "heading") {
    var head = document.createElement("div");
    head.className = "doc-head";
    if (it.num) {
      var num = document.createElement("span");
      num.className = "doc-num";
      num.textContent = it.num;
      head.appendChild(num);
    }
    var t = document.createElement("span");
    t.className = "doc-title";
    t.textContent = it.title || "(无标题)";
    t.title = it.title || "";
    head.appendChild(t);
    if (it.wid && !it.docTitle) {
      var w = document.createElement("span");
      w.className = "doc-wid";
      w.textContent = it.wid;
      head.appendChild(w);
    }
    el.appendChild(head);
  } else {
    var capText = it.caption || (it.kind === "plain" && !it.title ? "（无描述内容）" : "");
    if (it.wid || capText) {
      var head2 = document.createElement("div");
      head2.className = "doc-head";
      if (it.wid) {
        var w2 = document.createElement("span");
        w2.className = "doc-wid lead";
        w2.textContent = it.wid;
        w2.title = "ReqIF.ForeignID: " + it.wid;
        head2.appendChild(w2);
      }
      if (capText) {
        var c2 = document.createElement("span");
        c2.className = "doc-caption";
        c2.textContent = capText;
        head2.appendChild(c2);
      }
      el.appendChild(head2);
    }
  }

  it.body.forEach((attribute, index) => el.appendChild(renderBody(attribute, it.key, index)));
  el.addEventListener("click", event => {
    if (!event.target.closest("button,img")) selectDocBlock(i);
  });
  return el;
}

function correctHeight(i, h) {
  if (!DOC.loaded) return;
  var old = DOC.heights[i];
  if (h <= 0 || Math.abs(h - old) <= 1) return;
  var oldEnd = DOC.offs[i + 1];
  var delta = h - old;
  DOC.heights[i] = h;
  for (var j = i + 1; j <= DOC.items.length; j++) DOC.offs[j] += delta;
  DOC.total = DOC.offs[DOC.items.length];
  $("docSpacer").style.height = DOC.total + "px";
  DOC.rendered.forEach(function (el, k) {
    if (k > i) el.style.transform = "translateY(" + DOC.offs[k] + "px)";
  });
  var sc = $("docScroll");
  if (sc.scrollTop >= oldEnd) sc.scrollTop += delta;
}

function onDocScroll() {
  if (rafPending) return;
  rafPending = true;
  requestAnimationFrame(function () {
    rafPending = false;
    if (view === "doc") renderWindow();
  });
}

function selectDocBlock(index, fromTree) {
  const item = DOC.items[index];
  selectItem(item.rid, item.key);
  if (fromTree) doJumpToIndex(index, true);
  else DOC.rendered.forEach((element, key) => element.classList.toggle("active", key === index));

  $("docPanel").classList.remove("collapsed");
  $("docPanelCaret").textContent = "▾";
  show("docPanel", true);
  $("docPanelTitle").textContent = item.docTitle ? item.title :
    [item.num, item.wid || item.rid, item.title].filter(Boolean).join(" ");
  const body = $("docPanelBody");
  clearContent(body);
  positionAttributeSettings(currentItem(item.rid));
  if (item.docTitle) body.append(displayNotice());
  else renderAttrsInto(body, currentItem(item.rid), item.body);
  body.scrollTop = 0;
  if (fromTree) focusItemHit(item.key);
}

function initDocPanel() {
  $("docPanelHead").addEventListener("click", function (e) {
    if (e.target === $("docPanelClose") || e.target.parentNode === $("docPanelClose")) return;
    var collapsed = $("docPanel").classList.toggle("collapsed");
    $("docPanelCaret").textContent = collapsed ? "▸" : "▾";
  });
  $("docPanelClose").addEventListener("click", function () {
    show("docPanel", false);
  });
}

var filterTimer = null;

function initSearch() {
  const input = $("searchInput");
  input.addEventListener("input", () => {
    const query = input.value.trim();
    show("searchClear", !!query);
    show("searchMode", /\s/.test(query));
    scheduleFilterQuery();
  });
  $("searchMode").addEventListener("change", runQuery);
  $("searchClear").addEventListener("click", () => {
    input.value = "";
    show("searchClear", false);
    show("searchMode", false);
    runQuery();
    input.focus();
  });
}

function scheduleFilterQuery() {
  clearTimeout(filterTimer);
  filterTimer = setTimeout(runQuery, 300);
}

function runQuery() {
  if (!STATE.model) return;
  const query = $("searchInput").value.trim();
  refreshBodySearch();
  if (!query && !STATE.filters.some(filter => filter.value.length)) {
    show("searchResults", false);
    show("tree", true);
    return;
  }
  renderResults(searchItems(STATE.model, query, STATE.filters, $("searchMode").value), query);
}

function resultExcerpt(text, pattern) {
  const value = text.replace(/\s+/g, " ").trim();
  const match = value.matchAll(pattern).next().value;
  const start = Math.max(0, (match?.index ?? 0) - 36);
  const end = Math.min(value.length, Math.max(start + 110, (match?.index ?? 0) + (match?.[0].length ?? 0)));
  const excerpt = value.slice(start, end);
  const span = document.createElement("span");
  let position = 0;
  if (start) span.append("…");
  for (const hit of excerpt.matchAll(pattern)) {
    const mark = document.createElement("mark");
    mark.textContent = hit[0];
    span.append(excerpt.slice(position, hit.index), mark);
    position = hit.index + hit[0].length;
  }
  span.append(excerpt.slice(position));
  if (end < value.length) span.append("…");
  return span;
}

function renderResults(items, query) {
  const box = $("searchResults");
  const list = document.createDocumentFragment();
  const summary = document.createElement("div");
  summary.className = "result-count";
  summary.textContent = items.length ? "匹配 " + items.length + " 项" : "没有匹配的工作项";
  list.append(summary);
  const pattern = queryPattern(query);

  for (const { item, match } of items) {
    const location = STATE.firstNode.get(item.rid);
    const row = document.createElement("button");
    row.type = "button";
    row.className = "node-row result-row" + (item.rid === STATE.activeRid ? " active" : "");
    row.dataset.rid = item.rid;
    const id = document.createElement("span");
    id.className = "wid";
    id.textContent = item.displayOnly ? "文档标题 · 展示节点" : item.wid || item.rid;
    const title = document.createElement("span");
    title.className = "res-title";
    title.textContent = item.title || "（无标题）";
    const path = document.createElement("span");
    path.className = "result-path";
    path.textContent = location ? locationPath(location) : "未列入规格目录";
    path.title = path.textContent;
    row.append(id, title, path);
    if (match) {
      const snippet = document.createElement("span");
      snippet.className = "result-snippet";
      const field = document.createElement("strong");
      field.textContent = match.name + "　";
      snippet.append(field, resultExcerpt(match.value, pattern));
      row.append(snippet);
    }
    row.addEventListener("click", () => openItem(item.rid, location?.node.key));
    list.append(row);
  }
  box.replaceChildren(list);
  show("tree", false);
  show("searchResults", true);
}

function initFilterBar() {
  $("addFilterBtn").addEventListener("click", function (e) {
    e.stopPropagation();
    if (!STATE.model) return;
    toggleFilterMenu();
  });
  document.addEventListener("click", function (e) {
    var fm = $("filterMenu"), cm = $("comboMenu");
    if (!fm.classList.contains("hidden") &&
        !fm.contains(e.target) && e.target !== $("addFilterBtn")) {
      show("filterMenu", false);
    }
    if (!cm.classList.contains("hidden") && !cm.contains(e.target)) {
      show("comboMenu", false);
    }
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") { show("filterMenu", false); show("comboMenu", false); }
  });
}

function toggleFilterMenu() {
  var fm = $("filterMenu");
  var wasOpen = !fm.classList.contains("hidden");
  show("filterMenu", false);
  if (wasOpen) return;
  fm.innerHTML = "";
  var head = document.createElement("div");
  head.className = "menu-head";
  head.textContent = "选择筛选属性（依据当前文件结构）";
  fm.appendChild(head);
  const added = new Set(STATE.filters.map(filter => filter.attr));
  const list = STATE.model.attrs.filter(attribute => !added.has(attribute.name));
  if (!list.length) {
    var e0 = document.createElement("div");
    e0.className = "menu-item";
    e0.textContent = "没有更多可筛选的属性";
    fm.appendChild(e0);
  }
  list.forEach(function (a) {
    var it = document.createElement("div");
    it.className = "menu-item";
    var nm = document.createElement("span");
    nm.textContent = a.name;
    nm.title = a.name + "（" + a.count + " 个工作项使用）";
    it.appendChild(nm);
    var k = document.createElement("span");
    k.className = "k";
    k.textContent = (a.kind === "enumeration" && a.values && a.values.length) ?
      "▼ 下拉" : "✎ 文本";
    it.appendChild(k);
    it.addEventListener("click", function () {
      show("filterMenu", false);
      addFilterChip(a);
    });
    fm.appendChild(it);
  });
  show("filterMenu", true);
  var r = $("addFilterBtn").getBoundingClientRect();
  fm.style.left = Math.max(8, r.left) + "px";
  fm.style.top = (r.bottom + 6) + "px";
}

function addFilterChip(def) {
  if (STATE.filters.some(function (f) { return f.attr === def.name; })) return;
  var isEnum = def.kind === "enumeration" && def.values && def.values.length;
  var f = {
    attr: def.name,
    mode: isEnum ? "enum" : "text", value: isEnum ? [] : "",
    defValues: isEnum ? def.values : [],
  };
  STATE.filters.push(f);
  var chip = document.createElement("div");
  chip.className = "filter-chip";
  var label = document.createElement("span");
  label.className = "chip-label";
  label.textContent = def.name;
  label.title = def.name;
  chip.appendChild(label);
  if (isEnum) {
    var valBtn = document.createElement("button");
    valBtn.type = "button";
    valBtn.className = "chip-val";
    valBtn.textContent = "选择…";
    valBtn.title = def.name;
    chip.appendChild(valBtn);
    f.valBtn = valBtn;
    valBtn.addEventListener("click", function (e) {
      e.stopPropagation();
      openComboMenu(f, valBtn);
    });
  } else {
    var inp = document.createElement("input");
    inp.className = "chip-input";
    inp.placeholder = "包含…";
    inp.addEventListener("input", function () {
      f.value = inp.value.trim();
      scheduleFilterQuery();
    });
    chip.appendChild(inp);
  }
  var x = document.createElement("button");
  x.className = "chip-x";
  x.textContent = "×";
  x.title = "移除筛选";
  x.addEventListener("click", function () {
    STATE.filters = STATE.filters.filter(function (g) { return g !== f; });
    chip.remove();
    show("comboMenu", false);
    runQuery();
  });
  chip.appendChild(x);
  $("filterChips").appendChild(chip);
}

function openComboMenu(f, anchor) {
  var cm = $("comboMenu");
  var wasOpen = !cm.classList.contains("hidden");
  show("comboMenu", false);
  if (wasOpen && cm._owner === f) return;
  cm._owner = f;
  cm.innerHTML = "";
  var sr = document.createElement("div");
  sr.className = "menu-search";
  var inp = document.createElement("input");
  inp.placeholder = "搜索选项…";
  inp.setAttribute("aria-label", "搜索 " + f.attr + " 选项");
  sr.appendChild(inp);
  cm.appendChild(sr);
  var listEl = document.createElement("div");
  cm.appendChild(listEl);
  var render = function (kw) {
    listEl.innerHTML = "";
    var kws = (kw || "").toLowerCase();
    var shown = f.defValues.filter(function (v) {
      return !kws || v.toLowerCase().indexOf(kws) >= 0;
    });
    if (!shown.length) {
      var e0 = document.createElement("div");
      e0.className = "menu-item";
      e0.textContent = "无匹配选项";
      listEl.appendChild(e0);
    }
    shown.forEach(function (v) {
      var it = document.createElement("label");
      it.className = "menu-item combo-option";
      var checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.checked = f.value.includes(v);
      var t = document.createElement("span");
      t.textContent = v;
      t.title = v;
      it.append(checkbox, t);
      checkbox.addEventListener("change", function () {
        if (checkbox.checked) f.value.push(v);
        else f.value = f.value.filter(value => value !== v);
        const selected = f.value.join(" 或 ");
        f.valBtn.textContent = selected || "选择…";
        f.valBtn.title = selected ? f.attr + "：" + selected : f.attr;
        runQuery();
      });
      listEl.appendChild(it);
    });
  };
  render("");
  inp.addEventListener("input", function () { render(inp.value.trim()); });
  show("comboMenu", true);
  var r = anchor.getBoundingClientRect();
  var w = Math.max(240, Math.min(r.width + 80, 360));
  cm.style.width = w + "px";
  cm.style.left = Math.min(r.left, window.innerWidth - w - 12) + "px";
  cm.style.top = (r.bottom + 6) + "px";
  inp.focus();
}

function initStats() {
  $("statBtn").addEventListener("click", function () {
    if (!STATE.model) return;
    renderStats(viewerStats(STATE.model));
    show("statsModal", true);
  });
  $("statsClose").addEventListener("click", function () { show("statsModal", false); });
  $("statsModal").addEventListener("click", function (e) {
    if (e.target === $("statsModal")) show("statsModal", false);
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") show("statsModal", false);
  });
}

function typeBadgeClass(name) {
  var n = (name || "").toLowerCase();
  if (n === "heading") return " heading";
  if (n.indexOf("info") >= 0) return " info";
  return "";
}

function renderStats(s) {
  var b = $("statsBody");
  b.innerHTML = "";
  var tbl = document.createElement("table");
  tbl.innerHTML = "<tr><th>项目</th><th class=\"num\">数量</th></tr>";
  var addRow = function (label, val, cls, badge) {
    var tr = document.createElement("tr");
    if (cls) tr.className = cls;
    var td1 = document.createElement("td");
    if (badge) {
      var sp = document.createElement("span");
      sp.className = "type-badge" + typeBadgeClass(label);
      sp.textContent = label;
      td1.appendChild(sp);
    } else {
      td1.textContent = label;
    }
    var td2 = document.createElement("td");
    td2.className = "num";
    td2.textContent = val;
    tr.appendChild(td1); tr.appendChild(td2);
    tbl.appendChild(tr);
  };
  addRow("工作项总数", s.objects, "stat-sum");
  s.types.forEach(function (t) { addRow(t.name, t.count, "", true); });
  addRow("Specifications", s.specs);
  if (s.relations) addRow("关联关系", s.relations);
  addRow("附件", s.attachments);
  b.appendChild(tbl);
  var src = document.createElement("div");
  src.className = "muted-line";
  src.textContent = "文件：" + s.source;
  b.appendChild(src);
}

initFileInput();
initMedia();
initBodySearch();
initAttributeSettings();
$("right").addEventListener("click", downloadAttachment);
initViewSwitch();
initDocPanel();
initCtxMenu();
initStats();
initSearch();
initFilterBar();
initLeftPanel();
$("docScroll").addEventListener("scroll", onDocScroll);
window.addEventListener("resize", function () {
  if (view === "doc") renderWindow();
});
