"use strict";

const translations = {
  "Language": ["语言", "Sprache"],
  "Automatic": ["自动", "Automatisch"],
  "Open file": ["打开文件", "Datei öffnen"],
  "Open the GitHub repository": ["打开 GitHub 仓库", "GitHub-Repository öffnen"],
  "Open the GitHub repository in a new tab": ["在新标签页打开 GitHub 仓库", "GitHub-Repository in einem neuen Tab öffnen"],
  "Add filter": ["添加筛选条件", "Filter hinzufügen"],
  "+ Filter": ["+ 筛选", "+ Filter"],
  "Search IDs, titles or content": ["搜索 ID、标题或内容", "ID, Titel oder Inhalt suchen"],
  "Search work items": ["搜索工作项", "Arbeitselemente suchen"],
  "Clear search": ["清除搜索", "Suche leeren"],
  "Keyword matching": ["关键词匹配方式", "Suchmodus"],
  "Match all": ["全部匹配", "Alle Begriffe"],
  "Match any": ["任一匹配", "Beliebige Begriffe"],
  "Switch view": ["切换视图", "Ansicht wechseln"],
  "Document": ["文档", "Dokument"],
  "Work item": ["工作项", "Einzelansicht"],
  "Old version": ["旧版", "Alte Version"],
  "New version": ["新版", "Neue Version"],
  "Drop a ReqIF or ReqIFz file here": ["拖拽 ReqIF / ReqIFz 文件到此处", "ReqIF- oder ReqIFz-Datei hier ablegen"],
  "Or click “Open file”.": ["也可点击「打开文件」。", "Oder „Datei öffnen“ wählen."],
  "Files are processed in this browser.": ["文件在当前浏览器内处理。", "Dateien werden in diesem Browser verarbeitet."],
  "Compare versions": ["版本对比", "Versionen vergleichen"],
  "Outline": ["目录树", "Gliederung"],
  "Collapse sidebar": ["收起侧栏", "Seitenleiste einklappen"],
  "Drag to resize": ["拖拽调整宽度", "Ziehen, um die Breite zu ändern"],
  "Show outline": ["展开目录树", "Gliederung einblenden"],
  "Body": ["正文", "Text"],
  "Body matches": ["正文搜索定位", "Treffer im Text"],
  "Previous match": ["上一处", "Vorheriger Treffer"],
  "Next match": ["下一处", "Nächster Treffer"],
  "Select a work item on the left": ["从左侧选择工作项", "Links ein Arbeitselement auswählen"],
  "No document content to display": ["当前文件没有可显示的文档内容", "Keine Dokumentinhalte vorhanden"],
  "Expand or collapse panel": ["点击折叠/展开面板", "Bereich ein- oder ausklappen"],
  "Close panel": ["关闭面板", "Bereich schließen"],
  "Field settings": ["属性设置", "Feldeinstellungen"],
  "Show statistics": ["查看详细统计", "Statistik anzeigen"],
  "No file open": ["未导入文件", "Keine Datei geöffnet"],
  "Filter by change status": ["按差异状态筛选", "Nach Änderungsstatus filtern"],
  "Changes only": ["只看变化", "Nur Änderungen"],
  "Comparison actions": ["对比操作", "Vergleichsaktionen"],
  "Replace files": ["更换文件", "Dateien wechseln"],
  "Export CSV": ["导出 CSV", "CSV exportieren"],
  "Export HTML": ["导出 HTML", "HTML exportieren"],
  "Exit comparison": ["退出对比", "Vergleich beenden"],
  "Close": ["关闭", "Schließen"],
  "Drop or select a file": ["拖入或选择文件", "Datei ablegen oder auswählen"],
  "Start comparison": ["开始对比", "Vergleich starten"],
  "Expand entire outline": ["展开整棵目录树", "Gesamte Gliederung ausklappen"],
  "Expand all child levels": ["展开该节点下全部层级", "Alle untergeordneten Ebenen ausklappen"],
  "Expand next level": ["展开该节点的下一层", "Nächste Ebene ausklappen"],
  "Collapse all child levels": ["收起该节点下全部层级", "Alle untergeordneten Ebenen einklappen"],
  "Collapse entire outline": ["收起整棵目录树", "Gesamte Gliederung einklappen"],
  "Open work item details": ["打开工作项详情", "Details zum Arbeitselement öffnen"],
  "Statistics": ["统计信息", "Statistik"],
  "Visible fields": ["显示字段", "Sichtbare Felder"],
  "Reset": ["恢复默认", "Zurücksetzen"],
  "Close field settings": ["关闭属性设置", "Feldeinstellungen schließen"],
  "Close image preview": ["关闭图片预览", "Bildvorschau schließen"],
  "Image zoom": ["图片缩放", "Bildzoom"],
  "Zoom out": ["缩小", "Verkleinern"],
  "Zoom in": ["放大", "Vergrößern"],
  "Image": ["图片", "Bild"],
  "Enlarge image {0}": ["放大图片 {0}", "Bild {0} vergrößern"],
  "Open image preview": ["打开图片预览", "Bildvorschau öffnen"],
  "Table, scroll horizontally": ["表格，可横向滚动", "Tabelle, horizontal scrollbar"],
  "Read failed": ["读取失败", "Lesefehler"],
  "Can't preview {0}": ["无法预览 {0}", "{0} kann nicht angezeigt werden"],
  "Can't open file": ["无法打开文件", "Datei kann nicht geöffnet werden"],
  "Done": ["完成", "Fertig"],
  "Work items: {0}": ["{0} 个工作项", "Arbeitselemente: {0}"],
  "Specifications: {0}": ["{0} 个规格", "Spezifikationen: {0}"],
  "Relations: {0}": ["{0} 个关联", "Beziehungen: {0}"],
  "Attachments: {0}": ["{0} 个附件", "Anhänge: {0}"],
  "Auto-detect": ["自动识别", "Automatisch erkennen"],
  "Building document": ["生成文档", "Dokument wird aufgebaut"],
  "Building outline": ["生成目录", "Gliederung wird aufgebaut"],
  "Internal ID {0}": ["内部标识 {0}", "Interne ID {0}"],
  "(Untitled)": ["（无标题）", "(Ohne Titel)"],
  "Display node": ["展示节点", "Anzeigeknoten"],
  "Relations": ["关联关系", "Beziehungen"],
  "→ Outgoing": ["→ 源出", "→ Ausgehend"],
  "← Incoming": ["← 指向", "← Eingehend"],
  "This reference has no work item in the file": ["该引用在文件中没有对应的工作项", "Zu diesem Verweis gibt es kein Arbeitselement in der Datei"],
  "Type": ["类型", "Typ"],
  "Display title taken from the specification name.": ["文档标题取自规格名称，仅用于展示。", "Anzeigetitel aus dem Spezifikationsnamen."],
  "No work items match the filters": ["没有符合筛选条件的工作项", "Keine Arbeitselemente entsprechen den Filtern"],
  "(No description)": ["（无描述内容）", "(Keine Beschreibung)"],
  "Matches: {0}": ["匹配 {0} 项", "Treffer: {0}"],
  "No matching work items": ["没有匹配的工作项", "Keine passenden Arbeitselemente"],
  "Document title": ["文档标题", "Dokumenttitel"],
  "Document title · Display node": ["文档标题 · 展示节点", "Dokumenttitel · Anzeigeknoten"],
  "Outside the outline": ["未列入规格目录", "Außerhalb der Gliederung"],
  "Select a filter field": ["选择筛选字段", "Filterfeld auswählen"],
  "No more fields to filter": ["没有更多可筛选的属性", "Keine weiteren Filterfelder"],
  "▼ List": ["▼ 下拉", "▼ Liste"],
  "✎ Text": ["✎ 文本", "✎ Text"],
  "Select…": ["选择…", "Auswählen…"],
  "Contains…": ["包含…", "Enthält…"],
  "Remove filter": ["移除筛选", "Filter entfernen"],
  "Search options…": ["搜索选项…", "Optionen suchen…"],
  "Search options for {0}": ["搜索 {0} 选项", "Optionen für {0} suchen"],
  "No matching options": ["无匹配选项", "Keine passenden Optionen"],
  " or ": [" 或 ", " oder "],
  "Item": ["项目", "Eintrag"],
  "Count": ["数量", "Anzahl"],
  "Total work items": ["工作项总数", "Arbeitselemente gesamt"],
  "Specifications": ["规格", "Spezifikationen"],
  "Attachments": ["附件", "Anhänge"],
  "File: {0}": ["文件：{0}", "Datei: {0}"],
  "Yes": ["是", "Ja"],
  "No": ["否", "Nein"],
  "Use field settings to show hidden fields": ["可在属性设置中恢复隐藏字段。", "Felder in den Einstellungen einblenden."],
  "Default": ["默认值", "Standardwert"],
  "Drag to reorder": ["拖动排序", "Zum Sortieren ziehen"],
  "Drag {0} to reorder": ["拖动 {0} 排序", "{0} zum Sortieren ziehen"],
  "Move up": ["上移", "Nach oben"],
  "Move down": ["下移", "Nach unten"],
  "Move {0} up": ["{0}上移", "{0} nach oben verschieben"],
  "Move {0} down": ["{0}下移", "{0} nach unten verschieben"],
  "Body matches: {0}": ["正文 {0} 处", "Texttreffer: {0}"],
  "Body match {0} / {1}": ["正文 {0} / {1}", "Texttreffer {0} / {1}"],
  "Added": ["新增", "Neu"],
  "Old only": ["仅旧版", "Nur alt"],
  "Modified": ["修改", "Geändert"],
  "Unchanged": ["不变", "Unverändert"],
  "Items found only in the older file may have been removed or omitted from the export.": ["仅旧版的工作项可能已删除，也可能未被导出。", "Einträge nur in der älteren Datei wurden möglicherweise entfernt oder beim Export ausgelassen."],
  "Duplicate ForeignIDs were left unmatched.": ["重复的 ForeignID 未自动匹配。", "Doppelte ForeignIDs wurden nicht zugeordnet."],
  "Work item ID": ["工作项 ID", "Arbeitselement-ID"],
  "Title": ["标题", "Titel"],
  "Work item type": ["工作项类型", "Arbeitselementtyp"],
  "Matching work items": ["对齐工作项", "Arbeitselemente werden zugeordnet"],
  "Specification names or scopes differ. Check the export scope.": ["规格名称或范围不同，请核对导出范围。", "Namen oder Umfang der Spezifikationen weichen ab. Exportumfang prüfen."],
  "Fields only in the older file (excluded from comparison): {0}": ["仅旧版字段（不计为工作项修改）：{0}", "Felder nur in der älteren Datei (vom Vergleich ausgenommen): {0}"],
  "Fields only in the newer file (excluded from comparison): {0}": ["仅新版字段（不计为工作项修改）：{0}", "Felder nur in der neueren Datei (vom Vergleich ausgenommen): {0}"],
  "Comparing work items": ["对比工作项", "Arbeitselemente werden verglichen"],
  "Not provided": ["未提供", "Nicht vorhanden"],
  "Select one file per version.": ["每个版本请选择一个文件。", "Pro Version eine Datei auswählen."],
  "The two XML files total {0} MiB. Loading may take a while.": ["两份 XML 共 {0} MiB，加载可能需要一些时间。", "Beide XML-Dateien umfassen {0} MiB. Das Laden kann etwas dauern."],
  "Can't compare files": ["无法对比文件", "Dateien können nicht verglichen werden"],
  "Empty": ["空值", "Leer"],
  "ReqIF version comparison": ["ReqIF 版本对比", "ReqIF-Versionsvergleich"],
  "HTML report": ["HTML 报告", "HTML-Bericht"],
  "Status": ["状态", "Status"],
  "Changed fields": ["变化字段", "Geänderte Felder"],
  "Old value summary": ["旧值摘要", "Alter Wert (Auszug)"],
  "New value summary": ["新值摘要", "Neuer Wert (Auszug)"],
  "Generating report": ["生成报告", "Bericht wird erstellt"],
  "No differences found.": ["未发现差异。", "Keine Unterschiede gefunden."],
  "Can't read the ReqIF XML character encoding": ["无法读取 ReqIF XML 的字符编码", "Zeichenkodierung der ReqIF-XML-Datei nicht lesbar"],
  "A ReqIF file must not contain a DTD": ["ReqIF 文件不能包含 DTD", "Eine ReqIF-Datei darf keine DTD enthalten"],
  "Can't parse ReqIF XML. Check the file format.": ["无法解析 ReqIF XML，请检查文件格式", "ReqIF-XML kann nicht gelesen werden. Dateiformat prüfen."],
  "Parsing XML": ["解析文档", "XML wird eingelesen"],
  "Attachment": ["附件", "Anhang"],
  "[Missing attachment: {0}]": ["[缺失附件：{0}]", "[Fehlender Anhang: {0}]"],
  "Download {0}": ["下载 {0}", "{0} herunterladen"],
  "Only .reqif and .reqifz files are supported": ["仅支持 .reqif / .reqifz 文件", "Es werden nur .reqif- und .reqifz-Dateien unterstützt"],
  "File exceeds 512 MiB": ["文件超过 512 MiB", "Die Datei ist größer als 512 MiB"],
  "ReqIFz contains multiple .reqif files": ["ReqIFz 包含多个 .reqif 文件", "ReqIFz enthält mehrere .reqif-Dateien"],
  "No .reqif file in the ReqIFz archive": ["ReqIFz 中没有 .reqif 文件", "Keine .reqif-Datei im ReqIFz-Archiv"],
  "ReqIF XML exceeds 200 MiB": ["ReqIF XML 超过 200 MiB", "ReqIF-XML ist größer als 200 MiB"],
  "Reading file": ["读取文件", "Datei wird gelesen"],
  "Reading attributes": ["读取属性", "Attribute werden gelesen"],
  "(Unnamed attribute)": ["（未命名属性）", "(Unbenanntes Attribut)"],
  "(Unknown attribute)": ["（未知属性）", "(Unbekanntes Attribut)"],
  "(Unknown type)": ["（未知类型）", "(Unbekannter Typ)"],
  "Internal ID": ["内部标识", "Interne ID"],
  "Reading work items": ["解析工作项", "Arbeitselemente werden gelesen"],
  "No work items (SPEC-OBJECT) in the ReqIF file": ["ReqIF 中没有工作项（SPEC-OBJECT）", "Keine Arbeitselemente (SPEC-OBJECT) in der ReqIF-Datei"],
  "The ReqIF hierarchy exceeds 512 levels": ["ReqIF 文档层级超过 512 层", "Die ReqIF-Hierarchie hat mehr als 512 Ebenen"],
  "Reading outline": ["整理目录", "Gliederung wird gelesen"],
  "(Unnamed specification)": ["（未命名文档）", "(Unbenannte Spezifikation)"],
  "All work items": ["全部工作项", "Alle Arbeitselemente"],
  "No specification hierarchy. Showing the work item list.": ["文件不含规格层级，已按工作项列表展示", "Keine Spezifikationshierarchie. Die Arbeitselementliste wird angezeigt."],
  "Work items using internal IDs: {0}": ["{0} 个工作项使用内部标识", "Arbeitselemente mit internen IDs: {0}"],
  "Unsupported rich text elements removed: {0}": ["已移除 {0} 个不支持的富文本元素", "Entfernte nicht unterstützte Rich-Text-Elemente: {0}"],
  "Unavailable attachment references: {0}": ["{0} 个附件引用不可用", "Nicht verfügbare Anhangsverweise: {0}"],
  "Linking work items": ["建立关联", "Arbeitselemente werden verknüpft"],
  "Verifying document": ["校验文档", "Dokument wird geprüft"],
  "ReqIFz archive is damaged or invalid": ["ReqIFz 压缩包已损坏或格式无效", "Das ReqIFz-Archiv ist beschädigt oder ungültig"],
  "Split archives and ZIP64 central directories are unsupported": ["不支持分卷或使用 ZIP64 中央目录的 ReqIFz", "Geteilte Archive und ZIP64-Zentralverzeichnisse werden nicht unterstützt"],
  "ReqIFz directory is too large": ["ReqIFz 目录过大", "Das ReqIFz-Verzeichnis ist zu groß"],
  "Uncompressed ReqIFz exceeds 500 MiB": ["ReqIFz 解压后超过 500 MiB", "Das entpackte ReqIFz ist größer als 500 MiB"],
  "Encrypted ReqIFz entries are unsupported": ["不支持加密的 ReqIFz 条目", "Verschlüsselte ReqIFz-Einträge werden nicht unterstützt"],
  "Reading document": ["读取文档", "Dokument wird gelesen"],
  "This browser can't decompress ReqIFz. Use a newer browser.": ["当前浏览器无法解压 ReqIFz，请使用新版浏览器", "Dieser Browser kann ReqIFz nicht entpacken. Einen neueren Browser verwenden."],
  "Decompressing document": ["解压文档", "Dokument wird entpackt"],
  "Unsupported compression method in ReqIFz": ["不支持该 ReqIFz 条目的压缩方式", "Nicht unterstützte Komprimierungsmethode in ReqIFz"],
};

