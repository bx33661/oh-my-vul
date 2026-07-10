# omv-audit-core Specification

## Purpose
Define the core `/omv-audit` workflow for turning Evidence.v1 candidate files into confirmed or blocked local audit findings.
## Requirements
### Requirement: omv-audit 接受 Evidence.v1 candidate 文件作为输入
`/omv-audit <id>` 命令 SHALL 读取 `.omv/findings/<id>.yaml`，验证 `status` 为 `candidate`，并从文件中提取 `package`、`vulnerability.class`、已知的 `evidence.source/sink/guard` 字段作为 audit 起点。

#### Scenario: 正常输入 candidate 文件
- **WHEN** 用户执行 `/omv-audit npm-markdown-it-include-traversal`
- **THEN** agent 读取 `.omv/findings/npm-markdown-it-include-traversal.yaml`，确认 status 为 candidate，展示当前已填字段概览，开始 audit 流程

#### Scenario: 文件不存在
- **WHEN** 指定的 id 对应的文件不存在于 `.omv/findings/`
- **THEN** agent 输出错误提示，建议先运行 `omv findings list` 查看可用文件，并停止执行

#### Scenario: 文件 status 不是 candidate
- **WHEN** 文件 status 已为 `confirmed` 或 `blocked`
- **THEN** agent 询问用户是否要重新审计，默认不覆盖已有结论

### Requirement: omv-audit 执行完整的五步审计流程
agent SHALL 按序执行：(1) 数据流追踪、(2) guard 验证、(3) PoC 构造思路、(4) CVSS v3.1 初步评分、(5) NVD/GHSA 去重检索，并将结果逐步写入 Evidence.v1 对应字段。

#### Scenario: 数据流追踪成功
- **WHEN** agent 委托 dataflow-tracer 分析源文件
- **THEN** `evidence.source`、`evidence.sink`、`evidence.guard` 三个字段被填写为带 `file:line` 引用的具体值，置信度标注为 high / medium / low

#### Scenario: 数据流无法追踪
- **WHEN** 源文件不可访问或 fetch budget 耗尽
- **THEN** agent 在 `blockers` 中添加 `"source to sink not proven"`，将 status 设为 `blocked`，并在 audit 摘要中说明原因

#### Scenario: PoC 构造思路描述
- **WHEN** source→sink→guard 已确认
- **THEN** agent 在 `evidence.reproducer` 字段填写本地复现的命令或步骤描述（仅描述，不自动执行），例如 `"构造包含 !!!include(../../../../etc/passwd)!!! 的 markdown 文件，调用插件渲染"`

#### Scenario: CVSS 评分
- **WHEN** 漏洞类别和影响面已明确
- **THEN** agent 委托 cvss-analyst，读取 `shared/references/cvss-builder.md`，填写 `cvss.vector`、`cvss.score`、`cvss.severity`，并给出每个度量选择的一句话说明

#### Scenario: 去重检索
- **WHEN** audit 流程进入去重步骤
- **THEN** agent 检索 NVD（cve.mitre.org）、GHSA（github.com/advisories）和生态系统数据库，填写 `dedup.nvd_searched`、`dedup.ghsa_searched`、`dedup.ecosystem_db_searched`，若发现疑似重复则填写 `dedup.existing_cve` 并将 status 设为 `blocked`

### Requirement: omv-audit 输出 confirmed 或 blocked 的 Evidence.v1 文件
完成审计流程后，agent SHALL update `.omv/findings/<id>.yaml` only to a status that passes the machine Evidence.v1 validation gates. `confirmed` requires concrete source/sink/guard/reproducer/observed_result evidence, a valid CVSS vector, completed dedup fields, and readiness >= 75. `evidence.observed_result` 字段若无法在 passive 模式下通过本地执行验证，SHALL 保留为 `unknown` 并在 `provenance.unverified_fields` 中注明，由后续 `/omv-repro` 填写；不得推断或编造观测结果。

#### Scenario: 审计结论为 confirmed（含 observed_result）
- **WHEN** source/sink/guard/reproducer/observed_result/cvss/dedup 全部已填，字段结构有效，readiness >= 75
- **THEN** agent 将 status 更新为 `confirmed`，运行 `omv findings validate <id>` 输出 OK，提示用户可运行 `/omv-report`

#### Scenario: 审计结论为 confirmed（observed_result 待复现）
- **WHEN** source/sink/guard/reproducer/cvss 已填，但 `evidence.observed_result` 为 `unknown`
- **THEN** agent 在 `provenance.unverified_fields` 中记录 `evidence.observed_result`，保持 status 为 `candidate`，运行 `omv findings validate <id>`，提示用户运行 `/omv-repro <id>` 完成本地复现

