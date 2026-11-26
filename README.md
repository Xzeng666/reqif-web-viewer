# ReqIF Web Viewer

**English** · [简体中文](README.zh-CN.md)

A read-only viewer for local ReqIF and ReqIFz files. Browse requirements, search content, and compare two versions in your browser.

[Open viewer](https://xzeng666.github.io/reqif-web-viewer/) · [Project overview](https://xzeng666.github.io/projects/reqif-web-viewer/)

## Open a file

Click **打开文件** (Open file) or drop a file onto the viewer. To use it offline, extract the source and open `index.html` in a modern browser.

- Browse specifications in the document view or open individual work items to inspect attributes and relations.
- Search by ID, title, or content. Use **上一处 / 下一处** (Previous / Next) to step through body matches. Filters use OR within a dropdown and AND across fields.
- Use the gear in the work item panel to choose and reorder fields. Attribute tables mark inherited defaults and preserve source time zones.
- Zoom and pan images, scroll wide tables, and download archive attachments. The bottom-left statistics count source work items once, even when referenced in multiple specifications.

## Compare versions

Click **版本对比** (Compare versions) and select the older and newer files. If a file is already open, the bottom-right entry uses it as the newer version. Select a work item to see changes side by side, or use the counts at the bottom to filter by status. Export a CSV or an offline HTML report from **对比操作** (Comparison actions).

Matching uses a unique `ReqIF.ForeignID`, with `IDENTIFIER` as the fallback when a foreign ID is missing. The comparison covers titles, body text, and shared attributes. An item found only in the older file may have been removed or omitted from the newer export.

## Local processing

Parsing, search, comparison, and export run in the browser. Files are never uploaded to a server. External resources in documents are not loaded automatically.

## Supported files

- ReqIF supports string, rich text, enumeration, integer, real, boolean, and date attributes.
- ReqIFz contains one ReqIF file and optional attachments. Deflate archives require browser support for `DecompressionStream` with `deflate-raw`.
- Limits: 512 MiB per file, 200 MiB for XML, and 500 MiB total uncompressed archive size.

## Source

| File | Purpose |
| --- | --- |
| `index.html`, `static/style.css` | Page and styles |
| `static/app.js`, `static/search.js`, `static/attributes.js`, `static/media.js` | Viewer interface |
| `static/reqif.js`, `static/zip.js` | File parsing |
| `static/compare.js`, `static/compare-view.js` | Version matching, display, and export |

## License

[MIT](LICENSE). See the [bundled parser licenses](static/vendor/LICENSE.txt).
