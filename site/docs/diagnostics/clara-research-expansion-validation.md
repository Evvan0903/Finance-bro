# Clara Research Expansion + Adaptive Visualization Harness

验证日期：2026-09-18（US/Pacific；原始记录使用 UTC）。此次工作不包含 commit、push 或 deploy，也未修改生产数据库、凭据或 `.env.local`。已有无关工作区改动保持原状。

## 1. 实际执行路径与原有密度问题

实际 Quick 路径为 `POST /api/private-diligence/candidates → confirm-entity → run → runPrivateDiligence → web_research → company-owned legal discovery → 并发 hiring / funding / researchAdaptively → canonicalResearch → Quick builder → attachVerificationReport → composer → store → GET report`。`runClaraAgentStep` 存在，但不是本次 Quick 路由调用的执行器。因此改动放在真实路径上，未另建 Agent 或多 Agent 应用架构。

旧 Quick 初始搜索实际只有 leadership 和 recent 两组；自适应提取只接收 overview/products/people/recent。网站抓取已保存一些公司页面、链接和职位记录，但没有充分复用招聘页中的 ATS 链接。固定九类正文与独立融资、不确定性模块混排；未找到的客户/合作、所有权等类别仍占用大段空间。融资、招聘、近期动态组件已有，但常因缺少可用记录或来源关联未被填充。报告的解释性限制文案不属于已证实事实。

旧系统已有 FundingEvent、JobPosting、claim/evidence、VerificationLedger 和 ResearchState。融资字段有各自摘录；职位已有分类与原链接，但缺少重点角色分析；客户/合作/定价/安全原文没有统一的轻量研究入口。截图和真实请求也发现，单纯“官网出现某人”不能证明是目标公司管理层：证言、投资者名单可能描述其他公司的人员。

## 2. Registry 与来源决策

实现 `research/registry.ts`：44 个候选目标，标注 EXISTING / ADD NOW / DEFER / DO NOT ADD，并提供优先级、预期价值/成本、可用工具、sourceClasses、resultTypes、visualizationModes、stopRules、coveredBy 与决策理由。详见 [完整目标与来源决策](./clara-research-target-registry.md)。这不是每家公司必跑的 provider 清单。

现在扩展：公司官网客户案例、明确合作公告、公开定价、安全/合规原文、文档/集成的产品证据，以及已有职位上的重点角色分析。复用官网/newsroom、投资人公告、ATS、SEC、按相关性启用的 USAspending；没有新增外部供应商。

暂缓：SAM、州注册局、USPTO、法院/法律事件、独立认证库和跨时间价格变化。原因是主体匹配、时点/范围语义、维护成本或与已有能力重叠。不添加：logo 推断关系、无来源收入估计、由单次招聘快照推断增长/健康/IPO。

## 3. 有界研究策略

Stage A 保留两组基线搜索，用组合查询覆盖 leadership/products 与 announcements/customers/partners；官网抓取在原有 8 页范围内按主题分散选择，失败猜测路径也有最大尝试数。搜索片段只作发现线索，不作为事实。

Stage B 依据信号、价值/成本与已有证据在允许的查询中选择最多两次跟进。某目标失败不再停止所有独立方向；重复空结果、来源不可用、主体未解决或全局预算耗尽均有停止记录。模型只选择允许工具和原文摘录；身份锁定、抓取权限、schema、去重、核验、持久化和预算仍由确定性代码控制。

上限未提高：50 秒；9 search / 44 page / 8 model / 8 official / 10 tool attempts。`ResearchState.researchProgress` 与最终报告保留每目标阶段、尝试、空尝试、证据 ID、停止原因及预算。费用指标是实际计数器，不是账单金额，也不是 token 精确成本。

## 4. 招聘与结构化记录

招聘发现可复用已检索的公司 careers 页面，沿官网锚点、iframe 和受支持 ATS 引用到 Greenhouse/Lever/Ashby/generic；不把导航链接当职位。generic JobPosting 保留雇主边界，明确外部雇主不能通过链接回退重新进入。未知字段保持未知：不把 Greenhouse updated_at 当发布时间，不把字符串 false 当 remote=true，不把未解析 shell 当零职位。

