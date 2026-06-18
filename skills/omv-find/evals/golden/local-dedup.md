| 排名 | 项目 | 生态 | 仓库 | Registry | Stars | 最近维护 | 规模估计 | 输入面 | 风险证据 | 可能方向 | 推荐切入 | 评分 |
|---|---|---|---|---|---:|---|---|---|---|---|---|---|
| 1 | synthetic-zip-stream | npm | https://github.com/example/synthetic-zip-stream | npmjs.com/package/synthetic-zip-stream | 420 | 2026-04 | cloc: 9k LOC | archive entry names | source zip entry name -> sink fs.createWriteStream in lib/extract.js#writeStream -> guard missing base-prefix check | Path Traversal / Zip Slip | lib/extract.js#writeStream | 79/100 |
| 2 | synthetic-archive-guard | npm | https://github.com/example/synthetic-archive-guard | npmjs.com/package/synthetic-archive-guard | 300 | 2026-03 | tokei: 6k LOC | tar/zip entry path | source entry.path -> sink outputFile() in src/io.js#saveEntry -> guard normalize() present but order 未确认 | Path Traversal | src/io.js#saveEntry | 74/100 |
| 3 | synthetic-tar-entry | npm | https://github.com/example/synthetic-tar-entry | npmjs.com/package/synthetic-tar-entry | 180 | 2026-02 | find/wc: 4k LOC | tar header name | source header.name -> sink fs.writeFile in extract.js#unpack -> guard sanitize() called after join | Path Traversal / Zip Slip | extract.js#unpack | 70/100 |
| 4 | synthetic-untar-cli | npm | https://github.com/example/synthetic-untar-cli | npmjs.com/package/synthetic-untar-cli | 95 | 2026-01 | GitHub estimate: 3k LOC | CLI archive path | source argv path -> sink createWriteStream in cli/extract.js -> guard 未确认 | Path Traversal | cli/extract.js | 63/100 |
| 5 | synthetic-zip-async | npm | https://github.com/example/synthetic-zip-async | npmjs.com/package/synthetic-zip-async | 70 | 2025-12 | cloc: 5k LOC | zip entry name | source entry.fileName -> sink writeEntry in lib/zip.js#writeEntry -> guard checkPath() bypassable on absolute path | Zip Slip | lib/zip.js#writeEntry | 61/100 |
| 6 | synthetic-gzip-pipe | npm | https://github.com/example/synthetic-gzip-pipe | npmjs.com/package/synthetic-gzip-pipe | 55 | 2025-11 | tokei: 2k LOC | gzipped tar name | source stream name -> sink fs.write in src/stream.js -> guard resolve() applied after extraction | Path Traversal | src/stream.js | 58/100 |
| 7 | synthetic-extract-dir | npm | https://github.com/example/synthetic-extract-dir | npmjs.com/package/synthetic-extract-dir | 40 | 2025-10 | find/wc: 2k LOC | archive entry path | source entry.path -> sink mkdirSync/writeFile in lib/dir.js -> guard 未确认 | Path Traversal | lib/dir.js | 52/100 |
| 8 | synthetic-unzip-node | npm | https://github.com/example/synthetic-unzip-node | npmjs.com/package/synthetic-unzip-node | 30 | 2025-09 | GitHub estimate: 1k LOC | zip entry name | source entry.name -> sink writeFile in extract/unzip.js -> guard basename-only check | Zip Slip | extract/unzip.js | 49/100 |

**审计建议**

- synthetic-zip-stream: entry lib/extract.js#writeStream; local test feeds a zip fixture with `../` and absolute path entries, then asserts the resolved output path stays inside the target dir.
- synthetic-archive-guard: entry src/io.js#saveEntry; compare the order of normalize() vs the base-prefix check with a traversal fixture; confirm guard runs before the write.
- synthetic-tar-entry: entry extract.js#unpack; trace whether sanitize() runs before path join; add a unit case with a tar entry containing `../../`.

**数据新鲜度与限制**

验证日期: 2026-06-18. Sources used: sanitized fixture registry/source metadata and local source snippets. 星数与维护时间为 sanitized 测试数据，非真实抓取。`未确认` 字段单独列出，未从记忆推断。

已排除 2 个本地已有 finding 的包（使用 --include-known 可取消排除）。
