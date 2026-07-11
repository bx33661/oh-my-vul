<div align="center">

# oh-my-vul

**面向 Codex 与 Claude Code 的证据优先漏洞研究工作台。**

从研究范围到报告草稿，每个结论都能回到本地证据。

[![validate](https://github.com/bx33661/oh-my-vul/actions/workflows/validate.yml/badge.svg)](https://github.com/bx33661/oh-my-vul/actions/workflows/validate.yml)
[![npm](https://img.shields.io/npm/v/oh-my-vul)](https://www.npmjs.com/package/oh-my-vul)
[![license: MIT](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)

[English](README.md) · [完整示例](docs/examples/demo-finding-flow.md) · [更新记录](CHANGELOG.md)

</div>

---

`oh-my-vul` 把开源漏洞研究整理成一套可重复、可复核的流程：

- **先把范围说清楚。** Campaign 和攻击面卡片把宽泛目标收敛成具体的研究问题。
- **让结论有证据可查。** Finding 记录测试版本、source、sink、防护、本地复现和尚未确认的信息。
- **证据过关再写报告。** 本地复现、重复性检查和严格审查会拦住证据不足的候选问题。

研究资料保存在项目私有的 `.omv/` 工作区。本项目只用于被动研究和本地验证，不面向第三方线上服务。

## 快速开始

**环境要求：** [Codex](https://developers.openai.com/codex/) 或 [Claude Code](https://docs.anthropic.com/en/docs/claude-code)、Node.js 22 或更高版本，以及供内置 Skill 辅助脚本使用的 Python 3。支持 Windows、Linux 和 macOS；Windows 建议使用新版 Windows Terminal 或 PowerShell 运行 Ink 工作台。

全局安装 CLI，并把 Skills 装入 Codex：

```sh
npm install --global oh-my-vul@latest
omv setup --platform codex
```

`setup` 会显示安装目录并立即完成健康检查。看到所有检查通过后，重启 Codex，再调用 `$omv`。Codex 用户级 Skills 会安装到 `~/.agents/skills`；使用 Claude Code 时运行 `omv setup --platform claude-code`，重启后调用 `/omv`。Claude Code 仍是兼容旧版本的默认平台。

进入需要研究的项目根目录，启动引导式工作区：

```sh
omv start
```

`omv start` 会把 `.omv/` 写入 `.gitignore`、识别本地项目元数据，并询问准备研究的漏洞类型。也可以用非交互方式明确指定：

```sh
omv start --vuln xss,auth --no-interactive
```

在该项目中打开 Codex，然后调用 Skill（也可以从 `/skills` 中选择）：

```text
$omv
```

Claude Code 用户调用 `/omv`。Skill 会自动启用证据与审查门槛，并显示正在处理的 finding 和下一步建议。在交互式终端中直接运行 `omv`，会打开 Ink 研究工作台。

## 交互式工作台

在终端运行 `omv` 或 `omv tui`，可以浏览优先级队列并查看证据状态：

```text
Tab / 1-4    循环或直接进入概览、Finding、Campaign、Activity
↑/↓ 或 j/k   切换 finding
/            按 ID、包名、状态、漏洞类型或动作搜索
f            按生命周期状态和动作执行面过滤
Enter        在窄终端中切换队列和详情
[ / ]        切换 Summary、Evidence、Threat、History 详情页签
Space        全宽展开当前 finding 或 Activity 事件
PgUp/PgDn    翻阅展开详情或 Activity 历史
g / G        跳到可用内容的第一行或最后一行
:            打开只读命令面板
a            展开当前 CLI 或 Agent 动作说明
r            刷新本地工作区状态
?            显示键盘帮助
q            退出并恢复原终端画面
```

Findings 视图保留优先级队列，并把本地详情拆分为 Summary、Evidence、Threat 和 History。紧凑或分栏视图为了稳定布局可能缩略文本；按 `Space` 可全宽查看完整逻辑字段，内容会按当前终端宽度换行，并显示行号范围与滚动位置。Overview 聚焦当前范围和下一优先项，Campaign 展示研究 lane 与确定性下一步，Activity 可分页查看最近 200 条本地生命周期变化。Activity 行可以选择，按 `Space` 可查看完整的事件原因、状态变化和路径。结构化过滤可以和文本搜索组合使用，命令面板只执行导航和本地 UI 动作。

工作台保持只读：它会展示命令，但不会在 shell 中执行研究命令或 Agent Skill 调用。需要确定性的静态输出时使用 `omv dashboard`，也可以运行 `omv --no-tui` 或 `omv tui --no-tui` 禁用交互渲染。JSON 命令和管道输出不会启动 Ink。终端小于 52 列或 16 行时会显示受控的调整尺寸提示，不会绘制溢出的工作台。

<details>
<summary><strong>其他安装方式</strong></summary>

安装前只下载并预览，不写入 Skills：

```sh
npx --yes oh-my-vul@latest setup --scope user --platform codex --dry-run
```

只安装到当前项目：

```sh
omv setup --scope project --platform codex
```

升级软件包后，按实际安装范围刷新：

```sh
npm install --global oh-my-vul@latest
# 按实际安装范围选择一条：
omv setup --scope user --platform codex --force
omv setup --scope project --platform codex --force
```

每次实际 `setup` 都会自动运行对应平台和范围的健康检查；只有排查安装漂移时才需要单独运行 `omv doctor --strict --platform codex`。

按安装范围预览变更，不写入文件：

```sh
# 按实际安装范围选择一条：
omv setup --scope user --platform codex --dry-run
omv setup --scope project --platform codex --dry-run
```

Claude Code 用户把 `codex` 替换为 `claude-code`。两个平台使用独立目录和 manifest，可以同时安装。全局 npm 安装若报告权限错误，应修复 npm 的用户级 prefix 配置，不要使用 `sudo` 安装本项目。

</details>

## 1.0 CLI 兼容范围

1.x 的公开 CLI 分为两个稳定层级：

- **核心工作流：** `omv`、`start`、`dashboard`、`review`、`setup`、`uninstall`、`doctor`、`version` 和 `help`。
- **高级自动化：** `omv help --all` 列出的公开 `campaign`、`findings`、`workspace`、`radar`、`dedup`、`disclose`、`submissions` 和 `config` 命令。

这些公开命令已记录的参数、退出行为和 `--json` 输出在 1.x 内遵循 SemVer 兼容。由内置 Skills 调用的制品脚手架和诊断命令（`campaign surfaces/seed`、`eval`、`request`、`repro`、`sources`、`report`、`threat-map`、`verification`）保持确定性，但属于 Skill 管理原语，应使用同一软件包版本安装的 CLI 与 Skills。

用于自动化时，[contracts/cli-json.v1.json](contracts/cli-json.v1.json) 列出了所有公开 JSON 形式、结果类型、稳定字段类型和 gate 行为。1.x 内不会删除这些字段、改变类型或语义，但允许增加字段。校验或 readiness gate 未通过时，命令可能输出一份完整的诊断 JSON，同时以非零状态退出。

Node API 只支持软件包根入口：

```js
import { listFindings, reviewFinding, setup } from "oh-my-vul";
```

`oh-my-vul/dist/cli/*` 等深层导入属于内部实现，并由 package export map 阻止。稳定的运行时和类型导出清单位于 [contracts/node-api.v1.json](contracts/node-api.v1.json)。

版本化 `.omv` 格式遵循 [Contract 兼容政策](contracts/README.md) 和 [contracts/artifact-contracts.v1.json](contracts/artifact-contracts.v1.json) 清单。Closed Contract 的字段集合发生任何变化都必须升级 major；extensible Contract 只有在读写端保持兼容时才能增加可选字段。软件包升级不会仅为了更新 schema 而改写私有研究数据。

CLI 与内置 Skills 按同一发行版本配套。升级后运行 `omv doctor --platform codex` 或 `omv doctor --platform claude-code`；如果内容或版本漂移，doctor 会给出包含正确 scope/platform 的 `omv setup ... --force` 修复命令。

1.0 对早期重复入口做了统一：

| 1.0 前移除 | 统一入口 |
|---|---|
| `omv first` | `omv start` 或 `omv campaign init` |
| `omv workspace init` | `omv start` |
| `omv findings workflow` | `omv dashboard` |
| `omv findings doctor <id>` | `omv review <id>` |
| `omv findings open <id>` | `omv findings show <id>` |
| `omv findings delete <id>` | `omv findings archive <id> --reason <reason>` |

## 使用流程

```text
omv start
  -> 初始化私有状态并创建第一个研究 Campaign

/omv
  -> 在“证据先于结论”的规则下继续 Campaign

/omv-find
  -> 发现并排序值得审计的开源项目

/omv-audit <finding-id>
  -> 证明或否定 source -> sink -> guard 证据链

/omv-repro <finding-id>
  -> 记录本地测试中的真实结果

/omv review <finding-id> --strict
  -> 检查证据是否达到报告门槛

/omv-report <finding-id>
  -> 生成 VulDB、CVE、GHSA、OSV 或 Markdown 报告草稿
```

审查结果可能要求继续审计、补充复现、检查重复漏洞或完成独立验证。发现危险 sink 并不等于漏洞已经成立。

## 核心能力

| 目标 | 命令 |
|---|---|
| 启动引导式本地研究工作区 | `omv start` |
| 在证据门槛下继续或查看进度 | `/omv`、`omv` |
| 发现值得审计的开源包 | `/omv-find` |
| 跟踪数据流并检查防护 | `/omv-audit <id>` |
| 引导本地复现 | `/omv-repro <id>` |
| 检查重复风险和拒稿风险 | `/omv-dedup <id>`、`/omv-critic <id>` |
| 准备报告与披露材料 | `/omv-report <id>`、`/omv-disclose <id>` |
| 跟踪版本和安全公告 | `/omv-radar` |

支持 npm、Python、Go、Rust、Java、Ruby、PHP、C#、Swift、Dart、Elixir、Perl、R 和 Lua 生态。

## 本地工作区

所有研究资料都放在目标项目的 `.omv/` 目录：

| 路径 | 内容 |
|---|---|
| `.omv/campaigns/` | 研究范围、优先级和选中的攻击面 |
| `.omv/findings/` | 活跃 finding 的 Evidence.v1 记录 |
| `.omv/repro/` | 本地复现笔记和附件 |
| `.omv/reports/` | 报告草稿和来源清单 |
| `.omv/submissions/` | 披露与提交进度 |

请把 `.omv/` 排除在 Git 之外。真实 finding 可能包含敏感研究信息，完成披露前应保持私有。

## 安全边界

- 发现阶段只读取公开元数据和公开源码。
- 只在本地或明确授权的环境中复现。
- 不测试第三方线上服务。
- 未知或未经验证的信息必须保留为未知。
- 自动生成的报告仍需人工核对证据。

完整边界见[漏洞研究最佳实践](docs/vulnerability-research-best-practices.zh-CN.md)。

## 文档

| 文档 | 用途 |
|---|---|
| [完整 finding 示例](docs/examples/demo-finding-flow.md) | 查看脱敏的端到端流程 |
| [从 Radar 到审计](docs/examples/radar-to-audit-walkthrough.md) | 把被动情报转成审计任务 |
| [披露与提交](docs/examples/disclosure-submission-walkthrough.md) | 跟进已确认 finding 的披露过程 |
| [Evidence 数据格式](contracts/README.md) | 了解 Evidence.v1 及相关文件 |
| [请求代理](docs/request-broker.zh-CN.md) | 了解公开元数据请求、缓存和失败处理 |

[参与贡献](CONTRIBUTING.md) · [安全政策](SECURITY.md) · [行为准则](CODE_OF_CONDUCT.md)

## 许可证

[MIT](LICENSE)
