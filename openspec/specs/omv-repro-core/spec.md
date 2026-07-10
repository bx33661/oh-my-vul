# omv-repro-core Specification

## Purpose
Define the `/omv-repro` workflow for guiding local reproduction and writing observed Evidence.v1 results without autonomous exploit execution.
## Requirements
### Requirement: omv-repro 接受包含 reproducer 的 Evidence.v1 文件作为输入
`/omv-repro <id>` SHALL 读取 `.omv/findings/<id>.yaml`，验证 `evidence.reproducer` 字段非空且非 `unknown`，并展示当前 `versions.tested`、`evidence.source`、`evidence.sink` 字段概览作为复现背景。

#### Scenario: 正常输入已有 reproducer 的文件
- **WHEN** 用户执行 `/omv-repro npm-markdown-it-include-traversal`
- **THEN** agent 读取对应 YAML，确认 `evidence.reproducer` 非空，展示复现背景概览，进入引导流程

#### Scenario: reproducer 字段为空或 unknown
- **WHEN** `evidence.reproducer` 为空或值为 `unknown`
- **THEN** agent 停止执行，提示用户先运行 `/omv-audit <id>` 填写复现步骤描述

#### Scenario: observed_result 已填写
- **WHEN** `evidence.observed_result` 已为非 `unknown` 值
- **THEN** agent 展示已有结果，询问用户是否要重新复现，默认不覆盖

### Requirement: omv-repro 引导研究员完成本地复现
agent SHALL 将 `evidence.reproducer` 分解为可执行的操作序列，告知用户每步需要执行的命令或操作，等待用户报告执行结果，不自动执行任何命令，不声称自己已经安装依赖、运行 PoC、读取文件、发送请求或观测输出。

#### Scenario: 环境准备阶段
- **WHEN** 开始引导流程
- **THEN** agent 读取 `versions.tested` 和 `package` 字段，提示用户安装对应版本（如 `npm install markdown-it-include@1.0.0`），并说明为何版本须与测试版本一致

#### Scenario: 逐步引导执行
- **WHEN** 用户确认环境准备完成
- **THEN** agent 将 reproducer 分解为编号步骤（如 "步骤 1：创建包含以下内容的测试文件..."），每步结束后等待用户确认

#### Scenario: 用户报告执行输出
- **WHEN** 用户粘贴执行输出或描述观测结果
- **THEN** agent 解读输出是否符合预期 sink 行为（如文件读取成功、HTTP 响应包含敏感内容），向用户追问关键指标（状态码、返回内容片段、错误信息），确认后格式化为标准观测描述

#### Scenario: Agent lacks user-reported output
- **WHEN** the user has not reported execution output or observation details
- **THEN** agent does not fill `evidence.observed_result` and asks the user for the missing local result

### Requirement: omv-repro 处理复现失败场景
agent SHALL 识别复现失败原因并引导用户排查，或在无法继续时将 status 设为 `blocked`。

#### Scenario: 版本不匹配导致行为差异
- **WHEN** 用户报告的输出与预期不符，且版本与 `versions.tested` 不一致
- **THEN** agent 提示用户切换至测试版本后重试，说明版本差异对可复现性的影响

#### Scenario: guard 触发，PoC 被拦截
- **WHEN** 用户报告输出显示请求被过滤或抛出安全异常
- **THEN** agent 更新 `evidence.guard` 字段为"存在且有效"，重新评估漏洞结论，询问用户是否需要回到 `/omv-audit` 修订 guard 分析

#### Scenario: 无法在本地复现
- **WHEN** 经多步调试后仍无法复现（环境依赖缺失、闭源依赖等）
- **THEN** agent 在 `blockers` 中添加 "无法本地复现：<具体原因>"，将 status 更新为 `blocked`，运行 `omv findings validate <id>`（预期 FAIL）

### Requirement: omv-repro 将观测结果写入 Evidence.v1 并验证
成功复现后，agent SHALL 将用户报告的格式化观测结果写入 `evidence.observed_result` without modifying `evidence.reproducer`, run `omv findings validate <id>`, and only promote to `confirmed` when validation passes all confirmed gates.

#### Scenario: 复现成功，readiness 达标
- **WHEN** `evidence.observed_result` 写入后 readiness >= 75 and `omv findings validate <id>` returns OK
- **THEN** agent 输出 OK，将 status 更新为 `confirmed`（若当前为 candidate），提示用户运行 `/omv-report`

#### Scenario: 复现成功，但其他字段缺失导致 readiness 不足
- **WHEN** `evidence.observed_result` 写入后 readiness 在 50–74 区间或 validation reports missing confirmed evidence
- **THEN** agent 展示仍缺失的字段清单，建议用户回到 `/omv-audit` 补充，不更改 status

#### Scenario: Reproducer remains read-only
- **WHEN** agent updates `evidence.observed_result`, `status`, `blockers`, or `provenance`
- **THEN** `evidence.reproducer` remains byte-for-byte equivalent unless the user explicitly asks to revise the reproducer outside `/omv-repro`

#### Scenario: Validation rejects confirmed promotion
- **WHEN** observed result is present but confirmed validation fails
- **THEN** agent keeps status as `candidate`, reports validation errors, and does not suggest `/omv-report`

### Requirement: omv-repro emits lifecycle next-action guidance
After reproduction updates a finding, `/omv-repro` SHALL tell the user which lifecycle command should run next based on CLI validation output.

#### Scenario: Reproduction confirms finding
- **WHEN** reproduction records `evidence.observed_result` and validation passes for a confirmed finding
- **THEN** the agent tells the user to run `/omv-report <id>` and `omv findings workflow`

#### Scenario: Reproduction blocks finding
- **WHEN** reproduction determines the finding cannot be reproduced and marks it `blocked`
- **THEN** the agent tells the user to review blockers and optionally run `omv findings archive <id> --reason not-reproducible`

#### Scenario: Reproduction remains incomplete
- **WHEN** reproduction records partial progress but validation still fails for missing audit fields
- **THEN** the agent tells the user to return to `/omv-audit <id>` and shows `omv findings workflow` as the canonical queue view

