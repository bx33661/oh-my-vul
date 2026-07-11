---
name: omv-audit
description: |
  Deep-audits a candidate finding from an Evidence.v1 file. Use when the user has an omv-find result they want to investigate further, wants to prove or disprove a vulnerability, needs to fill Evidence.v1 fields for omv-report, or invokes `/omv-audit`. Reads .omv/findings/<id>.yaml and produces a confirmed or blocked finding with all required evidence fields populated.
---

# omv-audit

深度审计一个 `candidate` 漏洞发现，填充 Evidence.v1 文件，为 `/omv-report` 做好准备。

Stay in passive research mode: read public source code only. Do not send requests to live services, do not auto-execute PoC code. Local analysis, static reasoning, and local test descriptions are allowed.

## Invocation

```text
/omv-audit <id> [--force]
```

- `<id>` 对应 `.omv/findings/<id>.yaml` 文件
- `--force` 允许重新审计已为 confirmed/blocked 的文件

## Reference Loading

按需加载，不要一次性全读：

- 审计方法论与置信度框架：`references/audit-playbook.md`
- CVSS v3.1 度量决策表：`references/shared/cvss-builder.md`
- 14 个生态的 PatternPack manifest 位于 `references/pattern-packs/`，对应 Markdown registry 位于 `references/patterns/`
- Evidence.v1 字段定义与 evidence/submission 评分规则：`contracts/evidence.v1.yaml`
- ThreatMap.v1 图证据字段：`contracts/threat-map.v1.yaml`
- Verification.v1 对抗复核 sidecar：`contracts/verification.v1.yaml`

## 审计目标

读取 `.omv/findings/<id>.yaml` 后，你的目标是将以下字段填写为具体、可验证的值（非 `unknown`）：

**必填（confirmed 所需）**
- `versions.tested` — 实际测试的版本号
- `evidence.source` — 攻击者可控的输入入口（含 file:line）
- `evidence.sink` — 危险操作（含 file:line）
- `evidence.guard` — 缺失或可绕过的防御（含 file:line 或"不存在"的说明）
- `evidence.reproducer` — 本地复现步骤描述
- `evidence.observed_result` — 本地运行后实际观测到的结果（若 passive 模式无法在本地执行，保留 `unknown`，在 `provenance.unverified_fields` 中列出，交由 `/omv-repro` 完成）
- `cvss.vector` / `cvss.score` / `cvss.severity`
- `dedup.*` — NVD/GHSA/生态系统数据库检索结果
- `verdict.*` — 当前可利用性判断（`proven|plausible|blocked|disproven`）、置信度和原因

**如何达到目标，由你自主决定。** 根据 finding 的实际情况——漏洞类别、已有线索、代码结构——自主选择切入点、阅读哪些文件、花多少精力在每个环节。参考 `references/audit-playbook.md` 获取思维框架，但不要把它当作执行脚本。

如果 finding 属于任一受支持生态，先加载 `references/pattern-packs/` 下对应 JSON，再按需加载 `references/patterns/` 下对应 Markdown registry，用其中的 source pattern、sink signature、expected guard、evidence criteria、false-positive checks 和 CWE 映射辅助判断。Pattern registry 是方法论，不是真实漏洞案例库；不要加载无关生态 registry。

当证据链足够清楚时，生成可选 ThreatMap.v1 sidecar，记录 source → transform → sink 的 dataflow 路径：

```bash
omv threat-map init <id>
```

这会在 `.omv/threatmaps/<id>.yaml` 生成骨架（`finding_id` 和 `package` 块已从 finding 填好，`paths: []` 留待填写）。然后在每个已确认的 source → sink 路径下补一条 `paths[]` 条目：`source`（type/location/description）、`transforms[]`（中间每一步：parse/decode/normalize/validate/authorize）、`sink`、`guard`（present/bypassable）、`confidence`。Schema 见 `contracts/threat-map.v1.yaml`。ThreatMap 是 Evidence.v1 的补充，不替代 `evidence.source` / `evidence.sink` / `evidence.guard` 摘要字段；sidecar 不修改父 Evidence.v1 文件。填写后运行 `omv threat-map validate <id>`。

如果进行了 verifier 对抗复核，先运行 `omv verification init <id>`，再把 verifier 的结论写入 `.omv/verifications/<id>.yaml`：同意则 `decision.status: pass`；找到反证则 `decision.status: fail` 并填写 `disagreements` / `required_changes`。写完运行 `omv verification validate <id>`。不要只把 verifier 结论留在聊天记录里。

解释审计结论时使用方法论语言：说明输入如何到达 sink、guard 为什么缺失或可绕过、哪些证据仍不充分。除非用户提供真实 finding 作为上下文，否则不要把真实包或真实 CVE 当作教程示例。

## 约束边界

以下是硬约束，不可逾越：

1. **不攻击线上服务** — 所有分析基于公开源代码和本地环境
2. **不自动执行 PoC** — `evidence.reproducer` 只写步骤描述，不自动运行
3. **submission score < 75 时不得升为 confirmed** — 低分时保留 `candidate` 状态并列出缺失项
4. **blocked 必须填写 `blockers` 列表** — 每条 blocker 说明具体原因
5. **不伪造证据** — 无法验证的字段保留 `unknown`，在 `provenance.unverified_fields` 中列出
6. **CLI validation 是硬门槛** — 只有 `omv findings validate <id>` 返回 OK 时，才允许把结论作为 confirmed 交给 `/omv-report`

### HARD-GATE: evidence before confirmed

```text
NO status: confirmed WITHOUT:
  - concrete evidence.source / sink / guard (prefer file:line)
  - omv findings validate <id> OK in this turn when omv is available
  - submission score ≥ 75
  - no unresolved blockers
NO exploitability: proven WITHOUT non-unknown observed_result (or explicit user observation recorded)
NO "ready to submit" LANGUAGE — that is omv review --strict, not audit
```

