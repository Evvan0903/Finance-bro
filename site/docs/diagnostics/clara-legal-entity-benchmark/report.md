# Clara 法律实体发现：实现与六家公司复测

完整数据见 [results.json](results.json)，比较表见 [summary.csv](summary.csv)。运行于 2026-09-18 UTC，基线为此前的 [10 公司测试](../clara-sec-benchmark-10/report.md)。

## 结果

| 公司 | 原先 SEC 使用的首个法律名 | 本次法律实体结果 | CIK 候选数：前→后 | 发行人 verified：前→后 |
|---|---|---|---:|---:|
| Glean | Glean Technologies, Inc | 接受 Glean Technologies, Inc. | 0→2 | 0→0 |
| Mercury | Mercury Advisory, LLC | 接受 Mercury Technologies, Inc.；排除 Advisory/Lending 等专门实体 | 0→2 | 0→0 |
| Ramp | 无 | 保留 Ramp Business Corporation 等候选；未选择主实体 | 0→0 | 0→0 |
| Rippling | Rippling Lending, Inc | 保留 Rippling People Center Inc. 等候选；Lending 被排除，主实体未决 | 0→0 | 0→0 |
| Vanta | 无 | 接受 Vanta Inc. | 0→2 | 0→0 |
| Cribl | 无 | 接受 Cribl, Inc. | 0→2 | 0→0 |

“接受”仅指官网原文支持其进入品牌层面的 SEC 候选查询，不等于已核验注册状态或已验证 SEC 发行人。6 家均保存了候选；其中 4 家有明确的查询对象，2 家保持未决。

基线 Mercury Advisory 和 Rippling Lending 的品牌层面误选共 **2 项→0 项**。这一计数表示研究范围不受支持的实体选择，不表示这些实体不存在。本轮四个接受名称均经对应官网条款/隐私原文复核，未观察到错误法律实体选择。SEC 错误接受数仍为 **0→0**；搜索带回的不相关 CIK 不计作已选择发行人。

## CIK 后的确切结果

| 公司 | CIK / SEC 名称 | 结果及阻塞 |
|---|---|---|
| Glean | 0001943896 / Rubrik, Inc.；0002088694 / GLEAN IP HOLDINGS INC. | 均 rejected：法律名、地址冲突 |
| Mercury | 0001049521 / MERCURY SYSTEMS INC | rejected：法律名、地址冲突 |
| Mercury | 0001719932 / Mercury Technologies, Inc. | unresolved：法律名匹配，但地址冲突 |
| Vanta | 0001934145 / Vanta Inc. | unresolved：法律名匹配，缺少现有验证器要求的独立佐证 |
| Vanta | 0001867090 / Fundrise Innovation Fund, LLC | rejected：法律名冲突 |
| Cribl | 0001771516 / Cribl, Inc. | unresolved：法律名匹配，但地址冲突 |
| Cribl | 0001639723 / Navan, Inc. | rejected：法律名、地址冲突 |

8 个 submissions 请求全部 HTTP 200，最终 **5 rejected、3 unresolved、0 verified**。没有进入原始 Form D 获取阶段，不能声称此次验证了 Form D 解析或申报证据入报告。

Ramp 的法律 URL 返回了缺少可用正文的页面，页脚名称不足以确认主运营实体。Rippling 的 `app.rippling.com` 法律页被 robots 禁止访问，因此没有抓取这些正文，也没有把版权声明单独当作运营关系证明。

## 原始来源与证据

