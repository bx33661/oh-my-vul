---
name: omv-repro
description: |
  Guides a researcher through local reproduction of a vulnerability finding. Use when the user has an omv-audit result with evidence.reproducer filled but evidence.observed_result still unknown, wants to confirm a finding by running it locally, or invokes `/omv-repro`. Reads .omv/findings/<id>.yaml and guides step-by-step execution, then writes the observed result and validates readiness.
---

# omv-repro

引导研究员在本地执行复现步骤，将 `evidence.observed_result` 从 `unknown` 填写为具体可验证的观测描述，完成 `/omv-report` 所需的最后一块证据。

Stay in passive research mode: do not execute any commands yourself. Guide the user to execute locally and report back what they observed.

## Invocation

```text
/omv-repro <id> [--force]
```

- `<id>` 对应 `.omv/findings/<id>.yaml` 文件
- `--force` 允许覆盖已有 `observed_result`（默认不覆盖）

## Reference Loading

按需加载，不要一次性全读：

- 环境准备与观测记录框架：`references/repro-guide.md`
- Evidence.v1 字段定义与 readiness 评分规则：`contracts/evidence.v1.yaml`

## 复现目标

读取 `.omv/findings/<id>.yaml` 后，你的目标是：

**终态条件（任一）**
1. `evidence.observed_result` 写入非 `unknown` 的具体观测描述，且 `omv findings validate <id>` 输出 readiness ≥ 75
2. 无法复现，`blockers` 中记录具体原因，status 更新为 `blocked`

**如何达到目标，由你自主决定。** 根据 `evidence.reproducer` 的内容——步骤数量、依赖环境、漏洞类型——自主决定如何拆解步骤、向用户提什么问题、如何解读输出。参考 `references/repro-guide.md` 获取环境准备和观测记录的思维框架。

开始前始终展示：`versions.tested`、`evidence.source`、`evidence.sink`、`evidence.reproducer` 的当前值，作为复现背景。

## 约束边界

以下是硬约束，不可逾越：

1. **不自动执行命令** — 所有命令由用户在本地环境执行，Claude 只提供指令和解读
2. **不修改 `evidence.reproducer`** — 该字段属于 omv-audit 职责，只读
3. **不推断或编造 `observed_result`** — 必须来自用户的真实执行报告，不得根据 reproducer 文字推断结果
4. **不攻击线上服务** — 所有执行在本地隔离环境中进行

## 结论规则

| 结论 | 触发条件 | 下一步 |
|---|---|---|
| `confirmed` | `observed_result` 已填，readiness ≥ 75 | 运行 `omv findings validate <id>`，提示用户运行 `/omv-report` |
| `blocked` | 多次尝试后无法在本地复现，或环境依赖无法满足 | 填写 `blockers`，运行 `omv findings validate <id>`（预期 FAIL） |
| `candidate`（保留） | `observed_result` 已填但其他字段缺失，readiness 50–74 | 展示缺失项清单，提示回到 `/omv-audit` 补充 |

复现结束时始终运行：

```bash
omv findings validate <id>
```

## Deterministic Helpers

- `omv findings validate <id>` — 校验字段完整性，输出 readiness 分数
- `omv findings promote <id> --status confirmed|blocked` — 更新 status 字段