`normalizeJobTitle / classifyKeyRoleTitle / analyzeHiringRoles` 是可解释、可维护的规则层。保留原职位名；分类技术/财务/商业领导、AI/ML、数据、安全/风险/合规；排除 CFO 助理、面向 CFO 的销售职位等假阳性。重点职位按重要性与类别代表性选择最多 8 条，并保留原始链接和选择理由。图表和关键发现只表述“检索时点观察到的公开职位”，不推断员工人数、增长、财务状况或现任职位空缺。

新增统一 `StructuredResearchRecord` 投影：product、person_role、company_event、customer_evidence、partnership_evidence、pricing/security source_observation。复用 FundingEvent、JobPosting、政府记录和原 claim/evidence；不引入通用知识图谱。每条记录带 entityId、claimIds、sources、原摘录、检索/发布日期与 verification；无法结构化的人名/职务、产品名、事件日期保留 null，不补事实。

## 5. 动态报告与可视化

`composeAdaptiveReport` 输出 visualization / full / compact / status_only / hidden。标题锁定用户确认的品牌，法律实体及核验状态放副标题。关键发现最多 6 条，不凑数；先融资、招聘重点、近期事件，再选择有证据的业务信息，排除广告 CTA、裸人名和历史职务的现任解读。

- 融资至少 3 个有意义、独立且有日期的融资观察才用时间线。少量用摘要；多条无日期用并列卡片，不制造时间顺序。Form D 金额保留 amount sold/offering 语义，不冒充融资轮金额。
- 招聘至少 8 条且有可用职能分类才显示分布；地点图另需足够有地点记录和多个地点组。少量职位紧凑列出重点；只有确认的招聘来源则是来源卡；不可用只在覆盖/限制中说明。
- 近期动态至少 3 条有发布日期的记录才用时间线，发布日期不等于事件日期。
- 产品、人员、关系、定价、安全等按实际内容显示紧凑卡片或完整列表；无支持结果不生成大空框。
- Research Coverage、限制和 Sources 在底部；来源默认折叠但可展开摘录及链接。Markdown 共享同一组合规则，内部旧 sections 保留用于向后兼容。

## 6. 证据治理与实测驱动修正

正常模块只消费 canonical verified 数据。Unverified/Provisional 保留黄色折叠模块，Rejected 留在审计，未核验融资、人员和职位不进入正常统计/图表。SEC issuer 验证阈值与 Form D parser 未改。

实测发现并修复的边界：FAQ/匿名客户统计/公司自用产品不能建立客户关系；匿名审计公司不能成为明确合作方；ROI/收益数字不能冒充价格。对领导层检查完整原文局部雇主上下文，避免被截断的摘录丢掉 `at/of 另一家公司`。重复值的 claim 核验 ID 纳入证据集合，避免不同页面的同值主张借用核验决定。已核验的官网关联 ATS 快照同步旧 eligibility，确保 Vanta 等职位证据仍能钻取。融资来源按 evidenceId + URL 分组，避免将原始 XML 摘录错误链接到 submissions JSON。

## 7. 真实验证方法

基线为提交 `9a80efb` 的独立临时副本，当前版本为工作区代码。两个 Next.js 本地实例分别使用临时 SQLite 文件 `before.db` / `after.db`；服务仅绑定 127.0.0.1。运行脚本在进程内读取现有配置并覆盖数据库连接，不修改配置文件，不打印 secrets。

每家公司均走 candidates → confirm-entity → run → GET report 的真实 HTTP 路由，只确认发现的精确官网品牌候选；不手工提供 CIK、融资、职位或管理层事实。保存新 researchId，并逐份比较 run 响应与持久化 GET。对照样本包含 Glean、Mercury、Ramp、Rippling、Vanta、Cribl、Cohere、Linear、Resend、Abaka。调试 pilot 和修正回归请求独立保留；最终统计只取最终版本每家公司一份新报告，不混用旧缓存作为实现成功证明。

