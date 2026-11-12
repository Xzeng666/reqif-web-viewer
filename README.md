# ReqIF Web Viewer

在浏览器中查看 ReqIF 和 ReqIFz 需求文件。支持文档大纲、工作项详情、关联关系、全文搜索和属性筛选。ReqIFz 内引用的图片可预览，其他附件可下载。

## 使用

打开 [在线查看器](https://xzeng666.github.io/reqif-web-viewer/)，点击「打开文件」或拖入本机的 `.reqif` 或 `.reqifz` 文件。每个标签页独立处理文件。文件、附件和搜索词都留在当前浏览器中。文档中的外部图片和链接不会被加载。

- 文档视图按顺序显示各规格，自动识别正文，也可手动切换正文字段。
- 搜索支持全部关键词或任一关键词匹配，结果显示命中字段、摘要和章节路径。
- 压缩包里的图片滚动到可见区域时加载，其他附件点击后读取。

离线使用时，下载并解压源码，然后用新版浏览器打开 `index.html`。

## 格式限制

每个 ReqIFz 包应含一个 `.reqif` 主文件，可附带图片和其他文件。支持未加密的单卷 ZIP，条目可为存储或 Deflate 格式，中央目录须为标准 ZIP 格式。单份 XML 上限为 200 MiB，压缩包解压总量上限为 500 MiB。

## 项目结构

| 文件 | 用途 |
| --- | --- |
| `index.html` | 页面入口 |
| `static/app.js` | 界面、交互与文档渲染 |
| `static/reqif.js` | ReqIF 解析、富文本处理与搜索 |
| `static/zip.js` | ReqIFz 解压与校验 |
| `static/style.css` | 页面样式 |

## 部署

将源码推送到 GitHub。在仓库的 **Settings → Pages** 中选择 **Deploy from a branch**，设置为 `main` 和 `/(root)`。后续推送到 `main` 会触发发布。

## 许可证

[MIT](LICENSE)
