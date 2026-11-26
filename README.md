# ReqIF Web Viewer

**English** · [简体中文](README.zh-CN.md)

Read local ReqIF / ReqIFz files in your browser. Browse documents, inspect work items, search content, filter attributes, follow relations, and preview attachments.

[Open viewer](https://xzeng666.github.io/reqif-web-viewer/) · [Project overview](https://xzeng666.github.io/projects/reqif-web-viewer/)

## Usage

Open the viewer and click **打开文件** (Open file), or drag in a file. For offline use, download and extract the source, then open `index.html` in a modern browser.

| Feature | Usage |
| --- | --- |
| Document reading | Navigate the outline, read specifications continuously, and choose a plain text or rich text body field. |
| Work item details | Inspect attributes, content, and incoming or outgoing relations. Follow a relation to open the linked item. |
| Search and filters | Search IDs, titles, and content. Combine attribute filters and choose whether all or any search terms must match. |
| Content navigation | View highlights, match counts, and section paths. Use **上一处 / 下一处** (Previous / Next) to move between matches. |
| Attribute settings | Click the gear at the bottom right of the work item panel to choose fields and reorder them by dragging or using the ↑ / ↓ buttons. |
| Image preview | Click an image to fit it to the window. Zoom with the bottom controls or mouse wheel, and drag to pan. |
| Tables and attachments | Scroll wide tables horizontally within the document. Click other archive attachments to download them. |
| Statistics | Click the bottom left to view counts of source work items, types, specifications, relations, and attachments. |

Filter values within one field use OR; different fields use AND.

Attribute tables mark inherited defaults, preserve source time zones, and show enumeration values separately. Hover over a value to inspect its original content. Supplemental document headings are marked as display nodes and excluded from work item counts.

Close image previews and attribute settings with ×, an outside click, or Esc. Field preferences and sidebar width are saved in the current browser.

## Local processing

File parsing, search, and attachment access run in the browser. File content is never uploaded to a server. Each tab handles its files independently, and external resources in documents are not loaded automatically. Follow your organization's data handling requirements.

## Supported files

- ReqIF supports string, rich text, enumeration, integer, real, boolean, and date attributes.
- ReqIFz must contain one main ReqIF file and may include images and other attachments. Stored and Deflate compression are supported.
- Limits: 512 MiB per file, 200 MiB for XML, and 500 MiB total uncompressed archive size.

Images load when they enter the visible area. Other attachments are read on demand. Opening ReqIFz requires a browser that supports `deflate-raw` in `DecompressionStream`.

## Project structure

| File | Purpose |
| --- | --- |
| `index.html` | Page entry point |
| `static/app.js` | Outline, views, and interface interactions |
| `static/reqif.js` | ReqIF parsing, attribute defaults, and statistics |
| `static/zip.js` | ReqIFz reading and decompression |
| `static/search.js` | Content highlighting and match navigation |
| `static/attributes.js` | Attribute formatting and display settings |
| `static/media.js` | Image previews and table scrolling |
| `static/style.css` | Page styles |

## License

[MIT](LICENSE)
