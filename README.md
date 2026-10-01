# dsh-plugin-session-insights

**EN** · Cross-session activity stats: every model call — priced or not — is appended to a monthly JSONL sidecar; `/insights` prints daily trend bars, priciest sessions and model mix, and `/insights-export <YYYY-MM>` writes a BOM+CRLF CSV. The model/provider pair is read from the assistant message's own `source`, **verified against 132 assistant/message events in 20 real persisted sessions**. · 12 `node --test` green · host-side only, no web UI · not live-mounted.

DeepSeek Harness (dsh) 插件：跨会话活动统计。host 侧把每个会话的每次模型调用累计进按月 JSONL 边车文件，提供 `/insights` 汇总（每日趋势 / 最贵会话 / 模型分布）与 `/insights-export` CSV 导出（支持按月过滤）。

与 [dsh-plugin-cost-ledger](https://github.com/121212165/dsh-plugin-cost-ledger) 的分工：cost-ledger 管**钱**（未计价事件直接丢弃），本插件管**活动**（token/轮次/模型分布，未计价模型照常统计，花费只是顺带字段）。

## 功能

- **`/insights`**：会话总数与 token 总量、近 N 天每日趋势（ASCII 条形）、最贵会话 Top 榜、模型分布。
- **`/insights-export`**：明细 CSV（BOM + CRLF，Excel 直开）。
- **容错**：崩溃半行跳过并计数，文件不改写，`/insights` 里提示损坏行数。

## 安装

三步，实测于 `@deepseek-ai/dsh@0.1.7-alpha.1`（需 `pnpm` 在 PATH 上）：

```sh
# ① 装进 profile：dsh plugin 把参数原样转发给 pnpm，git 包会自动跑 prepare 构建 lib/
dsh plugin --profile web add github:121212165/dsh-plugin-session-insights
```

② 把本仓库根目录 `cordis.patch.yml` 的内容**并进** `$DSH_HOME/profiles/web/cordis.patch.yml`。
该文件默认是 `[]`，所以要么整份替换，要么把 insert 条目并进同一个数组；**不要直接追加**——
追加会形成两个 YAML 文档，启动即报
`failed to parse overlay ... end of the stream or a document separator is expected`（本机实测踩过）。

③ 重启 dsh。配置层与 client 半都要重启才生效（客户端按 boot 时算出的内容 rev 下发，硬刷新浏览器没用）。

自检挂载：`dsh --profile web --dump-config | grep dsh-plugin-session-insights`，应看到该条目。
## 数据模型

边车文件 `~/.dsh/session-insights/insights-YYYY-MM.jsonl`，每行：

```json
{"v":1,"sessionId":"…","at":"2026-09-15T02:00:00.000Z","day":"2026-09-15",
 "modelId":"deepseek-v4-pro","provider":"deepseek","turn":3,
 "buckets":{"uncachedInput":100,"cacheRead":900,"output":50,"cacheWrite":0},
 "costMicros":1200000,"currency":"CNY"}
```

计价仅当模型命中价表（内置 DeepSeek 价目 + `prices` 覆盖）；未计价时 `costMicros`/`currency` 缺省，token 统计不受影响。

## 配置

| 字段 | 默认 | 说明 |
|---|---|---|
| `enabled` | `true` | |
| `dataDir` | `~/.dsh/session-insights` | 边车目录 |
| `exportDir` | `dataDir` | CSV 导出目录 |
| `topSessions` | `10` | 最贵会话榜行数 |
| `recentDays` | `14` | 每日趋势窗口 |
| `prices` | `[]` | 形状与 price-aware.prices 一致 |

## 验证状态

- **已验证**：`session/event`（assistant/message usage）、`session/disposed`、`ctx.commands.register`——与 price-aware 相同的事件面；
- **查证后放弃**：官方 `sidebar.panellist` / `session-query` 跨会话查询 API 在官方仓库文档中未找到插件侧可用的注册路径（`session-query-sqlite` 是 composition 内部包），故跨会话数据走自己的 JSONL 边车而不是读 harness 会话库。**本插件看不到它安装之前的历史会话**，从安装那一刻开始累计。
- **未验证**：未在运行中的 dsh 里 live mount。

## 已知边界

- 无历史回填；边车只含安装后的数据。
