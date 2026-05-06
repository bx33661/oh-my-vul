# oh-my-vul

面向 Claude Code 的证据优先漏洞研究技能集合。

`oh-my-vul` 用来辅助研究员发现值得审计的开源项目，整理 source -> sink -> guard 证据链，并把已确认的问题转成适合提交给 VulDB、CVE、GHSA、OSV 或 Markdown advisory 的报告草稿。

这个项目的定位是被动研究和本地验证。它不是批量扫描器，也不是线上攻击工具。正确的使用方式是阅读公开源码、建立可验证证据、在本地环境复现问题，并在证据不足时明确标记不确定性。

## 快速开始

安装技能：

```sh
npx oh-my-vul setup
```

该命令会把 5 个自包含技能安装到 `~/.claude/skills/`，并在 Claude Code 中提供 slash command。

检查安装状态：

```sh
omv doctor
```

如果你没有全局安装 `omv`，可以用 npx 临时运行：

```sh
npx -p oh-my-vul omv doctor
```

典型工作流：

```text
/omv-find --lang npm --vuln traversal --count 10

omv findings init demo-traversal
/omv-audit demo-traversal
/omv-repro demo-traversal
omv findings validate demo-traversal

/omv-report demo-traversal
```

## 包含的技能

| 技能 | 命令 | 用途 |
|---|---|---|
| `omv` | `/omv` | 查看本地工作区状态、活跃 finding、归档状态和已安装技能 |
| `omv-find` | `/omv-find` | 发现并排序值得审计的开源包 |
| `omv-audit` | `/omv-audit` | 深入审计候选 finding，补齐 Evidence.v1 证据字段 |
| `omv-repro` | `/omv-repro` | 引导本地复现，记录真实 observed_result |
| `omv-report` | `/omv-report` | 从 confirmed finding 生成 VulDB/CVE/GHSA/OSV 报告草稿 |

推荐流程：

```text
/omv-find
  -> 候选项目和源码入口
  -> .omv/findings/<id>.yaml
  -> /omv-audit
  -> /omv-repro
  -> omv findings validate <id>
  -> /omv-report
  -> 提交前报告草稿
```

## 安装方式

用户级安装：

```sh
npx oh-my-vul setup
```

项目级安装：

```sh
npx oh-my-vul setup --scope project
```

常用参数：

```sh
npx oh-my-vul setup --force
npx oh-my-vul setup --dry-run
npx oh-my-vul setup --json
omv doctor --json
omv doctor --strict
omv version --json
```

项目级安装会写入 `.omv/setup-scope.json`，使 `omv doctor` 能自动识别当前项目使用 user 还是 project scope。

## 发现审计目标

在 Claude Code 中运行：

```text
/omv-find --lang npm --vuln traversal --count 10
/omv-find --lang python --vuln injection keyword
/omv-find --lang all --count 12 markdown parser
```

支持的语言：

```text
npm python go rust java ruby php csharp swift dart elixir perl r lua all
```

支持的漏洞类型别名：

```text
proto traversal ssrf injection xss redos yaml unsafe deser race overflow auth
csrf xxe sql ssti sandbox redirect upload crypto infoleak
```

`/omv-find` 应输出带证据的候选结果，包括仓库、注册表身份、维护活跃度、代码规模估计、source -> sink -> guard 笔记和下一步本地审计建议。

## Evidence 账本

项目本地研究状态保存在 `.omv/findings/`。这些文件默认应视为私有研究记录，不应直接发布。

创建模板：

```sh
omv findings init demo-traversal
```

生成的文件：

```text
.omv/findings/demo-traversal.yaml
```

验证 finding：

```sh
omv findings validate demo-traversal
omv findings validate --json
omv findings validate --strict
```

更新状态：

```sh
omv findings promote demo-traversal --status candidate
omv findings promote demo-traversal --status confirmed
omv findings promote demo-traversal --status blocked
```

状态含义：

| 状态 | 含义 |
|---|---|
| `candidate` | 有潜力，但证据不完整 |
| `confirmed` | tested version、source、sink、guard、reproducer、observed_result 等关键证据已知 |
| `blocked` | 证据链断裂、疑似重复、无法复现，暂不应继续报告 |

`omv findings validate` 是报告前的硬门槛。confirmed finding 必须通过字段级校验，包括测试版本、源码证据、本地复现、观测结果、CVSS、去重状态和未验证字段记录。

## 生成报告

当 finding 通过验证后，运行：

```text
/omv-report <id>
```

`/omv-report` 会根据 Evidence.v1 内容生成平台化报告草稿，并尽量避免常见拒稿问题：

- 不把未验证字段默认为事实
- candidate 或 blocked 不生成 submission-ready 报告
- 提醒重复 CVE/CNA 风险
- 针对 VulDB、GHSA、OSV、Markdown 选择合适格式
- 保持 PoC 语言克制，只面向本地验证和审稿

## 安全边界

`oh-my-vul` 只支持非破坏性研究：

- 只阅读公开元数据和公开源码
- 优先使用本地测试、本地 harness 和可复现实验
- 不攻击第三方线上服务
- 不生成凭据窃取、数据外传或滥用 payload
- 未验证结论必须标记为未验证

## 最佳实践

详细方法论见：

[使用 oh-my-vul 挖掘漏洞的最佳实践](docs/vulnerability-research-best-practices.zh-CN.md)

## 要求

- Claude Code
- Node.js 20 或更高版本

## 开发

安装依赖并构建：

```sh
npm install
npm run build
npm run typecheck
```

完整校验：

```sh
npm run sync-metadata
npm run sync-assets
npm run validate
```

单独校验技能：

```sh
python3 scripts/validate_skill.py
python3 scripts/validate_skill.py skills/omv-find
python3 scripts/validate_skill.py skills/omv-report
```

发布前检查：

```sh
python3 scripts/release_check.py
python3 scripts/release_check.py --write-artifacts
```

## 相关文档

- [CONTRIBUTING.md](CONTRIBUTING.md)：开发与贡献规则
- [SECURITY.md](SECURITY.md)：报告本项目安全问题
- [RELEASE.md](RELEASE.md)：发布与兼容性检查
- [contracts/README.md](contracts/README.md)：Evidence.v1 等共享 schema

## 许可证

MIT
