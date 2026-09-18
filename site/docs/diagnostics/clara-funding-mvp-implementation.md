# Clara Funding Research MVP — 实施与验收

实施日期：2026-09-16。未提交、推送或部署；未使用生产数据库。工作区原有大量未提交改动，本次在现有 Clara 链路上增量修改。

## 复用与实际接线

- 复用已确认目标及 `hasLockedConfirmedTarget`，展示名、法律名称不被融资来源覆盖。
- 复用 SerpApi provider、`safeCompanyFetch`（含 DNS/重定向检查）、HTML 提取、现有 SEC client 的缓存/节流/退避、DeepSeek `runClaraModel`。
- 新增的是 funding 专用的薄编排及字段类型，扩展现有 Form D provider/extractor，没有第二套融资 provider 框架。
- 原通用 Planner/Coverage 支持身份、网页与招聘，但没有融资字段缺口、细粒度请求预算或融资工具会话；因此融资决策使用同一 model router 的结构化任务。工具名称/输入 schema 来自现有 registry。
- 实际执行路径：已确认 Quick `/api/private-diligence/run` → 现有来源采集 → funding research（与现有招聘研究并行）→ normalization → claims → Quick report → 现有数据库 JSON 持久化。
- `funding_search`、`sec_funding` 通过 `executeClaraTool` 记录至原 ResearchState/执行表；状态关联 research request。编排本身不注册为工具，不允许递归调用。
- UI 使用 `ClaraFundingResearch` 展示独立融资部分，Dashboard 识别融资事实；报告 sections 同时保留可导出的融资内容。

## 脱敏供应商健康

| provider | configuration present | loaded in runtime | minimal connectivity check | limitation |
|---|---|---|---|---|
| SerpApi | 是，site/.env.local | 是，Next / @next/env | 沙箱外 HTTP 200；实际查询和原网页抓取通过 | 初始沙箱 DNS ENOTFOUND；不代表凭证无效。实时检索覆盖有限 |
| DeepSeek | 是，site/.env.local | 是，同一现有 router | models HTTP 200；实际抽取及 planner 通过 | 部分早期调用超时；Abaka 第二轮方案未通过验证，未执行 |
| SEC | 识别用 SEC_USER_AGENT 缺失 | 否 | 未发起 SEC 网络请求 | 不需要 SEC API key；需要真实识别/联系信息。不得用现有 client 的示例邮箱代替 |
| libSQL | 原有本地默认配置可用 | 是 | 隔离数据库写入、另一进程/连接重载通过 | 未检查部署环境或远程数据库 |

诊断使用 `@next/env` 正常加载环境，仅输出布尔配置状态和脱敏错误类别。没有输出、重命名、复制或更换 .env 文件/凭证。

## 两条采集路径

公告：固定查询模板使用确认名称/支持的实质性别名、官方域名和融资词；搜索仅产生 URL。经原安全抓取后，仅正文段落进入融资抽取，标题、meta description、搜索摘要不能单独支持事实。复用已抓取页面的正文；融资会话缓存重复 HTTP 页面。官网正文缺失时可检索投资方公告或可访问报道；不绕过访问限制。

SEC：使用现有候选 CIK，或由支持的法律名称进行一次限定 SEC Archives 的搜索。搜索名称和 URL 中的 CIK 均只是候选。最多检查两个候选的原始 submissions；要求法律名称相符，并有 SEC 原始记录中的官网域名或完整业务街道地址加邮编与确认身份佐证一致。缺少佐证仍为 issuer_unresolved。原始 Form D 内发行人名称再次检查。不会使用公开股票 ticker 表解析私营公司，不调用 Company Facts。

申报范围明确限制为 recent submissions 中至多三份 D/D/A；不遍历旧年度历史文件或全量 EDGAR。解析原 XML；保存 CIK、accession、申报日期、原地址、明确提供的前次 accession。D/A 是修订，不能自动算新一轮。发行总额与已售金额分别保存；相关人员、销售补偿收款方、投资者数量不会成为具名投资方名单。

## 抽取与财务约束

每一字段保留 value、evidenceId、原 URL、摘录、定位、发布日期及获取时间。规则提取作为降级；模型只接收原正文和确认目标，返回经 schema/摘录包含关系、数值量级、语义枚举、主体归属检查的候选。内容中的指令不改变工具权限。摘录支持检查不等于事实真伪认证。