- Glean：[Privacy](https://www.glean.com/privacy) 与 [Website Terms](https://www.glean.com/website-terms) 明确将 Glean Technologies, Inc. 与 Glean 品牌绑定。
- Mercury：[Privacy](https://mercury.com/legal/privacy) 与 [Terms](https://mercury.com/legal/terms) 明确 Mercury Technologies, Inc. 的品牌/服务关系；另行保存专门业务实体。
- Vanta：[Privacy](https://www.vanta.com/legal/privacy) 与 [Terms](https://www.vanta.com/legal/terms) 明确 Vanta Inc.。
- Cribl：[Terms](https://cribl.io/legal/terms-of-use/) 与 [Privacy](https://cribl.io/legal/privacy-notice/) 明确 Cribl, Inc.。

所有候选保存 legalName、relationship、status、source URL/type、excerpt、retrievedAt、evidenceId、locator 和 reasonCodes。已逐条核对 **238 个来源引用**均能在持久化原文中找到；发布的 JSON 仅脱敏联系邮箱，数据库中保留原文。第三方目录、产品名、搜索摘要和旧 graph 中无来源的名字不能成为接受依据。

## 实现范围

新增 `entity-resolution/legalEntityDiscovery.ts`：复用已抓取官网原文，再优先跟进官网法律链接，最多六个页面尝试、十二次 HTTP 请求（包括 robots/重定向），十秒且受原 Quick 截止时间约束。沿用安全抓取器，明确链接的公司子域可用于发现，第三方域名不可用。多个有支持的运营主体、共同控制者或冲突保持 unresolved；有明确证据时保存 parent/subsidiary 方向关系。

接入 `engine.ts` 的 Quick 流程及 `funding/research.ts` 现有自动 CIK 路径；SEC 使用临时的候选法律名列表，不再读取旧 `legalNames[0]`。`types.ts` 与 run route 保存候选集合和审计，数据库无需新表。候选层没有修改确认的品牌/显示身份，也没有给 SEC 验证器添加新的通过条件。

新增 `tests/clara-legal-entity-discovery.test.mjs`，覆盖来源证据、主体范围、父子关系、多实体歧义、无结果、安全抓取、真实 funding 入口的查询选择及验证门槛保持。

通过 SHA-256 核对，Form D parser、SEC resolver/provider、Agent 目录和 Quick/Deep report builder 共 12 个受保护文件在本任务中均未改变。

## 验证控制与局限

- 六家公司均使用真实 Next.js `candidates → explicit confirmation → run → report`，随后通过独立数据库连接重新读取。
- 六份报告均完成，GET 与数据库一致；确认图保持一致；重复 run 返回 `alreadyComplete`，工具执行数均未增加。
- 新建隔离 SQLite 数据库；未使用生产数据库。未注入法律名、CIK 或融资事实。临时服务已停止。
- 共 55 次 Tavily 搜索成功、报告 55 credits；法律来源步骤另外分别使用 6、7、7、1、8、12 次 HTTP 请求。这些不挪用或增加现有 Funding 的四次搜索/六次页面预算。
- 子进程使用 Tavily 优先，与上一轮集成验证一致。旧 10 公司基线的搜索提供方和可用性不同，因此 CIK 改善不能全部归因于本次法律层。
- 最后补充的保守主体范围防护对保存原文作离线重放：六家所有候选的名称、状态、关系与实时运行结果一致，SEC 查询名称也完全一致；未为此重复付费跑六家公司。
- 名称和关系提取以英文公司披露为主；名称后缀、动态页面、地域性主体和未访问法律链接仍可能导致未决。没有为了提高覆盖率而降低门槛。
- 公告提取、融资口径与历史地址冲突是独立问题，此任务没有修复或掩盖。

未提交、推送、部署，未修改 `.env.local`、生产数据或付费账户设置。

## 最终检查与文件

- `npm test`：**245/245 通过**，其中新增法律实体测试 14 项。
- `npm run lint`、`npx tsc --noEmit`、`npm run vercel-build`、`git diff --check` 全部通过；保留既有 hiring Playwright 动态导入构建警告。
- 新增：`app/lib/private-diligence/entity-resolution/legalEntityDiscovery.ts`、`tests/clara-legal-entity-discovery.test.mjs`、本目录三个诊断文件。
- 修改：`app/lib/private-diligence/engine.ts`、`app/lib/private-diligence/funding/research.ts`、`app/lib/private-diligence/types.ts`、`app/api/private-diligence/run/route.ts`、`docs/clara-private-diligence.md`。
- 未改变既有搜索适配器、Form D parser、SEC verifier/provider、Agent planner、funding report 或环境配置。
