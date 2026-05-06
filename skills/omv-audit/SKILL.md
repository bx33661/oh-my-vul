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
- 生态系统 sink registry（npm/Python/Go/Rust/Java/Ruby）：`references/patterns/npm.md` 等同目录文件
- Evidence.v1 字段定义与 evidence/submission 评分规则：`contracts/evidence.v1.yaml`

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

如果 finding 属于 npm、Python、Go、Rust、Java 或 Ruby，按需加载 `references/patterns/` 下对应生态文件，用其中的 source pattern、sink signature、expected guard、evidence criteria、false-positive checks 和 CWE 映射辅助判断。Pattern registry 是方法论，不是真实漏洞案例库；不要加载无关生态 registry。

当证据链足够清楚时，额外生成可选 ThreatMap.v1 sidecar：

```text
.omv/threatmaps/<id>.yaml
```

ThreatMap 是 Evidence.v1 的补充，不替代 `evidence.source` / `evidence.sink` / `evidence.guard` 摘要字段。

解释审计结论时使用方法论语言：说明输入如何到达 sink、guard 为什么缺失或可绕过、哪些证据仍不充分。除非用户提供真实 finding 作为上下文，否则不要把真实包或真实 CVE 当作教程示例。

## 约束边界

以下是硬约束，不可逾越：

1. **不攻击线上服务** — 所有分析基于公开源代码和本地环境
2. **不自动执行 PoC** — `evidence.reproducer` 只写步骤描述，不自动运行
3. **submission score < 75 时不得升为 confirmed** — 低分时保留 `candidate` 状态并列出缺失项
4. **blocked 必须填写 `blockers` 列表** — 每条 blocker 说明具体原因
5. **不伪造证据** — 无法验证的字段保留 `unknown`，在 `provenance.unverified_fields` 中列出
6. **CLI validation 是硬门槛** — 只有 `omv findings validate <id>` 返回 OK 时，才允许把结论作为 confirmed 交给 `/omv-report`

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
omv findings workflow
```

如本轮做出关键判断（确认 source -> sink、发现 guard 缺失、判定重复或 blocked），在 `.omv/notes/<id>.md` 追加一条时间戳决策记录。不要把 notebook 内容写入 Evidence.v1。

Use the CLI result for lifecycle handoff:

- If the finding remains `candidate` because only `evidence.observed_result` is missing, tell the user to run `/omv-repro <id>`.
- If the finding is `confirmed` and validation returns OK, tell the user to run `/omv-report <id>`.
- If the finding is `blocked`, tell the user to review blockers and optionally run `omv findings archive <id> --reason blocked`.

## Deterministic Helpers

- `omv findings validate <id>` — 校验字段完整性，输出 evidence/submission 分数
- `omv findings promote <id> --status confirmed|blocked` — 更新 status 字段
- `omv findings workflow` — 显示 active findings 的下一步动作
- `python3 shared/scripts/resolve_source_path.py --ecosystem npm --pkg <name>` — 获取源文件 raw URL
- `python3 shared/scripts/collect_metadata.py --repo <github-url>` — 获取仓库元数据
