# Clara Visualization Phase 1 — 实现与验证

验证日期：2026-09-18。本次只投影已有报告数据，不修改研究、抓取、解析、SEC 核验、身份、数据库 schema 或配置。未提交、推送或部署。

## 架构与原有数据位置

`PrivateDiligenceReport → 纯函数适配器 → visualization-ready view models → React/CSS 组件`

| 原有内容 | 使用的数据与代码 |
| --- | --- |
| 融资与投资人 | `report.fundingResearch.events[].fields`；`funding/types.ts`；`fundingEventId` / `fundingField` 主张关联；投资人字段 `investor1…5` |
| 招聘与分类 | `report.hiringIntelligence.jobs/summary/status`；现有 function、location、remote、seniority；`hiring/types.ts` |
| 招聘持久化 | `db/schema.ts` 的 `hiring_research_runs` / `hiring_job_postings`；界面只使用当前报告快照，不合计历史行 |
| 近期动态 | 已有、可关联证据的 `research.recent` / `businessActivity` / `acquisition` 主张 |
| 缺口、冲突、覆盖 | `informationGaps`、`conflicts`、claim status、`adaptiveResearch.coverage`、融资/招聘研究状态 |
| 身份 | `report.entity`；仅同一 entityId 的数据可进入视图；不写回身份 |
| Quick 报告 | `ClaraPrivateDiligenceWorkflow.tsx` 原有 `ClaraQuickReportVisuals` 插槽；原详细融资、文字报告与 Sources 保留 |
| 原展示适配器 | `reports/quickReportPresentation.ts` 保留兼容；新四模块使用独立 `claraVisualization.ts` |

适配器只有类型依赖，不请求网络或模型；可独立测试。组件用 `useMemo` 投影同一份报告。没有新增依赖、接口或客户端研究请求，也没有重复发送整份报告的数据通道。

## 本次文件范围

新增：

- `app/lib/private-diligence/reports/claraVisualization.ts`：四个适配器与聚合适配器。
- `app/ClaraFundingTimeline.tsx`：融资卡片、分组与字段证据。
- `app/ClaraResearchVisualPrimitives.tsx`：来源、证据折叠和原生条形图。
- `tests/clara-visualization-phase1.test.mjs`：17 项稳定 fixture / SSR 测试。
- 本文及 `clara-visualization-phase1-live.json`：验证记录。

修改：`app/ClaraQuickReportVisuals.tsx`、`app/ClaraHiringIntelligence.tsx`、`app/globals.css`。仓库原有其他工作区改动未纳入或重置。

## 展示规则

- **融资**：桌面横向卡片、手机单列；按已确认的事件日期排序，未知日期不按轮次标签推断顺序。轮次、累计融资、Form D 发行申报、金额口径不明记录分别展示。字段保留来源、摘录和 evidenceId；未关联有效同主体证据的字段被排除。缺失估值、币种、估值口径保持未知；不补轮次，不自动合并或求和。只有唯一最新已知日期的、无冲突的带轮次记录可以突出为最新已知日期轮次；不推断当前阶段。冲突来自已有冲突记录或主张状态。
- **招聘**：成功且计数与该快照职位一致时显示数量；成功零职位显示 0；失败显示未知；partial 不展示完整总数。条形图沿用已有分类，不推断新职能或公司政策。`remote=false` 展示为“未注明远程”，不当成现场办公。保留检索日期、来源与职位明细，明确不代表员工数或增长。
- **近期动态**：仅投影已有支持性主张，不扫描网页摘要补事件，也不因共用来源丢掉不同主张。保留公司自行披露/独立来源/官方记录归属。当前模型没有独立、已确认的事件日期，因此显示未知；来源发布日期单列，并明确不等于事件日期。不从“Today”等文字推导日期。
- **覆盖**：公司身份、产品/服务、主要人员、融资、招聘、近期动态六项；Supported / Partial / Conflicting / Searched — Not Found / Source Unavailable / Not Researched。证据数只是展开明细，不生成质量或置信度评分。用户确认目标不等于法律身份完全核验。某路空搜索不能掩盖并行路径失败或发行人未解决；来源失败且另有支持数据时为 Partial，无支持数据时为 Source Unavailable。

## 真实 Quick 验证

使用现有 `start-clara-funding-diagnostic.mjs` 启动新建的隔离 SQLite 数据库，通过浏览器填写名称/网站、确认候选并发起新研究。依次经过 candidates → confirm-entity → plan → run，随后读取 report API 与数据库核对。没有使用旧 completed-report 缓存，也没有清理生产缓存。

