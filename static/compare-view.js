"use strict";

function initComparison() {
  const dialog = $("compareDialog");
  const actions = $("compareActions");
  const trigger = $("compareActionTrigger");
  const fields = [
    { side: "before", label: "旧版", input: $("compareOldFile"), button: $("chooseCompareOld") },
    { side: "after", label: "新版", input: $("compareNewFile"), button: $("chooseCompareNew") },
  ];
  let versions;

  function updatePicker() {
    for (const { side, button } of fields) {
      button.title = versions[side]?.name ?? versions[side]?.source ?? "";
      button.querySelector(".compare-file-name").textContent = button.title || "拖入或选择文件";
    }
    $("startCompare").disabled = !versions.before || !versions.after;
  }
  function openPicker() {
    if (opening) return;
    versions = { before: STATE.comparison?.before, after: STATE.comparison?.after ?? STATE.model };
    show("compareError", false);
    updatePicker();
    dialog.showModal();
  }
  function pickerError(message) {
    $("compareError").textContent = message;
    show("compareError", true);
  }

  for (const { side, input, button } of fields) {
    const select = file => {
      versions[side] = file;
      show("compareError", false);
      updatePicker();
    };
    button.addEventListener("click", () => input.click());
    input.addEventListener("change", () => {
      if (input.files.length) select(input.files[0]);
      input.value = "";
    });
    button.addEventListener("dragover", event => {
      event.preventDefault();
      event.dataTransfer.dropEffect = "copy";
      button.classList.add("drag");
    });
    button.addEventListener("dragleave", event => {
      if (!button.contains(event.relatedTarget)) button.classList.remove("drag");
    });
    button.addEventListener("drop", event => {
      event.preventDefault();
      event.stopPropagation();
      button.classList.remove("drag");
      if (event.dataTransfer.files.length === 1) select(event.dataTransfer.files[0]);
      else pickerError("每个版本请选择一个文件。");
    });
  }

  $("compareWelcome").addEventListener("click", openPicker);
  $("compareCurrent").addEventListener("click", openPicker);
  $("compareReplace").addEventListener("click", openPicker);
  actions.addEventListener("click", event => {
    if (!event.target.closest("button")) return;
    actions.open = false;
    trigger.focus();
  }, true);
  document.addEventListener("click", event => {
    if (actions.open && !actions.contains(event.target)) actions.open = false;
  });
  document.addEventListener("keydown", event => {
    if (event.key !== "Escape" || !actions.open) return;
    actions.open = false;
    trigger.focus();
  });
  $("closeCompare").addEventListener("click", () => dialog.close());
  enableDialogDismiss(dialog);
  dialog.addEventListener("close", () => { if (!dialog.open) versions = null; });
  $("startCompare").addEventListener("click", async () => {
    if (opening || !versions?.before || !versions.after) return;
    const selected = versions;
    const loaded = [];
    dialog.close();
    try {
      await withLoading("版本对比", async progress => {
        const sources = [];
        for (const { side, label } of fields) {
          const value = selected[side];
          await progress("读取" + label);
          try {
            sources.push(value instanceof File ? await inspectReqif(value) : value);
          } catch (error) {
            throw new Error(label + " · " + error.message);
          }
        }
        const size = sources.reduce((total, source) => total + source.xmlSize, 0);
        if (size >= 128 * 1024 * 1024) {
          $("loadingNote").textContent = "两份 XML 共 " + Math.round(size / 1024 / 1024) + " MiB，加载可能需要一些时间。";
          show("loadingNote", true);
        }
        const models = [];
        for (const [index, source] of sources.entries()) {
          if (!source.file) {
            models.push(source);
            continue;
          }
          const { label } = fields[index];
          try {
            const model = await readReqifSource(source, (stage, done, total) =>
              progress(label + " · " + stage, done, total));
            loaded.push(model);
            models.push(model);
          } catch (error) {
            throw new Error(label + " · " + error.message);
          }
        }
        const result = await buildComparison(models[0], models[1], progress);
        await enterViewer(result.model, progress, result);
      });
      trigger.focus();
    } catch (error) {
      versions = selected;
      pickerError(error.message || "无法对比文件");
      dialog.showModal();
    } finally {
      for (const model of loaded) {
        if (model.assets !== STATE.model?.assets && model !== STATE.comparison?.before) model.assets.dispose();
      }
    }
  });

  $("compareChangesOnly").addEventListener("change", event => {
    STATE.comparison.changesOnly = event.target.checked;
    changeComparisonFilter("");
  });
  $("compareSummary").addEventListener("click", event => {
    const status = event.target.closest("button")?.dataset.compare;
    if (!status) return;
    const result = STATE.comparison;
    if (status === "unchanged") result.changesOnly = false;
    changeComparisonFilter(result.filter === status ? "" : status);
  });
  $("compareExit").addEventListener("click", async () => {
    if (opening) return;
    const model = STATE.comparison.after;
    try {
      await withLoading(model.source, progress => enterViewer(model, progress));
      $("compareCurrent").focus();
    } catch (error) {
      showFileError(error);
    }
  });
  $("compareCsv").addEventListener("click", () => exportComparison("csv"));
  $("compareHtml").addEventListener("click", () => exportComparison("html"));
}