- 轮次金额/累计融资、发行总额/已售金额、融资金额/估值分别标注，不做自动求和。
- 计划/宣布/完成分开；首次出售、申报、公告发布日期不混为一谈。
- `$` 本身不补为 USD；缺失金额不是 0；未明确 pre/post-money 不补估值口径。
- 金额币种与估值币种分开。角色仅在来源明确陈述时保留。
- 重复原文不算独立确认；相似轮次但金额不同只提示可能冲突，保留独立来源陈述和不确定关联。
- 投资方提取有五个名称的上限，并有不完整名单提示；不宣称完整融资历史或 cap table。
- SEC 是发行人披露托管来源，不声称 SEC 独立核验融资事实。

实时验收发现并修复了百科参考文献标题误用、`US$500-million` 量级丢失，以及正文所有格（“公司’s latest … raise”）主体识别问题；已新增固定回归夹具。早期错误报告只存在隔离诊断库，不是验收结果。

## 确定性步骤、Agent 与预算

确定性：查询模板、URL 获取及安全检查、CIK 佐证、XML 解析、字段验证、预算、持久化、报告生成。

模型：最多两次正文抽取预算槽；初始结果出现实质缺口后，最多两个规划周期，每次最多批准一个 `funding_search`。规划包含目标、字段事实、证据引用、缺口、已执行查询/结果、剩余预算及注册工具 schema。仅可选服务端提供的未执行查询，针对相应缺口；不能提供 CIK/URL、确认身份、清除冲突或改变权限。stop 合法；非法输出不执行额外动作。

默认融资增量预算：search 4、fetch 6、SEC 6、model 4；按底层网络请求计数，缓存命中不计为新网络请求。SEC 重试最多两次并计入相同预算，间隔至少 300ms，等待不超过剩余期限。融资时间最多 24 秒，并受 Quick 开始后 50 秒的剩余窗口限制。普通 Quick 网站/招聘/USAspending 请求仍使用原有各自限制；融资计数不声称包含这些既有工作流的全部网络请求。

可通过 `CLARA_FUNDING_SEARCH_CAP`、`CLARA_FUNDING_FETCH_CAP`、`CLARA_FUNDING_SEC_CAP`、`CLARA_FUNDING_MODEL_CAP`、`CLARA_FUNDING_DEADLINE_MS` 下调上限，不能调高硬上限。`CLARA_FUNDING_FOLLOWUP=0` 保留无 follow-up 的基线。

## 前后对比（实际原来源，不来自模型记忆）

此前：Quick 仅泛化展示近期动态，公告没有融资字段传递；没有 CIK 时 SEC 跳过，融资 Dashboard 缺少可展示事实。

最终 Cohere 浏览器请求 `8cef80b4-275d-4825-8d48-e0d23361b9be`：投资方 PSP 的原文支持本轮 500,000,000、估值 6,800,000,000，Radical Ventures / Inovia Capital 的 lead 角色及部分参与方。正文只写 `$`，币种和估值口径保持未知。使用 search 3、fetch 6、SEC 0、model 3；包含一次通过验证并实际执行的“币种未明确”模型 follow-up。未因此强行补全币种。

最终 Abaka 浏览器请求 `44d53d8d-9b4b-4069-845a-0a6acf28349d`：可访问的 Forbes 人物报道正文支持 20,000,000 **累计融资**，不能当作本轮金额；币种、轮次、估值保持未知。search 3、fetch 4、SEC 0、model 4；一次合法 follow-up 已执行，另一次输出不合法被拒绝。现有 service、product、executiveRole、founder 及招聘/覆盖呈现保留。

