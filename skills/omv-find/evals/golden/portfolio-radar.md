| 排名 | 项目 | 生态 | 仓库 | Registry | Stars | 最近维护 | 规模估计 | 输入面 | 风险证据 | 可能方向 | 推荐切入 | 评分 | Portfolio lane | Playbooks | Diff/novelty | Duplicate risk | Audit readiness |
|---|---|---|---|---|---:|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | synthetic-md-preview | npm | https://github.com/example/synthetic-md-preview | npmjs.com/package/synthetic-md-preview | 420 | 2026-04 | cloc: 9k LOC | markdown preview input | source markdown body -> sink renderHtml() -> guard sanitizer config allows raw HTML in src/render.ts#renderPreview | XSS / renderer | src/render.ts#renderPreview | 82/100 | fast-win | renderer-pipeline | novelty: no close advisory found in fixture search | low | high; local test: unit test raw HTML fixture; blocker: plugin config matrix 未确认 |
| 2 | synthetic-archive-lab | go | https://github.com/example/synthetic-archive-lab | pkg.go.dev/example/synthetic-archive-lab | 180 | 2026-03 | tokei: 18k LOC | archive entry names | source zip entry name -> sink os.WriteFile in extract/archive.go#Extract -> guard base-prefix check happens before symlink resolution | Path Traversal / Zip Slip | extract/archive.go#Extract | 77/100 | deep-audit | archive-extractor | diff signal: 未确认; reachability crosses CLI and library API | medium | medium; local test: fixture archive with symlink path; blocker: symlink policy 未确认 |
| 3 | synthetic-importer-kit | python | https://github.com/example/synthetic-importer-kit | pypi.org/project/synthetic-importer-kit | 95 | 2026-02 | find/wc: 6k LOC | uploaded import bundles | source uploaded filename -> sink pathlib write in importer/files.py#save_member -> guard rejects .. but not absolute Windows paths | upload / traversal | importer/files.py#save_member | 74/100 | underrated | upload-handler, archive-extractor | novelty: low stars but verified fixture dependents; diff-alert absent | low | high; local test: unit test absolute path fixture; blocker: Windows path handling 未确认 |

**Lane summary**

- fast-win: synthetic-md-preview has one file/function, one guard, and a direct unit test path.
- deep-audit: synthetic-archive-lab needs multi-file reachability review before confidence is high.
- underrated: synthetic-importer-kit has modest stars but a verified fixture downstream signal.

**Audit readiness**

- synthetic-md-preview: high; entry src/render.ts#renderPreview; local test with a raw HTML markdown fixture; expected guard is sanitizer escaping before render.
- synthetic-archive-lab: medium; harness around extract/archive.go#Extract; expected guard is normalize then base-prefix check after symlink resolution.
- synthetic-importer-kit: high; unit test importer/files.py#save_member; expected guard rejects absolute and parent paths.

**Duplicate and novelty notes**

Fixture advisory search found no matching package + vulnerability class + sink behavior for synthetic-md-preview or synthetic-importer-kit. synthetic-archive-lab has medium duplicate risk because a similar archive issue exists, but the sink behavior and version range are 未确认.

**数据新鲜度与限制**

验证日期: 2026-05-08. Sources used: synthetic fixture registry pages, GitHub fixture metadata, local source snippets. 未确认 fields are kept explicit.