| 本次结果 | Abaka | Mercury |
| --- | --- | --- |
| researchId | `1b6ecbe3-a4bb-4a9c-88b0-74c84a92c016` | `628b283a-58f7-43f9-9f5c-c6eeae8d7066` |
| 轮次披露 / 累计 / Form D | 0 / 0 / 0 | 2 / 1 / 0 |
| 招聘 | success_with_jobs；9 | browser_fallback_failed；显示未知，不显示 0 |
| 近期主张 | 0，空状态 | 3；各自关联已有 claim / evidence |
| 身份覆盖 | Partial | Partial |
| 产品 / 主要人员覆盖 | Supported / Supported | Supported / Supported |
| 融资覆盖 | Source Unavailable | Partial |
| 招聘 / 近期覆盖 | Supported / Searched — Not Found | Source Unavailable / Supported |

Mercury 的轮次为已有 Series C 和 Series D 披露；Series D 数值为 200,000,000 与估值 5,200,000,000；累计融资另列 546,000,000。当前结构化记录没有币种、事件日期或估值口径，界面不从 `$`、文章日期或其他主张补充。Series C 的金额缺失，也不从近期动态的文本搬入融资字段。这里验证的是报告映射，不是重新核验或调和公司的融资历史。

Abaka 分类为 Other 4、Engineering 2、Data / AI 1、Marketing 1、Sales 1；已有地点为 Mountain View, CA 的 9 个职位。9 个 remote=false 全部展示为“未注明远程”。两家数据库中均有重复保存的研究快照，核对按每个匹配快照分别进行；Abaka 每份 9 条，界面不会累加成 18。

两份报告的以下检查全部通过：

- report API 与持久化报告相同；适配器不修改原报告；报告身份与已确认身份图相同。
- 融资记录数与所有展示字段的值、evidenceId、摘录逐项匹配。
- 近期动态对应持久化主张和其 evidenceId。
- hiring snapshot 与报告相同；每份匹配快照的职位行与归一化职位相同。

桌面 1280px 和移动 390px 已目视检查；移动文档宽度均为 390px，没有横向溢出。检查了中英文、覆盖展开、职位明细、融资字段证据及原有详细报告。浏览器 console error 为 0。浏览器打开 Mercury Series D 原始来源成功；人工链接检查未回填研究数据。

只读 fetch 观察器不记录请求头、身份或密钥。Abaka 的语言/展开/视口交互前后记录数为 59 → 59；Mercury 为 121 → 121，额外研究调用为 0。SSR fixture 还把 fetch 替换为抛错函数，确认展示无网络调用。验证服务器已停止。

## 自动检查

| 命令 | 结果 |
| --- | --- |
| `npm test` | 281 / 281 通过，含 17 项新增测试 |
| `npm run lint` | 通过 |
| `npx tsc --noEmit` | 通过 |
| `npm run vercel-build` | 通过 |
| Sites `build-site.mjs` 本地构建 | 通过；没有发布 |
| `git diff --check` | 通过 |

覆盖单/多事件、累计分离、Form D、缺失估值、冲突、未知/无效日期、不造轮次、零职位/失败/部分结果、缺失分类、无普通网页伪事件、六种覆盖状态、证据计数不等于质量、来源与身份不变、中英文 SSR。普通测试不依赖 live provider。

构建仍报告现有 `hiring/playwrightFallback.ts` 动态依赖表达式警告，以及 Node `module.register()` 弃用警告；构建退出码为 0，未为消除警告改动研究代码。

## 限制与 Phase 2 建议

本次真实两例没有 Form D 或成功零职位样本，这两种展示使用稳定 fixture 验证，不声称完成新的 live SEC 验证。当前事件日期、币种、投资人等结构化字段缺失时图表也缺失。近期动态可包含原报告已有的历史事件提及，不把来源发布时间当成事件发生或新近发生的证明。原文描述、来源标题和限制说明保留原语言，界面标签支持中英文。

不新增冲突发现、跨来源事件合并、融资提取、抓取或历史趋势算法；上游遗漏和未标记冲突不会被展示层自动修复。现有详细报告仍可用于追溯。

建议 Phase 2 先明确同主体历史快照比较的口径；如要进行同行比较，再单独定义主体匹配、时间、币种、指标与证据可比性门槛。本次没有实现同行选择、估值比较、评分或排名。
