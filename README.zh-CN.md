<div align="center">

# oh-my-vul

**面向 Claude Code 的证据优先漏洞研究工作台。**

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

**环境要求：** [Claude Code](https://docs.anthropic.com/en/docs/claude-code)、Node.js 20 或更高版本。

全局安装 CLI，再把 skills 和 agents 装入 Claude Code：

```sh
npm install --global oh-my-vul
omv setup
```

检查安装状态：

```sh
omv doctor
```

进入需要研究的项目根目录，初始化私有工作区并写入 `.gitignore`：

```sh
omv workspace init --gitignore
```

在该项目中打开 Claude Code，然后输入：

```text
/using-omv
/omv
```

`/using-omv` 会启用证据与审查门槛；`/omv` 是工作区统一入口，用来查看正在处理的 finding 和下一步建议。

<details>
<summary><strong>其他安装方式</strong></summary>

只安装到当前项目：

```sh
omv setup --scope project
```

升级软件包后，按实际安装范围刷新：

```sh
npm install --global oh-my-vul@latest
# 按实际安装范围选择一条：
omv setup --scope user --force
omv setup --scope project --force
```

按安装范围预览变更，不写入文件：

```sh
# 按实际安装范围选择一条：
omv setup --scope user --dry-run
omv setup --scope project --dry-run
```

</details>

## 使用流程

```text
/using-omv
  -> 为本次研究启用“证据先于结论”的规则

/omv
  -> 新建或继续一个研究 Campaign

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
| 启用漏洞研究的证据门槛 | `/using-omv` |
| 开始、继续或查看研究进度 | `/omv`、`/omv next` |
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