function updateComparisonControls() {
  const result = STATE.comparison;
  $("topbar").classList.toggle("comparing", !!result);
  $("compareActions").open = false;
  show("compareCurrent", !!STATE.model && !result);
  show("compareBar", !!result);
  show("compareSummary", !!result);
  show("compareTools", !!result);
  show("statBtn", !result);
  if (!result) return;
  show("statWarn", false);
  for (const [id, source] of [["compareOldName", result.before.source], ["compareNewName", result.after.source]]) {
    $(id).textContent = source;
    $(id).title = source;
  }
  $("compareSummary").replaceChildren(...Object.keys(compareStates).map(status => {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.compare = status;
    return button;
  }));
  updateComparisonSummary();
}

function comparisonCountLabel(status, count) {
  const [symbol, label] = compareStates[status];
  return (symbol ? symbol + " " : "") + count + " " + label;
}

function updateComparisonSummary(results = null) {
  const { changesOnly, filter, counts, byRid } = STATE.comparison;
  const totals = results ? Object.fromEntries(Object.keys(counts).map(status => [status, 0])) : counts;
  for (const { item } of results ?? []) {
    const entry = byRid.get(item.rid);
    if (entry) totals[entry.status]++;
  }
  $("compareChangesOnly").checked = changesOnly;
  for (const button of $("compareSummary").children) {
    const status = button.dataset.compare;
    const selected = status === filter;
    button.textContent = comparisonCountLabel(status, totals[status]);
    button.disabled = totals[status] === 0 && !selected;
    button.setAttribute("aria-pressed", String(selected));
  }
}

function comparisonMatches(rid) {
  const { byRid, filter, changesOnly } = STATE.comparison;
  const entry = byRid.get(rid);
  if (filter) return entry?.status === filter;
  return !changesOnly || (!!entry && entry.status !== "unchanged");
}

function filterComparisonOutline() {
  if (!STATE.comparison) return;
  const context = new Set();
  for (const entry of [...STATE.nodes.values()].reverse()) {
    entry.visible = context.has(entry) || comparisonMatches(entry.node.rid);
    entry.row.parentElement.hidden = !entry.visible;
    if (entry.visible && entry.parent && !context.has(entry.parent)) {
      context.add(entry.parent);
      if (STATE.comparison.changesOnly || STATE.comparison.filter) setExpand(entry.parent.node.key, true);
    }
  }
  for (const section of $("tree").children) {
    section.hidden = [...section.children].slice(1).every(node => node.hidden);
  }
}

function viewerDocumentItems() {
  const items = documentItems(STATE.model, $("bodySelect").value);
  if (!STATE.comparison) return items;
  return items.filter(item => comparisonMatches(item.rid) ||
    (item.kind === "heading" && STATE.nodes.get(item.key)?.visible));
}

function changeComparisonFilter(filter) {
  STATE.comparison.filter = filter;
  filterComparisonOutline();
  if (STATE.activeRid && !STATE.nodes.get(STATE.activeKey)?.visible) {
    STATE.activeRid = STATE.activeKey = null;
    show("docPanel", false);
    show("detail", false);
    show("detailEmpty", true);
    positionAttributeSettings(null);
    markActive(null, null);
  }
  if (view === "doc") refreshBody();
  else {
    resetDocument();
    refreshBodySearch();
  }
  renderSearchSidebar();
}

function compareEntry(rid) {
  const entry = STATE.comparison?.byRid.get(rid);
  return entry && entry.status !== "unchanged" ? entry : null;
}

function markComparison(element, rid, host = element) {
  const entry = compareEntry(rid);
  if (!entry) return;
  const [symbol, label] = compareStates[entry.status];
  const mark = document.createElement("span");
  element.dataset.compare = mark.dataset.compare = entry.status;
  mark.className = "compare-mark";
  mark.title = label;
  mark.setAttribute("aria-label", label);
  mark.textContent = symbol;
  (host ?? element).prepend(mark);
}

function comparisonValues(entry, { before, after }) {
  const render = ([prefix, change, suffix], tag) => {
    const highlight = change ? `<${tag}>${esc(change)}</${tag}>` : "";
    return esc(prefix) + highlight + esc(suffix) || "空值";
  };
  if (!entry.before) return [render(["", after, ""], "ins")];
  if (!entry.after) return [render(["", before, ""], "del")];
  const [old, next] = compareTextParts(before, after);
  return [render(old, "del"), render(next, "ins")];
}