来源：
- [PSP 投资方公告原文](https://www.investpsp.com/en/news/fresh-funding-enables-cohere-to-accelerate-its-global-expansion-and-build-the-next-generation-of-secure-enterprise-and-sovereign-ai-solutions/)
- [Forbes Jack Lin 原始页面](https://www.forbes.com/profile/jack-lin/)

公告内容与 SEC 路径状态分开。源不可访问、issuer_unresolved、范围内未找到、未执行、预算耗尽分别保留；单个来源/模型失败不删除初始支持事实。

## 持久化、缓存与验收

无新增数据库迁移。复用研究记录 JSON、规范化证据、claims 及原 ResearchState/tool execution 表。另一个进程的固定夹具验证字段出处与执行记录；实时验收以新数据库连接读取两个最终请求，检查字段 evidenceId 均存在，并再次调用实际 run API：两者均 `alreadyComplete: true`，融资数据一致，执行记录数不增加。

完整实时摘要位于 `clara-funding-live-validation.json`。测试服务已停止，隔离诊断库留在临时目录。

- 固定夹具：15 项融资专项测试；包含抽取到 Quick、跨进程持久化、计划/累计/未知口径、重印和冲突、错公司、XML/D/A、模糊 CIK、不同 planner 状态、非法/重复动作、预算、模型失败、提示注入及缓存。
- API：真实 candidates → confirm → plan → run，以及完成结果缓存复查通过。
- 浏览器：Cohere、Abaka 的真实 Next.js Quick 流程和融资部分均已查看。
- live-model：两家公司均有通过验证并实际执行的模型选择动作；Cohere 有有效结构化模型抽取。
- live-SEC：**未通过／未执行**，缺少有效识别 User-Agent。XML/发行人验证仅通过固定夹具，不能等同 SEC 联网成功。
- 命令结果以本文件末尾最终记录为准。已有招聘动态 import 的 Next 构建警告与本次融资实现无关。

## 本次涉及文件

- `app/lib/private-diligence/funding/{types,budget,extraction,research}.ts`
- 现有 `providers/{serpApiWebSearchProvider,companyWebsiteProvider,secFormDProvider,providerTypes}.ts`
- 现有 `extraction/{htmlExtractor,formDExtractor}.ts`、`modelRouter.ts`、`types.ts`
- 原 `tools/{registry,types}.ts`，新增 `fundingSearchTool.ts`、`secFundingTool.ts`；通用 planner validator 的工具类型映射
- 原 `engine.ts`、`planning/quickResearchPlanner.ts`、`evidence/{evidenceRegistry,claimRegistry,claimReconciler}.ts`
- 原 `reports/{quickReportBuilder,quickReportPresentation}.ts`、`api/private-diligence/run/route.ts`
- `ClaraFundingResearch.tsx`、原 `ClaraPrivateDiligenceWorkflow.tsx`
- `tests/clara-funding.test.mjs` 及原工具注册/Planner/Form D 夹具预期
- 4 个专用诊断脚本与本实施记录/实时摘要

未修改 Ethan/Mason/Nora 业务实现、USAspending provider、生产数据、凭证或部署配置。

## 官方参考

实现前核对了 [SEC APIs](https://www.sec.gov/search-filings/edgar-application-programming-interfaces)、[SEC fair access](https://www.sec.gov/search-filings/edgar-search-assistance/accessing-edgar-data)、[Form D FAQ](https://www.sec.gov/about/divisions-offices/division-corporation-finance/frequently-asked-questions-answers-form-d) 和 [Next 环境加载文档](https://nextjs.org/docs/app/guides/environment-variables)。SEC 公共数据无需 API key；识别请求头和公平访问要求仍适用。

## 最终命令记录

恢复核对：已重新检查现有融资实现和 Quick 接线，未重建模块；再次执行融资专项测试（15/15）、全套测试（197/197）、ESLint、生产构建和差异空白检查均通过。上述浏览器和实时模型结果来自保存的隔离验证记录，本次恢复核对没有重复消费实时搜索配额，也没有将 SEC 夹具结果升级为联网验证。

| 检查 | 结果 |
|---|---|
| `npm test` | 197/197 通过，其中融资专项 15 项 |
| `npm run lint` | 通过 |
| `npx tsc --noEmit` | 通过 |
| `npm run vercel-build` | 通过；保留原招聘模块动态 import 警告 |
| `git diff --check` | 通过 |

最终补充防护：仅写“raised”而没有明确宣布/完成措辞时，规则提取保留 unknown 状态；拒绝目标“宣布另一家公司融资”的误归属；默认 SEC provider 同样要求真实识别 User-Agent。SEC HTTP 403 被标为访问限制而非不存在的 SEC API-key 认证失败。上述保守规则由最终固定夹具/完整测试覆盖；实时 JSON 保留当时已完成请求的原始输出，不为更新展示文本或规则而改写缓存结果。
