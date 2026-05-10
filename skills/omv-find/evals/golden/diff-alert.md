| 排名 | 项目 | 生态 | 仓库 | Registry | Stars | 最近维护 | 规模估计 | 输入面 | 风险证据 | 可能方向 | 推荐切入 | 评分 | Portfolio lane | Playbooks | Diff/novelty | Duplicate risk | Audit readiness |
|---|---|---|---|---|---:|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | synthetic-tar-safe | npm | https://github.com/example/synthetic-tar-safe | npmjs.com/package/synthetic-tar-safe | 610 | 2026-04 | cloc: 12k LOC | tar entry names | source entry.path -> sink fs.writeFile in src/extract.ts#writeEntry -> guard normalizeBase() changed in recent commit | Path Traversal / Zip Slip | src/extract.ts#writeEntry | 84/100 | diff-alert | archive-extractor | diff signal: recent commit fixture-123 changed file src/extract.ts and guard normalizeBase(); novelty: guard regression needs local compare | low | high; local test: harness with ../ tar entry; blocker: symlink handling 未确认 |
| 2 | synthetic-zip-worker | npm | https://github.com/example/synthetic-zip-worker | npmjs.com/package/synthetic-zip-worker | 260 | 2026-03 | GitHub estimate: 21k LOC | zip entry names | source zip entry -> sink outputFile() in lib/zip.js#extractOne -> guard base-dir check present but order 未确认 | Path Traversal / race | lib/zip.js#extractOne | 71/100 | deep-audit | archive-extractor | diff signal: release note mentions extraction rewrite; changed file list 未确认 due request limit | medium | medium; local test: fixture zip with absolute path; blocker: guard order 未确认 |

**Lane summary**

- diff-alert: synthetic-tar-safe has a recent commit and changed file touching the guard around the archive write sink.
- deep-audit: synthetic-zip-worker has release-note evidence but the exact changed file could not be verified within the fetch budget.

**Audit readiness**

- synthetic-tar-safe: high; entry src/extract.ts#writeEntry; local test harness feeds a crafted archive fixture into the extractor; expected guard is normalize then base-prefix check.
- synthetic-zip-worker: medium; entry lib/zip.js#extractOne; local unit test should compare absolute path and parent path cases.

**数据新鲜度与限制**

验证日期: 2026-05-08. Recent commit and release data are sanitized fixture metadata. One changed file list is 未确认 because the diff budget was exhausted; the candidate is not treated as invalid.