#### Scenario: 审计结论为 blocked
- **WHEN** 任意必填字段无法确认，或发现疑似重复 CVE
- **THEN** agent 将 status 更新为 `blocked`，在 `blockers` 列表中逐条说明每个阻断原因，运行 `omv findings validate <id>` 输出 FAIL（预期行为）

#### Scenario: readiness 在 50–74 区间
- **WHEN** 大部分字段已填但未达到 75 分门槛
- **THEN** agent 保持 status 为 `candidate`，展示缺失项清单，建议用户补充后重新运行 `/omv-audit` 或运行 `/omv-repro`

#### Scenario: confirmed validation fails after audit
- **WHEN** agent attempts to mark a finding `confirmed` but `omv findings validate <id>` returns FAIL
- **THEN** agent reverts or keeps status as `candidate`, reports the validation errors, and does not suggest `/omv-report`

### Requirement: omv-audit 按漏洞类别加载专项操作手册
agent SHALL 根据 `vulnerability.class` 字段，从 `references/audit-playbook.md` 中仅加载对应漏洞类别的操作节，不加载无关章节。

#### Scenario: traversal 类漏洞
- **WHEN** `vulnerability.class` 为路径穿越相关值
- **THEN** agent 加载 audit-playbook.md 的 `## Path Traversal` 节，按其中的代码阅读路径和 guard 验证方法执行审计

#### Scenario: 未知漏洞类别
- **WHEN** `vulnerability.class` 字段为空或不在 playbook 覆盖范围内
- **THEN** agent 加载 audit-playbook.md 的 `## General` 通用节，并提示用户补充漏洞类别信息

### Requirement: omv-audit 严格保持 passive 模式
agent SHALL 不对任何线上服务发送攻击请求，不自动执行 PoC，不生成可直接部署的 exploit 代码，并 SHALL not claim any local observation unless the Evidence file already contains a verified observed result or the user explicitly supplied one.

#### Scenario: 尝试生成 exploit
- **WHEN** 审计过程中需要描述 PoC
- **THEN** agent 仅输出本地测试的命令描述或代码片段，明确标注"仅用于本地研究环境"，不发送任何网络请求到目标服务

#### Scenario: Passive audit cannot observe runtime behavior
- **WHEN** audit analysis produces a plausible reproducer but no user-reported execution output exists
- **THEN** agent leaves `evidence.observed_result` as `unknown`, records it in `provenance.unverified_fields`, and keeps status `candidate`

### Requirement: Audit can produce ThreatMap.v1
`omv-audit` SHALL be able to produce `.omv/threatmaps/<id>.yaml` when evidence supports a graph representation.

#### Scenario: Audit maps source to sink
- **WHEN** audit identifies source, transform, sink, and guard evidence
- **THEN** it records those relationships in ThreatMap.v1 format or explains why no threat map was produced

### Requirement: Audit appends notebook decisions
Audit workflows SHALL append key decisions to the research notebook when notebook recording is enabled.

#### Scenario: Confirmation is logged
- **WHEN** audit changes a finding recommendation from candidate to confirmed
- **THEN** the notebook records the confidence, key evidence path, and remaining unverified fields

### Requirement: Audit consumes pattern registry
`omv-audit` SHALL consult the relevant ecosystem sink registry when tracing source-to-sink paths.

#### Scenario: Ecosystem-specific guards are considered
- **WHEN** auditing a Go SSRF candidate
- **THEN** audit considers Go-specific HTTP client sinks and guard patterns from the Go registry

### Requirement: omv-audit emits lifecycle next-action guidance
After updating or validating a finding, `/omv-audit` SHALL tell the user which lifecycle command should run next based on CLI validation output.

#### Scenario: Audit leaves candidate pending reproduction
- **WHEN** audit fills source/sink/guard/reproducer/CVSS but leaves `evidence.observed_result` as `unknown`
- **THEN** the agent tells the user to run `/omv-repro <id>` and `omv findings workflow`

#### Scenario: Audit blocks finding
- **WHEN** audit sets a finding to `blocked`
- **THEN** the agent tells the user the finding can be archived with `omv findings archive <id> --reason blocked` after reviewing blockers

#### Scenario: Audit confirms finding
- **WHEN** audit confirms a finding and `omv findings validate <id>` passes
- **THEN** the agent tells the user to run `/omv-report <id>`