浏览器中从输入公司到确认研究完成了 Mercury 与 Glean 的新请求。Mercury 展示实际职位图表、职能与重点角色；Glean 无可用职位/近期动态的模块消失，融资以稀疏摘要呈现。检验标题、法律实体副标题、黄色不确定性、证据展开/原文/链接、中英文切换。桌面 1248px 下 documentWidth 与 viewportWidth 相等，无横向溢出。英文来源摘录保留原文，没有以翻译生成新事实。

## 8. 评估口径与局限

支持的有用事实使用同一当前确定性展示投影对 before/after 去重，并剔除已由原文确认的基线错误条目（Resend 的外部雇主人物、Linear 的畸形姓名）；这些剔除只影响评估计数，不改写旧报告。文本事实、近期事实、融资观察各计一项，招聘总数快照计一项，不把每条岗位冒充一个公司业务事实。这是文本级去重的可展示证据条目口径，并非人工标注的独立事实全集（姓名、完整职务句可能分别计数）；不把它或总 claim 数当成准确率。职位数单列；新增 typed projection 单列，不能把 before 没有这个新字段解释为旧系统没有结构化数据。普通模块数不含 Key Findings、黄色模块和页脚。旧空模块数只计没有 claim 且正文均为缺失说明的固定正文（严格口径）；新空模块数排除有实际 careers source 或成功零职位快照的合法紧凑卡片。

公开网页、搜索结果和模型路径存在时序波动，本次不是随机化 A/B 实验；没有宣称每家公司信息数量都提高。基线中确认的这两类人物错误涉及 8 条 canonical claim（含重复），不能把旧核验标签全部当作正确事实。wrong-entity 核查结合自动来源/身份一致性与人工原文抽查，不能将 entityId 一致误写成所有语义都正确。大量政府/法律/IP 来源未执行是有意选择；未知不得解释为不存在。

<!-- FINAL_METRICS -->
### 最终十家公司对照

| 公司 | 有用事实 before → after | 可验证职位记录 before → after | 新 typed 观察 | 正文模块 / 可视化模块 | 空正文 before → after | run 秒 before → after |
|---|---:|---:|---:|---:|---:|---:|
| Glean | 8 → 10 | 0 → 0 | 5 | 5 / 0 | 2 → 0 | 26.1 → 24.0 |
| Mercury | 19 → 11 | 0 → 65 | 6 | 7 / 1 | 1 → 0 | 30.3 → 19.7 |
| Ramp | 11 → 9 | 0 → 0 | 4 | 5 / 0 | 2 → 0 | 21.0 → 25.6 |
| Rippling | 9 → 19 | 0 → 0 | 3 | 4 / 0 | 2 → 0 | 14.5 → 16.1 |
| Vanta | 11 → 7 | 0 → 93 | 3 | 5 / 1 | 2 → 0 | 31.8 → 31.0 |
| Cribl | 22 → 16 | 0 → 0 | 6 | 5 / 0 | 2 → 0 | 16.2 → 18.4 |
| Cohere | 11 → 6 | 142 → 142 | 2 | 4 / 1 | 1 → 0 | 17.3 → 19.6 |
| Linear | 9 → 17 | 23 → 32 | 9 | 6 / 1 | 1 → 0 | 25.1 → 19.7 |
| Resend | 18 → 15 | 11 → 11 | 1 | 4 / 1 | 1 → 0 | 24.0 → 19.7 |
| Abaka | 17 → 17 | 9 → 9 | 14 | 4 / 1 | 1 → 0 | 21.9 → 10.0 |

合计：有用事实 135 → 127；公开职位 185 → 352；新增 typed 投影 53 条（不含原有职位/融资）；空正文 15 → 0。run HTTP 耗时中位数 22.96 → 19.69 秒。实际新可视化模块 6 个，不把所有 full/compact 卡片算图表。旧正文模块共 100 个，新正文共 49 个；同一口径有用事实/正文模块 1.35 → 2.59，只是密度代理指标，不是客观质量分数。

