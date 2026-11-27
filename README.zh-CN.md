# ReqIF Web Viewer

[English](README.md) · **简体中文** · [Deutsch](README.de.md)

在浏览器中只读查看本机的 ReqIF / ReqIFz 文件，支持查看需求、搜索正文和版本对比。

[在线使用](https://xzeng666.github.io/reqif-web-viewer/) · [项目介绍](https://xzeng666.github.io/projects/reqif-web-viewer/)

## 打开文件

点击「打开文件」或拖入文件。离线使用时，解压源码后用现代浏览器打开 `index.html`。

- 在文档视图中按目录查阅各规格，也可打开单个工作项查看属性和关联。
- 搜索 ID、标题或正文，使用「上一处 / 下一处」定位正文命中。同一下拉字段的选项按「或」匹配，不同字段按「且」匹配。
- 点击工作项面板内的齿轮，选择显示字段并排序。属性表标注继承的默认值，日期保留源时区。
- 图片可缩放和平移，宽表格可横向滚动，压缩包附件可下载。左下角统计按源文件对象计算，跨规格引用同一工作项时只计一次。

## 版本对比

点击「版本对比」，分别选择旧版和新版。已打开文件时，右下角的入口会将当前文件作为新版。点选条目可查看左右对照，点击底部状态可筛选。在「对比操作」中导出 CSV 或离线 HTML 报告。

优先按唯一的 `ReqIF.ForeignID` 匹配，缺失时使用 `IDENTIFIER`。对比范围包括标题、正文文本和共有属性。「仅旧版」的条目可能已删除，也可能未被导出。

## 本地处理

解析、搜索、对比和导出均在浏览器中完成，文件不会上传至服务器。文档中的外部资源不会自动加载。

## 文件支持

- ReqIF 支持字符串、富文本、枚举、整数、实数、布尔值和日期属性。
- ReqIFz 包含一个 ReqIF 文件，可附带图片和其他文件。读取 Deflate 压缩包需要浏览器支持 `DecompressionStream` 的 `deflate-raw` 格式。
- 单文件上限为 512 MiB，XML 上限为 200 MiB，压缩包解压总量上限为 500 MiB。

## 项目结构

| 文件 | 用途 |
| --- | --- |
| `index.html`、`static/style.css` | 页面和样式 |
| `static/app.js`、`static/search.js`、`static/attributes.js`、`static/media.js` | 查看器交互 |
| `static/reqif.js`、`static/zip.js` | 文件解析 |
| `static/compare.js`、`static/compare-view.js` | 版本匹配、差异展示和导出 |

## 许可证

[MIT](LICENSE)。内置解析器保留各自的[许可证](static/vendor/LICENSE.txt)。
