# omv-audit Output Contract

Audit session 结束时必须产出以下内容。

## 1. 更新后的 Evidence.v1 文件

直接修改 `.omv/findings/<id>.yaml`。不要输出独立的 YAML 块——写入文件，然后用 `omv findings validate <id>` 确认。

字段填写状态分类：
- **已填**：有具体值（非 `unknown`，非空）
- **confirmed unknown**：已搜索仍无法确定，在 `provenance.unverified_fields` 中列出
- **blocked reason**：因此字段无法填写而导致 blocked，在 `blockers` 中说明

## 2. Audit 摘要（人类可读）

紧接文件更新后输出，格式如下：

```
## Audit 结论：<confirmed | blocked | candidate（低分）>

**Readiness：<N>/100**

### 证据链
- Source：<file:line — 一句话描述>
- Sink：<file:line — 一句话描述>
- Guard：<不存在 / 存在但可绕过 — 说明 / 有效>
- 置信度：<high | medium | low>

### 复现步骤
<reproducer 字段内容>

### CVSS
<vector> → <score> (<severity>)

### 去重
<NVD/GHSA/生态系统 搜索结论，或 "发现疑似重复：CVE-XXXX-XXXXX">

### 阻断原因（blocked 时）
- <blocker 1>
- <blocker 2>

### 下一步
<confirmed: 运行 /omv-report | blocked: 补充 X 后重试 | candidate: 缺少 X、Y 字段>
```

## 3. 三种结论的字段完整性要求

### confirmed
所有以下字段必须为非 `unknown`：
- `versions.tested`
- `evidence.source`、`evidence.sink`、`evidence.guard`
- `evidence.reproducer`（不得为 `"none"`）
- `evidence.observed_result`
- `cvss.vector`、`cvss.score`、`cvss.severity`
- `dedup.nvd_searched`、`dedup.ghsa_searched`、`dedup.ecosystem_db_searched`（均为 true）

`omv findings validate <id>` 必须输出 OK（readiness ≥ 75）。

### blocked
`blockers` 列表必须非空，每条说明具体原因。`status` 设为 `blocked`。  
`omv findings validate <id>` 预期输出 FAIL——这是正确行为，不是错误。

### candidate（低分，保留）
不修改 `status`，在摘要中列出缺失字段清单和每项的补充建议。
