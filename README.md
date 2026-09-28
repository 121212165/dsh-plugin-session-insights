# dsh-plugin-session-insights

DeepSeek Harness (dsh) 插件：跨会话活动统计。host 侧把每个会话的每次模型调用累计进按月 JSONL 边车文件，提供 `/insights` 汇总（每日趋势 / 最贵会话 / 模型分布）与 `/insights-export` CSV 导出；web 客户端多一个 "Session Insights" 标签页（基于已验证的投影接口）。

与 [dsh-plugin-cost-ledger](https://github.com/121212165/dsh-plugin-cost-ledger) 的分工：cost-ledger 管**钱**（未计价事件直接丢弃），本插件管**活动**（token/轮次/模型分布，未计价模型照常统计，花费只是顺带字段）。

## 功能

- **`/insights`**：会话总数与 token 总量、近 N 天每日趋势（ASCII 条形）、最贵会话 Top 榜、模型分布。
- **`/insights-export`**：明细 CSV（BOM + CRLF，Excel 直开）。
- **web 面板**：`conversation.view` 槽位新增 "Session Insights" 标签，读 `sessionStats` / `tokenUsage` 投影展示当前会话统计——与 dsh-token-telemetry 同一条已验证数据路径。
- **容错**：崩溃半行跳过并计数，文件不改写，`/insights` 里提示损坏行数。

## 安装

克隆或 npm 安装本目录到 profile 的 node_modules，再在 profile 的 cordis.patch.yml 加入本仓库 cordis.patch.yml 的 insert 行。从源码安装需要先构建：`npm install` 会经 `prepare` 脚本自动产出 `lib/`（`npm run build` 也可手动触发）。

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

## 查证状态（诚实清单）

- **已验证**：`session/event`（assistant/message usage）、`agent/request`、`session/disposed`、`ctx.commands.register`——与 price-aware 相同的事件面；`conversation.view` 槽位 + `useProjection("sessionStats"/"tokenUsage")`——与 dsh-token-telemetry 相同的客户端面。
- **查证后放弃**：官方 `sidebar.panellist` / `session-query` 跨会话查询 API 在官方仓库文档中未找到插件侧可用的注册路径（`session-query-sqlite` 是 composition 内部包），故跨会话数据走自己的 JSONL 边车而不是读 harness 会话库。**本插件看不到它安装之前的历史会话**，从安装那一刻开始累计。
- **未验证**：`dsh.client` manifest 与 `ctx.slots.inject` 的组合（telemetry 用的是同一形状，但 `inject` 列表里服务名以 dsh 实际解析为准）；未在运行中的 dsh 里 live mount。

## 局限

- 无历史回填；边车只含安装后的数据。
- web 面板只展示当前会话，跨会话汇总走 `/insights` 命令。