### 招聘与不确定性明细

| 公司 | 职位 | notable | leadership | AI/ML | finance leadership | security/compliance | 黄色有用条目 |
|---|---:|---:|---:|---:|---:|---:|---:|
| Abaka | 9 | 8 | 0 | 1 | 0 | 0 | 4 |
| Cohere | 142 | 8 | 10 | 8 | 1 | 6 | 59 |
| Cribl | 0 | 0 | 0 | 0 | 0 | 0 | 4 |
| Glean | 0 | 0 | 0 | 0 | 0 | 0 | 16 |
| Linear | 32 | 8 | 0 | 1 | 0 | 0 | 13 |
| Mercury | 65 | 8 | 5 | 3 | 0 | 12 | 12 |
| Ramp | 0 | 0 | 0 | 0 | 0 | 0 | 9 |
| Resend | 11 | 8 | 0 | 0 | 0 | 2 | 26 |
| Rippling | 0 | 0 | 0 | 0 | 0 | 0 | 29 |
| Vanta | 93 | 8 | 8 | 6 | 0 | 5 | 44 |

没有可验证职位时，上表的 0 表示本报告没有可计数记录，**不表示该公司零招聘**。同一职位可属于多个重点角色类别，类别数不能相加为岗位总数。黄色条目是治理展示计数，不是额外已核验事实。

### 请求开销

| 计数（10 次最终请求合计） | before | after |
|---|---:|---:|
| search | 69 | 76 |
| page | 375 | 316 |
| model | 52 | 67 |
| official | 23 | 20 |
| tools | 62 | 69 |

所有最终请求仍受相同硬上限约束。以上不含公司候选确认耗时和调试 pilot/回归请求费用；不是真实账单金额。更多目标提取可能增加模型调用；不能宣称总成本下降。完整去标识化指标与 researchId 见 [评估 JSON](./clara-research-expansion-evaluation.json)。

持久化读回一致：10/10；确认标题一致：10/10；结构记录基本引用校验异常：0。这三项不能单独证明语义上无错配，另行核对原文人员雇主、客户关系及融资字段来源。

<!-- END_FINAL_METRICS -->


## 9. 仍然稀疏的原因与下一步

公司可能只有营销页、动态 careers shell、未经支持的 ATS、没有可解析原文、没有可确定币种/日期，或 legal/SEC 关联不足。Glean 的 careers 检索未获得可解析职位，Quick 中浏览器 fallback 有意关闭；Rippling 发现其专用 ATS 但无专用适配器；Ramp/Cribl 的招聘路径仍可能未知。Resend generic 链接记录的部分标题含地点文字，而独立 location/remote/sourceJobId 未确立时仍保持未知。

下一项最高价值改进：用已有官网关联约束，为实际遇到的 Rippling ATS / JS careers shell 增加一个有界、可验证的结构化适配入口，再做跨公司回归。其次是更好的原文版面/人名职务边界解析和自适应分配模型预算。优先提高真实可用记录与来源关联质量，不增加一批低价值 provider，也不提高现有硬预算。

## 最终检查结果

- `npm test`：369 / 369 通过（包含 Vinext build 与现有全部回归），0 skipped。
- `npm run lint`：通过，exit 0。
- `npx tsc --noEmit`：通过，exit 0。
- `npm run vercel-build`：通过，exit 0。保留 `hiring/playwrightFallback.ts` 动态依赖表达式警告，以及 Node 26 `module.register()` 弃用提示；未修改该 fallback 文件，Quick 的有界策略仍禁用浏览器回退。
- `git diff --check`：通过。
- 最终 10 / 10 报告：真实 POST 与持久化 GET 一致；实际 React 组件与中英文 Markdown 的 2,529 项来源/核验/状态/渲染断言通过。
- 352 条招聘记录：0 缺失原始引用，0 ATS 租户错配，0 字段被重写；持久化 roleAnalysis 与当前确定性重算一致，48 条 notable 记录。
- 原文人工复核最终 40 条人物 claim（含重复）及新增关系/定价/安全观察；本轮未发现已知错误残留或新增确认错配。机械 excerpt/URL、预算和身份检查无异常。这个结论只适用于本次有限快照，并非全局准确率保证。
- 原始评估报告、两个 SQLite 数据库、浏览器之外的实际 React 渲染/Markdown 导出和审计日志保存在 `/private/tmp/clara-expansion-eval/`。临时 Next.js 服务及验证浏览器标签已关闭。