const languageStorageKey = "reqif-viewer-language";
const localizedElements = new WeakMap();
const localizedAttributes = [
  ["data-i18n", "textContent"], ["data-i18n-title", "title"],
  ["data-i18n-label", "aria-label"], ["data-i18n-placeholder", "placeholder"],
];

function translate(message, ...values) {
  const language = document.documentElement.lang;
  const index = language === "zh-CN" ? 0 : language === "de" ? 1 : -1;
  const text = translations[message]?.[index] ?? message;
  return values.length ? text.replace(/\{(\d+)\}/g, (token, position) => values[position] ?? token) : text;
}

function localize(element, update) {
  element.dataset.localized = "";
  localizedElements.set(element, update);
  update();
}

function localizeText(element, message, ...values) {
  localize(element, () => { element.textContent = translate(message, ...values); });
}

function localName(item) {
  return item.nameKey ? translate(item.nameKey) : item.name;
}

function typeCaption(name) {
  return name || translate("(Unknown type)");
}

function initLanguage() {
  const menu = document.getElementById("languageMenu");
  const trigger = menu.querySelector("summary");
  const options = Array.from(menu.querySelectorAll("button"));
  let preference;
  try { preference = localStorage.getItem(languageStorageKey); } catch {}
  if (!options.some(option => option.value === preference)) preference = "auto";

  const update = () => {
    const system = navigator.language.split("-")[0].toLowerCase();
    const selected = preference !== "auto" ? preference : system === "zh" ? "zh-CN" : system === "de" ? "de" : "en";
    document.documentElement.lang = selected;
    for (const [attribute, target] of localizedAttributes) {
      for (const element of document.querySelectorAll("[" + attribute + "]")) {
        const text = translate(element.getAttribute(attribute));
        if (target === "textContent") element.textContent = text;
        else element.setAttribute(target, text);
      }
    }
    for (const element of document.querySelectorAll("[data-localized]")) localizedElements.get(element)?.();
    for (const option of options) option.setAttribute("aria-pressed", String(option.value === preference));
    trigger.title = translate("Language") + " · " + options.find(option => option.value === selected).textContent.trim();
  };

  menu.addEventListener("click", event => {
    const option = event.target.closest("button");
    if (!option) return;
    preference = option.value;
    try { localStorage.setItem(languageStorageKey, preference); } catch {}
    update();
    menu.open = false;
    trigger.focus();
  });
  document.addEventListener("click", event => {
    if (!menu.contains(event.target)) menu.open = false;
  }, true);
  document.addEventListener("keydown", event => {
    if (event.key !== "Escape" || !menu.open) return;
    menu.open = false;
    trigger.focus();
  });
  window.addEventListener("languagechange", () => {
    if (preference === "auto") update();
  });
  update();
}