function renderComparisonDetail(host, entry) {
  const summary = document.createElement("p");
  summary.className = "compare-detail-status";
  summary.textContent = compareStates[entry.status][1];
  markComparison(summary, entry.rid);
  host.append(summary);
  if (entry.duplicateId || entry.status === "removed") {
    const note = document.createElement("p");
    note.className = "muted";
    note.textContent = entry.duplicateId ? duplicateIdNote : oldOnlyNote;
    host.append(note);
  }
  if (entry.before && entry.after) {
    host.insertAdjacentHTML("beforeend",
      '<div class="compare-values compare-column-labels"><strong>旧版</strong><strong>新版</strong></div>');
  }
  const fields = comparisonFields(entry).map(field => {
    const cells = comparisonValues(entry, field).map(value => `<div>${value}</div>`).join("");
    return `<section class="compare-field"><h3>${esc(field.name)}</h3><div class="compare-values">${cells}</div></section>`;
  });
  host.insertAdjacentHTML("beforeend", fields.join(""));
}

function quoteCsv(value) {
  const text = String(value ?? "");
  const literal = /^\s*[=+@-]/.test(text) ? "'" + text : text;
  return '"' + literal.replaceAll('"', '""') + '"';
}

function csvComparisonRow(entry) {
  const { before, after } = entry;
  const fields = before && after ? comparisonFields(entry) : [{
    name: "标题", before: before?.title, after: after?.title,
  }];
  const summary = side => fields.map(field => (field[side] ?? "").replace(/\s+/g, " ").slice(0, 140)).join(" | ");
  return [entry.id, compareStates[entry.status][1], (after ?? before).title,
    fields.map(field => field.name).join("、"), summary("before"), summary("after")].map(quoteCsv).join(",") + "\r\n";
}

function htmlComparisonRow(entry) {
  const title = esc(entry.id + " · " + (entry.after ?? entry.before).title);
  const label = compareStates[entry.status][1];
  const fields = comparisonFields(entry).map(field => {
    const columns = comparisonValues(entry, field).map((value, index, values) => {
      if (values.length === 1) return `<div>${value}</div>`;
      return `<div><small>${index ? "新版" : "旧版"}</small><div>${value}</div></div>`;
    });
    return "<section><h3>" + esc(field.name) + '</h3><div class="values">' + columns.join("") + "</div></section>";
  });
  return "<details><summary><b>" + label + "</b> " + title + "</summary>" + fields.join("") + "</details>";
}

function htmlComparisonHeader(result) {
  const counts = Object.keys(compareStates).map(status =>
    comparisonCountLabel(status, result.counts[status])).join(" · ");
  const notes = result.notes.map(note => "<li>" + esc(note) + "</li>").join("");
  return `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>ReqIF 版本对比</title><style>
body{margin:24px auto;padding:0 16px;max-width:1100px;font:14px/1.6 "Segoe UI","Microsoft YaHei",sans-serif;color:#24292f}
h1{color:#1f3a5f}details{border:1px solid #d0d7de;border-radius:6px;margin:8px 0;padding:8px 12px}
summary{cursor:pointer}summary b{color:#1f3a5f}h3{font-size:14px;margin:10px 0 4px}
.values{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
.values>div{background:#f6f8fa;padding:8px;white-space:pre-wrap;overflow-wrap:anywhere}
.values>:only-child{grid-column:1/-1}
small{color:#57606a}del{background:#ffebe9;color:#a12822}ins{background:#dafbe1;color:#116329;text-decoration:none}
@media(max-width:520px){.values{grid-template-columns:1fr}}
</style><body><h1>ReqIF 版本对比</h1>
<p>旧版 ${esc(result.before.source)} → 新版 ${esc(result.after.source)}</p><p>${counts}</p>
${notes ? "<ul>" + notes + "</ul>" : ""}`;
}

async function exportComparison(format) {
  if (opening) return;
  const result = STATE.comparison;
  const csv = format === "csv";
  const entries = result.entries.filter(entry => entry.status !== "unchanged");
  try {
    await withLoading(csv ? "导出 CSV" : "HTML 报告", async progress => {
      const parts = [csv ? "\uFEFFID,状态,标题,变化字段,旧值摘要,新值摘要\r\n" : htmlComparisonHeader(result)];
      const row = csv ? csvComparisonRow : htmlComparisonRow;
      for (const [index, entry] of entries.entries()) {
        parts.push(row(entry));
        await progress("生成报告", index + 1, entries.length);
      }
      if (!csv) parts.push(entries.length ? "</body></html>" : "<p>未发现差异。</p></body></html>");
      const type = csv ? "text/csv;charset=utf-8" : "text/html;charset=utf-8";
      downloadBlob(new Blob(parts, { type }), "reqif-diff." + format);
    });
  } catch (error) {
    showFileError(error);
  }
}
