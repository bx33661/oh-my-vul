# Radar To Audit Walkthrough

中文版本见下方。

## English

This walkthrough uses sanitized fixture packages to demonstrate the method.

1. Create `.omv/radar/watchlist.yaml`:

```yaml
watch:
  - ecosystem: npm
    package: demo-package
    vulnerability: ssrf
```

2. Validate the radar flow offline:

```sh
omv radar refresh --dry-run
```

3. Refresh local passive events and read the brief:

```sh
omv radar refresh
omv radar brief
```

4. If a signal looks worth auditing, create a finding and continue locally:

```sh
omv findings init npm-demo-package-ssrf
/omv-audit npm-demo-package-ssrf
```

Radar does not probe target services and does not run PoCs.

## 中文

本 walkthrough 使用脱敏 fixture 包名来展示方法。

1. 创建 `.omv/radar/watchlist.yaml`：

```yaml
watch:
  - ecosystem: npm
    package: demo-package
    vulnerability: ssrf
```

2. 先离线验证 radar 流程：

```sh
omv radar refresh --dry-run
```

3. 刷新本地被动情报并查看摘要：

```sh
omv radar refresh
omv radar brief
```

4. 如果某个信号值得审计，创建 finding 并继续本地流程：

```sh
omv findings init npm-demo-package-ssrf
/omv-audit npm-demo-package-ssrf
```

Radar 只读被动来源，不探测目标服务，也不运行 PoC。