If validate fails after you tried confirmed, **revert to candidate**, list errors, stop.

## Subagent Team Orchestration

本 skill 支持 Codex 和 Claude Code 的 subagent 编排。你在审计流程中可以显式委托给专门的 subagent 角色，让它们在独立的 context 里并行或串行完成子任务：

```text
# 数据流分析 → 交给 dataflow-tracer subagent（2-5 个文件静态分析）
Use the dataflow-tracer subagent to analyze: [finding_id], [package_url], [vuln_class]

# Guard 可绕过性评估 → 交给 guard-checker subagent（独立 context + bypass-bias）
Use the guard-checker subagent to evaluate whether the guard at [file:line] is bypassable

# CVSS 评分 → 交给 cvss-analyst subagent（纯推理，无网络访问）
Use the cvss-analyst subagent to compute CVSS for: [vuln_class], [impact_fields]

# 去重检索 → 交给 dedup-analyst subagent（WebSearch + WebFetch）
Use the dedup-analyst subagent to check duplicates for: [ecosystem], [package], [vuln_class]

# 对抗复核 → 交给 verifier subagent（默认反驳 bias），并写入 Verification.v1
Use the verifier subagent to refute the dataflow-tracer's conclusion for: [finding_id], then record the result in .omv/verifications/<id>.yaml
```

### 推荐编排序列（全量审计）

```
stage 1: dataflow-tracer    → {source, sink, guard_note}
stage 2: guard-checker      → {bypassable, method}（仅在 guard 存在时调）
stage 3: dedup-analyst      → {dedup 状态}（与 stage 1 并行）
stage 4: cvss-analyst       → {vector, score, severity}
stage 5: verifier           → 对抗复核 source→sink 链，输出 Verification.v1 review
stage 6: synthesize         → 汇聚后写 Evidence.v1 + ThreatMap.v1 + Verification.v1
```

**编排决策规则**：已知的字段跳过对应阶段（例如 dedup 已 searched 则跳过 stage 3；cvss 已填则跳过 stage 4）。Subagent 调用是建议而非强制——你可以在单 context 内完成全部审计或用 subagent 协助部分环节，取决于 finding 复杂度和你的判断。无论是否使用 subagent，只要做了对抗复核，结论都必须记录到 Verification.v1 sidecar。

### Subagent 可用性

Codex 使用当前会话提供的原生 delegation 能力；Claude Code 使用 `omv setup --platform claude-code` 安装到 `.claude/agents/` 的角色定义。若当前客户端没有 subagent 能力，在主 context 中顺序完成同样的审计阶段，不得因此跳过证据门槛。

## 结论规则

审计结束后根据证据完整性选择结论：

| 结论 | 触发条件 | 下一步 |
|---|---|---|
| `confirmed` | 五项 source/sink/guard/reproducer/result 全部已知，submission score ≥ 75 | 运行 `omv findings validate <id>`，提示用户运行 `/omv-report` |
| `blocked` | 证据链断裂，或发现疑似重复 CVE，或无法本地复现 | 填写 `blockers`，运行 `omv findings validate <id>`（预期 FAIL） |
| `candidate`（保留） | 部分字段已填但 submission score 不足；或 `observed_result` 为 unknown 但其他字段已填 | 展示缺失项清单；若仅缺 `observed_result`，提示运行 `/omv-repro <id>` |

同时更新 `verdict`：

- 已本地证明可利用：`exploitability: proven`，`confidence: high|medium`
- 证据链合理但未复现：`exploitability: plausible`，`confidence: medium|low`
- 默认防护、环境前置或证据断裂阻止利用：`exploitability: blocked`
- 审计证明不是漏洞：`exploitability: disproven`

如果尝试 confirmed 但 CLI validation 失败，必须保持或恢复为 `candidate`，逐条展示 validation errors，不得提示用户提交报告。

审计结束时始终运行：

```bash
omv findings validate <id>
```

然后运行或建议：

```bash
omv dashboard
```

如本轮做出关键判断（确认 source -> sink、发现 guard 缺失、判定重复或 blocked），在 `.omv/notes/<id>.md` 追加一条时间戳决策记录。不要把 notebook 内容写入 Evidence.v1。

Use the CLI result for lifecycle handoff:

- If the finding remains `candidate` because only `evidence.observed_result` is missing, tell the user to run `/omv-repro <id>`.
- If the finding is `confirmed` and validation returns OK, tell the user to run `/omv-report <id>`.
- If the finding is `blocked`, tell the user to review blockers and optionally run `omv findings archive <id> --reason blocked`.

## Deterministic Helpers

- `omv findings validate <id>` — 校验字段完整性，输出 evidence/submission 分数
- `omv findings promote <id> --status confirmed|blocked` — 更新 status 字段
- `omv threat-map init <id>` — 生成 `.omv/threatmaps/<id>.yaml` ThreatMap.v1 dataflow 骨架
- `omv threat-map validate <id>` — 校验 ThreatMap.v1 图证据和 Evidence 摘要一致性
- `omv verification init <id>` — 生成 `.omv/verifications/<id>.yaml` Verification.v1 对抗复核骨架
- `omv verification validate <id>` — 校验 Verification.v1 和 Evidence hash 是否过期
- `omv dashboard` — 显示 active findings 的下一步动作
- `python3 scripts/resolve_source_path.py --ecosystem npm --pkg <name>`（Windows 使用 `py -3`）— 获取源文件 raw URL
- `python3 scripts/collect_metadata.py --repo <github-url>`（Windows 使用 `py -3`）— 获取仓库元数据