### 对照结论与具体例子

此前固定正文共 100 个模块，如今只有 49 个有用正文模块，6 个达到可视化门槛。职位增加 167 条、空正文减少 15 个；非招聘逐条证据计数 135 → 127，说明收益主要来自招聘覆盖和呈现密度，而不是所有信息类别普遍增多。模型调用 52 → 67，是扩大原文探索的实际代价；硬预算未变，也未宣称总费用下降。

- **Mercury**：此前未获得可计数招聘快照；现在 65 条公开职位、3 条 AI/ML、5 条领导岗位，并保留明确的公开计划价格。最终这次 SEC 关联仍 unresolved，不把此前某次取得的 Form D 拼入本次报告。
- **Vanta**：此前招聘不可用；现在 93 条、6 条 AI/ML、8 条领导岗位。明确的 Samsara 使用案例可以保留，匿名 “Through our partnership…” 被剔除。
- **Linear**：23 条 generic 观察改为 32 条 Ashby 结构记录；提取出正确的 Cristina Cordova — COO，保留具名 Pleo 客户原句和公开免费计划。
- **Cohere**：职位数仍是 142，新增可解释地突出 8 条 AI/ML 与 1 条财务领导职位（Head of Strategic Finance）；业务信息仍可能稀疏，不从招聘推导公司增长。
- **Glean**：融资仍是摘要卡，缺失招聘/近期数据不产生空大框；官方合作原句有明确对方才进入关系模块。
- **Cribl**：保留 Elastic 具名合作，以及确证的 Form D 字段；XML 金额和 submissions 元数据分别链接各自原始来源。投资人 Scott Raney 不进入目标管理层。
- **Resend**：外部公司证言人物不再变成 Resend 高管；混排比较表格不再支持安全记录，明确来自 handbook 的自身 SOC 2 Type II 声明仅作为公司自述保留。


## 10. 主要实现入口

| 位置 | 职责 |
|---|---|
| `app/lib/private-diligence/research/registry.ts` | 目标目录、来源/工具/成本/停止元数据、两组基线查询 |
| `app/lib/private-diligence/research/adaptive.ts` | 原文选择、信号优先级、有界跟进、目标级停止与进度合并 |
| `app/lib/private-diligence/engine.ts` | 真正 Quick 路径、官网链接复用、核验、typed records / presentation 持久化输入 |
| `app/lib/private-diligence/structuredRecords.ts` | 已核验 claims 到轻量 typed records 的无新事实投影 |
| `app/lib/private-diligence/hiring/{discovery,adapters,core}.ts` | ATS 发现/字段解析/职能、资历、重点角色与 notable 排序 |
| `app/lib/private-diligence/verification/{rules,governance}.ts` | 原文局部人员归属、来源集合核验隔离、未核验招聘统计清除 |
| `app/lib/private-diligence/research/sourceStatements.ts` | 新关系/价格/安全主题的明确主语与原句规则 |
| `app/lib/private-diligence/reports/adaptiveReportComposer.ts` | 展示模式、Key Findings、来源关联、共享导出组合 |
| `app/ClaraQuickReportVisuals.tsx`、`ClaraHiringIntelligence.tsx`、`ClaraFundingTimeline.tsx` | 动态正文、图表、重点岗位与证据展开 |
| `app/lib/private-diligence/state/researchStateReducer.ts` | 从真实执行结果折叠研究目标进度 |

新增专项测试覆盖 registry、bounded follow-up、source predicates、people context、structured projection、招聘与自适应报告；现有 SEC、Form D、Ethan、Mason、Nora、持久化与可视化回归均随完整测试执行。
