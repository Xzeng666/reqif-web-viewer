"use strict";

function initComparison() {
  const dialog = $("compareDialog");
  const actions = $("compareActions");
  const trigger = $("compareActionTrigger");
  const fields = [
    { side: "before", label: "Old version", input: $("compareOldFile"), button: $("chooseCompareOld") },
    { side: "after", label: "New version", input: $("compareNewFile"), button: $("chooseCompareNew") },
  ];
  let versions;

  function updatePicker() {
    for (const { side, button } of fields) {
      button.title = versions[side]?.name ?? versions[side]?.source ?? "";
      const name = button.querySelector(".compare-file-name");
      localize(name, () => { name.textContent = button.title || translate("Drop or select a file"); });
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
  function pickerError(message, version = "") {
    const notice = $("compareError");
    localize(notice, () => {
      notice.textContent = (version ? translate(version) + " · " : "") + translate(message);
    });
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
      else pickerError("Select one file per version.");
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
    let version = "";
    dialog.close();
    try {
      await withLoading(translate("Compare versions"), async progress => {
        const sources = [];
        for (const { side, label } of fields) {
          const value = selected[side];
          version = label;
          await progress("Reading file", 0, 0, label);
          sources.push(value instanceof File ? await inspectReqif(value) : value);
        }
        const size = sources.reduce((total, source) => total + source.xmlSize, 0);
        if (size >= 128 * 1024 * 1024) {
          localizeText($("loadingNote"), "The two XML files total {0} MiB. Loading may take a while.", Math.round(size / 1024 / 1024));
          show("loadingNote", true);
        }
        const models = [];
        for (const [index, source] of sources.entries()) {
          if (!source.file) {
            models.push(source);
            continue;
          }
          const { label } = fields[index];
          version = label;
          const model = await readReqifSource(source, (stage, done, total) => progress(stage, done, total, label));
          loaded.push(model);
          models.push(model);
        }
        version = "";
        const result = await buildComparison(models[0], models[1], progress);
        await enterViewer(result.model, progress, result);
      });
      trigger.focus();
    } catch (error) {
      versions = selected;
      pickerError(error.message || "Can't compare files", version);
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
  return (symbol ? symbol + " " : "") + count + " " + translate(label);
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
    localize(button, () => { button.textContent = comparisonCountLabel(status, totals[status]); });
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
  localize(mark, () => {
    mark.title = translate(label);
    mark.setAttribute("aria-label", mark.title);
  });
  mark.textContent = symbol;
  (host ?? element).prepend(mark);
}

function comparisonValues(entry, { before, after }) {
  const render = ([prefix, change, suffix], tag) => {
    const highlight = change ? `<${tag}>${esc(change)}</${tag}>` : "";
    return esc(prefix) + highlight + esc(suffix) || translate("Empty");
  };
  if (!entry.before) return [render(["", after, ""], "ins")];
  if (!entry.after) return [render(["", before, ""], "del")];
  const [old, next] = compareTextParts(before, after);
  return [render(old, "del"), render(next, "ins")];
}

function renderComparisonDetail(host, entry) {
  const summary = document.createElement("p");
  summary.className = "compare-detail-status";
  const label = document.createElement("span");
  localizeText(label, compareStates[entry.status][1]);
  summary.append(label);
  markComparison(summary, entry.rid);
  host.append(summary);
  if (entry.duplicateId || entry.status === "removed") {
    const note = document.createElement("p");
    note.className = "muted";
    localizeText(note, entry.duplicateId ? duplicateIdNote : oldOnlyNote);
    host.append(note);
  }
  const content = document.createElement("div");
  localize(content, () => {
    const labels = entry.before && entry.after
      ? `<div class="compare-values compare-column-labels"><strong>${translate("Old version")}</strong><strong>${translate("New version")}</strong></div>`
      : "";
    const fields = comparisonFields(entry).map(field => {
      const cells = comparisonValues(entry, field).map(value => `<div>${value}</div>`).join("");
      return `<section class="compare-field"><h3>${esc(field.name)}</h3><div class="compare-values">${cells}</div></section>`;
    });
    content.innerHTML = labels + fields.join("");
  });
  host.append(content);
}

function quoteCsv(value) {
  const text = String(value ?? "");
  const literal = /^\s*[=+@-]/.test(text) ? "'" + text : text;
  return '"' + literal.replaceAll('"', '""') + '"';
}

function csvComparisonRow(entry) {
  const { before, after } = entry;
  const fields = before && after ? comparisonFields(entry) : [{
    name: translate("Title"), before: before?.title, after: after?.title,
  }];
  const summary = side => fields.map(field => (field[side] ?? "").replace(/\s+/g, " ").slice(0, 140)).join(" | ");
  return [entry.id, translate(compareStates[entry.status][1]), (after ?? before).title,
    fields.map(field => field.name).join("、"), summary("before"), summary("after")].map(quoteCsv).join(",") + "\r\n";
}

function htmlComparisonRow(entry) {
  const title = esc(entry.id + " · " + (entry.after ?? entry.before).title);
  const label = translate(compareStates[entry.status][1]);
  const fields = comparisonFields(entry).map(field => {
    const columns = comparisonValues(entry, field).map((value, index, values) => {
      if (values.length === 1) return `<div>${value}</div>`;
      return `<div><small>${translate(index ? "New version" : "Old version")}</small><div>${value}</div></div>`;
    });
    return "<section><h3>" + esc(field.name) + '</h3><div class="values">' + columns.join("") + "</div></section>";
  });
  return "<details><summary><b>" + label + "</b> " + title + "</summary>" + fields.join("") + "</details>";
}

function htmlComparisonHeader(result) {
  const counts = Object.keys(compareStates).map(status =>
    comparisonCountLabel(status, result.counts[status])).join(" · ");
  const notes = result.notes.map(note => "<li>" + esc(translate(...note)) + "</li>").join("");
  const title = translate("ReqIF version comparison");
  return `<!doctype html><html lang="${document.documentElement.lang}"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title><style>
body{margin:24px auto;padding:0 16px;max-width:1100px;font:14px/1.6 "Segoe UI","Microsoft YaHei",sans-serif;color:#24292f}
h1{color:#1f3a5f}details{border:1px solid #d0d7de;border-radius:6px;margin:8px 0;padding:8px 12px}
summary{cursor:pointer}summary b{color:#1f3a5f}h3{font-size:14px;margin:10px 0 4px}
.values{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
.values>div{background:#f6f8fa;padding:8px;white-space:pre-wrap;overflow-wrap:anywhere}
.values>:only-child{grid-column:1/-1}
small{color:#57606a}del{background:#ffebe9;color:#a12822}ins{background:#dafbe1;color:#116329;text-decoration:none}
@media(max-width:520px){.values{grid-template-columns:1fr}}
</style><body><h1>${title}</h1>
<p>${translate("Old version")} ${esc(result.before.source)} → ${translate("New version")} ${esc(result.after.source)}</p><p>${counts}</p>
${notes ? "<ul>" + notes + "</ul>" : ""}`;
}

async function exportComparison(format) {
  if (opening) return;
  const result = STATE.comparison;
  const csv = format === "csv";
  const entries = result.entries.filter(entry => entry.status !== "unchanged");
  try {
    await withLoading(translate(csv ? "Export CSV" : "HTML report"), async progress => {
      const headers = ["ID", "Status", "Title", "Changed fields", "Old value summary", "New value summary"];
      const parts = [csv ? "\uFEFF" + headers.map(text => translate(text)).join(",") + "\r\n" : htmlComparisonHeader(result)];
      const row = csv ? csvComparisonRow : htmlComparisonRow;
      for (const [index, entry] of entries.entries()) {
        parts.push(row(entry));
        await progress("Generating report", index + 1, entries.length);
      }
      if (!csv) parts.push((entries.length ? "" : "<p>" + translate("No differences found.") + "</p>") + "</body></html>");
      const type = csv ? "text/csv;charset=utf-8" : "text/html;charset=utf-8";
      downloadBlob(new Blob(parts, { type }), "reqif-diff." + format);
    });
  } catch (error) {
    showFileError(error);
  }
}
