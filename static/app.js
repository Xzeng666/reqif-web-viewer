
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

function initFileInput() {
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
  message.classList.remove("err");
  message.textContent = "正在解析 " + file.name + "…";
  show("fileMessage", true);
  try {
    const model = await readReqif(file);
    enterViewer(model);
    show("fileMessage", false);
  } catch (error) {
    message.classList.add("err");
    message.textContent = error.message || "无法打开文件";
  } finally {
    opening = false;
    $("btnOpen").disabled = false;
  }
}

function enterViewer(model) {
  STATE.model?.dispose();
  STATE.model = model;
  STATE.activeRid = null;
  STATE.activeKey = null;
  STATE.filters = [];
  clearTimeout(filterTimer);
  $("fileInfo").textContent = model.source;
  $("fileInfo").title = model.source;
  $("filterChips").replaceChildren();
  $("searchInput").value = "";
  $("detail").replaceChildren();
  $("docPanelBody").replaceChildren();
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
  DOC.loaded = false;
  DOC.items = [];
  DOC.index.clear();
  DOC.scrollTop = 0;
  $("docSpacer").style.height = "0";
  clearDocBlocks();
  renderTree(model.specs);
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
}

function switchView(next) {
  if (!STATE.model) return;
  const scroll = $("docScroll");
  if (view === "doc" && DOC.loaded) DOC.scrollTop = scroll.scrollTop;
  view = next;
  const isDocument = view === "doc";
  $("right").classList.toggle("docmode", isDocument);
  show("docWrap", isDocument);
  show("docPanel", false);
  show("detail", !isDocument && !!STATE.activeRid);

  if (isDocument) {
    if (!DOC.loaded) buildDoc(documentItems(STATE.model));
    else {
      scroll.scrollTop = DOC.scrollTop;
      const index = DOC.index.get(STATE.activeKey);
      if (index === undefined) renderWindow();
      else doJumpToIndex(index, false);
    }
  } else if (STATE.activeRid) {
    renderDetail(STATE.model.objects.get(STATE.activeRid), STATE.activeRid);
  }
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

function renderTree(specs) {
  STATE.nodes = new Map();
  STATE.firstNode = new Map();
  const host = $("tree");
  host.replaceChildren();
  for (const spec of specs) {
    const heading = document.createElement("div");
    heading.className = "spec-name";
    heading.textContent = spec.name;
    host.appendChild(heading);
    for (const node of spec.tree) host.appendChild(buildNode(node, 0, null));
  }
}

function buildNode(n, depth, parent) {
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
  if (n.wid) {
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
  badge.textContent = n.type_name || "";
  label.appendChild(badge);

  row.appendChild(label);

  var kids = null;
  if (hasKids) {
    kids = document.createElement("div");
    kids.className = "node-children";
    n.children.forEach(function (c) { kids.appendChild(buildNode(c, depth + 1, n.key)); });
  }

  STATE.nodes.set(n.key, { kids, caret, row, parent, children: n.children });
  const first = STATE.firstNode.get(n.rid);
  if (first === undefined || n.key < first) STATE.firstNode.set(n.rid, n.key);
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
  if (deep) node.children.forEach(child => setExpand(child.key, open, true));
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
  while (parent != null) {
    setExpand(parent, true);
    parent = STATE.nodes.get(parent).parent;
  }
  markActive(rid, key);
}

function openItem(rid, key = STATE.firstNode.get(rid)) {
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
    renderDetail(STATE.model.objects.get(rid), rid);
  }
}

function renderAttrsInto(d, it, skipText = false) {
  var attrs = it.attrs.filter(function (a) { return a.kind !== "xhtml"; });
  if (attrs.length) {
    var tbl = document.createElement("table");
    tbl.className = "attr-table";
    attrs.forEach(function (a) {
      var tr = document.createElement("tr");
      var th = document.createElement("th");
      th.textContent = a.name;
      var td = document.createElement("td");
      td.textContent = a.value === null || a.value === "" ? "—" : a.value;
      tr.appendChild(th); tr.appendChild(td);
      tbl.appendChild(tr);
    });
    d.appendChild(tbl);
  }

  const richAttrs = it.attrs.filter(a => a.kind === "xhtml" && a.html.trim() &&
    !(skipText && a.name === "ReqIF.Text"));
  richAttrs.forEach(function (a) {
    var h = document.createElement("div");
    h.className = "section-h";
    h.textContent = a.name;
    d.appendChild(h);
    var box = document.createElement("div");
    box.className = "rich";
    box.innerHTML = a.html;
    d.appendChild(box);
  });

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
  var d = $("detail");
  d.innerHTML = "";

  var h1 = document.createElement("h1");
  if (!it) {
    h1.textContent = rid;
    d.append(h1, "该引用在文件中没有对应的工作项");
    return;
  }
  h1.textContent = (it.wid || "内部标识 " + it.rid) + (it.title ? "　" + it.title : "");
  d.appendChild(h1);

  var meta = document.createElement("div");
  meta.className = "meta";
  meta.innerHTML = "类型: <b>" + esc(it.type_name) + "</b>" +
    (it.fallback ? " · <b>提示：该工作项无 Work Item ID，以上为内部标识</b>" : "");
  d.appendChild(meta);

  renderAttrsInto(d, it);
  $("right").scrollTop = 0;
}

function esc(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

const docObserver = new ResizeObserver(entries => {
  for (const { target } of entries) {
    const index = Number(target.dataset.index);
    if (DOC.rendered.get(index) === target) correctHeight(index, target.offsetHeight);
  }
});

function clearDocBlocks() {
  docObserver.disconnect();
  DOC.rendered.forEach(element => element.remove());
  DOC.rendered.clear();
}

function buildDoc(items) {
  DOC.loaded = true;
  DOC.items = items;
  DOC.index = new Map(items.map((item, index) => [item.key, index]));
  clearDocBlocks();
  DOC.scrollTop = 0;

  var n = items.length;
  DOC.heights = new Array(n);
  DOC.offs = new Array(n + 1);
  DOC.offs[0] = 0;
  for (var i = 0; i < n; i++) {
    DOC.heights[i] = estimateHeight(items[i]);
    DOC.offs[i + 1] = DOC.offs[i] + DOC.heights[i];
  }
  DOC.total = DOC.offs[n];
  $("docSpacer").style.height = DOC.total + "px";
  $("docScroll").scrollTop = 0;
  show("docEmpty", !n);
  if (!n) return;
  renderWindow();
  const selected = DOC.index.get(STATE.activeKey);
  if (selected !== undefined) {
    doJumpToIndex(selected, false);
    return;
  }
  const firstText = items.findIndex(item => item.kind === "text");
  const scroll = $("docScroll");
  if (firstText >= 0 && DOC.offs[firstText] > scroll.clientHeight * 0.6) {
    doJumpToIndex(firstText, false);
  }
}

function estimateHeight(it) {
  if (!it.desc_len) return 56;
  var lines = Math.ceil(it.desc_len / 60);
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
    if (it.wid) {
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

  if (it.desc_html && it.desc_html.trim()) {
    var body = document.createElement("div");
    body.className = "rich";
    body.innerHTML = it.desc_html;
    el.appendChild(body);
  }
  el.addEventListener("click", event => {
    if (!event.target.closest("a")) selectDocBlock(i);
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
  $("docPanelTitle").textContent = [item.num, item.wid || item.rid, item.title].filter(Boolean).join(" ");
  const body = $("docPanelBody");
  body.replaceChildren();
  renderAttrsInto(body, STATE.model.objects.get(item.rid), true);
  body.scrollTop = 0;
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
  var input = $("searchInput");
  input.addEventListener("input", function () {
    var q = input.value.trim();
    show("searchClear", !!q);
    scheduleFilterQuery();
  });
  $("searchClear").addEventListener("click", function () {
    input.value = "";
    show("searchClear", false);
    runQuery();
  });
}

function scheduleFilterQuery() {
  clearTimeout(filterTimer);
  filterTimer = setTimeout(runQuery, 300);
}

function runQuery() {
  if (!STATE.model) return;
  const query = $("searchInput").value.trim();
  if (!query && !STATE.filters.some(filter => filter.value)) {
    show("searchResults", false);
    show("tree", true);
    return;
  }
  renderResults(searchItems(STATE.model, query, STATE.filters));
}

function renderResults(items) {
  var box = $("searchResults");
  box.innerHTML = "";
  show("tree", false);
  show("searchResults", true);
  if (!items.length) {
    box.innerHTML = '<div class="search-empty">没有匹配的工作项</div>';
    return;
  }
  var head = document.createElement("div");
  head.className = "search-empty";
  head.style.padding = "6px";
  head.textContent = "匹配 " + items.length + " 项";
  box.appendChild(head);
  items.forEach(function (it) {
    var row = document.createElement("div");
    row.className = "node-row" + (it.rid === STATE.activeRid ? " active" : "");
    row.dataset.rid = it.rid;
    var w = document.createElement("div");
    w.className = "wid";
    w.textContent = it.wid || ("内部:" + it.rid.slice(0, 13) + "…");
    row.appendChild(w);
    var t = document.createElement("div");
    t.className = "res-title";
    t.textContent = it.title || "(无标题)";
    row.appendChild(t);
    row.addEventListener("click", function () { openItem(it.rid); });
    box.appendChild(row);
  });
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
    mode: isEnum ? "enum" : "text", value: "",
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
    var valBtn = document.createElement("span");
    valBtn.className = "chip-val";
    valBtn.textContent = "选择…";
    valBtn.style.cursor = "pointer";
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
    shown.slice(0, 300).forEach(function (v) {
      var it = document.createElement("div");
      it.className = "menu-item" + (v === f.value ? " on" : "");
      var t = document.createElement("span");
      t.textContent = v;
      t.title = v;
      it.appendChild(t);
      it.addEventListener("click", function () {
        f.value = v;
        f.valBtn.textContent = v;
        f.valBtn.title = f.attr + " = " + v;
        show("comboMenu", false);
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
