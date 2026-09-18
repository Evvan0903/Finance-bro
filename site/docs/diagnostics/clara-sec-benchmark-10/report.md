# Clara 10-company SEC / Form D baseline

运行时间：2026-09-17 20:45–20:49 Pacific（2026-09-18 UTC）。每家公司仅运行一次，无为了提高成功率的重试。

| Company | 确认域名 | CIK 被发现并考虑 | 最终发行人决策 | 主要阻塞 | 验证后 D/D-A | SEC 入报告 | 公告有实质字段 |
|---|---|---|---|---|---|---|---|
| Glean | glean.com | 否 | no_candidate | 有法律名，但搜索返回站外无关结果 | 未进入 | 否 | 是 |
| Mercury | mercury.com | 否 | no_candidate | 仅查询首个名称 Mercury Advisory, LLC；搜索响应报错 | 未进入 | 否 | 是 |
| Ramp | ramp.com | 否 | no_candidate | 无支持法律名，未执行 CIK 搜索 | 未进入 | 否 | 是，口径有误标 |
| Harvey | harvey.ai | 是，2 个 | rejected | 两个候选法律名及地址均冲突 | 未进入 | 否 | 否 |
| Rippling | rippling.com | 否 | no_candidate | 法律名仅 Rippling Lending, Inc；搜索响应报错 | 未进入 | 否 | 是，有多轮/相关稿件混入 |
| Vanta | vanta.com | 否 | no_candidate | 无支持法律名 | 未进入 | 否 | 是 |
| Cribl | cribl.io | 否 | no_candidate | 无支持法律名，虽有地址和人物字段 | 未进入 | 否 | 是，投资人角色有误标 |
| Notion | notion.com | 否 | no_candidate | 无支持法律名 | 未进入 | 否 | 否 |
| Sierra | sierra.ai | 否 | no_candidate | 无支持法律名 | 未进入 | 否 | 是 |
| Factory | factory.com | 否 | no_candidate | 无支持法律名 | 未进入 | 否 | 是 |

“确认”指通过官方域名候选及显式确认接口锁定研究对象，不代表法律实体已经独立核验。
Factory 的 factory.ai 在准备阶段重定向到 factory.com；采用已核对的当前官网，不传法律名或 CIK。

## 方法与控制

- 独立新建 SQLite 数据库；逐家串行经过真实 Next.js `candidates → confirm-entity → run → report`。
- 每家只有一个符合已核对官网域名、可访问的候选，均使用真实 candidateId 显式确认。选择记录在 results.json。
- 使用原有 User-Agent、限速、缓存、模型、检索预算和匹配规则。没有注入法律名称、地址、CIK 或融资事实。
- 所有 196 个应用文件在前后 SHA-256 比对中完全一致。没有修改应用逻辑、规则、环境配置或生产数据库。
- 诊断脚本仅在临时目录中运行；fetch 观察器复制既有搜索和 submissions 响应以读出元数据，不补发请求、不替换响应。观察器有少量额外读取开销，预算未调整。
- 每份报告通过独立数据库连接重读，且与 GET 报告响应完全一致；确认后的 Identity Graph 保持不变。
- 原始隔离运行与网络记录位于 `/private/tmp/clara-benchmark-10-20260918/`；数据库为该目录 runs.json 中的 isolated database 路径。
- 本目录 results.json 保存全部公司身份字段、候选、决策、原因、来源、公告字段、阶段结果及核对结果；summary.csv 可直接比较。

## 汇总漏斗

| 指标 | 公司数 / 10 |
|---|---:|
| 对象显式确认 | 10 |
| Quick 完成并持久化、GET 核对一致 | 10 |
| SEC 候选 CIK 发现并被考虑 | 1 |
| SEC submissions 请求成功 | 1 |
| 发行人 verified | 0 |
| 有候选、最终 unresolved | 0 |
| 有候选、最终 rejected | 1 |
| no_candidate | 9 |
| 已验证后发现 D/D-A | 0 到达，10 未测 |
| 原始 Form D 获取成功 | 0 到达，10 未测 |
| Form D 解析成功 | 0 到达，10 未执行 |
| SEC 证据进入报告 | 0 |
| 公告路径有可追溯实质字段 | 8 |

发行人决策计数按逐候选审计结果，而非上层通用 `secStatus`。例如 Harvey 的上层状态仍显示 issuer_unresolved，但两个候选决策均为 rejected。无候选不算 unresolved 候选。

Harvey 的两个候选分别是 `0002076163 / Silvia, Inc.` 和 `0001869453 / Blue Owl Technology Income Corp.`。两个 submissions 均 HTTP 200，声明的 User-Agent 与配置一致；请求开始时间相隔 334 ms，任意一秒内最高 2 次。两者都不是确认的 Harvey 法律主体。搜索响应还有未被当前限额考虑的链接，这些单独留在原始线索列表，不计作已验证候选。

Notion 的公告网页检索曾获取一篇 SEC newsroom 声明（非 submissions、非 Form D）；资金研究预算因此记录 sec=1。它不计入 SEC 发行人、原文 Form D 或证据成功指标。该网页获取也不使用共享 SEC 客户端，观察器显示其 User-Agent 不等于 SEC_USER_AGENT；基线如实保留，未改配置或请求头。

## 独立公告路径

“有实质字段”定义：至少一条金额、估值、轮次或投资人等字段已持久化，并关联报告中的原文 evidenceId。该指标衡量存在可追溯的融资信息，不保证所有字段和口径准确，也不代表最新完整融资史。

| 公司 | fundingAcquisitions 原文证据页数 | 持久化公告事件数 | 有实质字段 |
|---|---:|---:|---|
| Glean | 6 | 2 | 是 |
| Mercury | 6 | 1 | 是 |
| Ramp | 3 | 2 | 是 |
| Harvey | 7 | 0 | 否 |
| Rippling | 5 | 10 | 是 |
| Vanta | 6 | 2 | 是 |
| Cribl | 5 | 1 | 是 |
| Notion | 5 | 0 | 否 |
| Sierra | 2 | 1 | 是 |
| Factory | 3 | 2 | 是 |

原文证据页数是带 fundingAcquisitions 检索主题并成功获取的候选页面，不是全部都已确认为目标公司的融资公告；各页 URL 和 extracted facts 保存在 results.json。Harvey、Notion 已有原文抓取但没有抽取出可发布的融资事件，因此不能写成“没有融资”或“网络获取全失败”。

人工抽查额外发现：Glean 的一个 investor 字段含地名 Calif；Ramp 的累计融资被标为 current_round；Cribl 将部分参与者标为 lead；Rippling 同页相关故事被抽成多轮事件。这些缺陷没有在基线期间修复，8/10 不能解释为 8 份完整正确的融资报告。

## 主要失败类型与瓶颈

1. 6/10 无支持法律名：Ramp、Vanta、Cribl、Notion、Sierra、Factory。现有发现函数没有法律名就提前返回，因此这些公司没有机会进入 SEC 发行人验证。
2. 2/10 使用了关联业务名称作为唯一 SEC 查询：Mercury Advisory、Rippling Lending。Mercury 的图中已经有多个法律名，却只使用首个；两次搜索 HTTP 200 均携带提供方错误。错误响应不等于零数据，也不能保证改查询就会成功。
3. Glean 有法律名称、街道地址、创始人信息，但精确法律名＋站点限制查询返回了站外无关内容；现有过滤器没有将它们误当 SEC 线索。
4. Harvey 检索到了提及目标词语的其他发行人文件。两个候选均因法律名和地址冲突被拒绝，属于保护规则正确阻止错误关联。

失败分类有重叠，但漏斗停止位置不重叠：9/10 停在 CIK 发现，1/10 停在发行人验证。
当前样本无法证明“核验过严”或“Form D 覆盖稀少”：绝大多数公司尚未到达这些阶段。

Cohere 代表“可发现候选，但需要处理同名与身份冲突”的情况；它不是本轮最常见的失败形态。本轮主导问题是更早的法律主体获取与 CIK 发现。不能从 10 家的零 SEC 证据推断它们从未提交 Form D。

## 下一步工程决策（仅建议，未实施）

选择 Scenario C：先修法律主体获取/选择，再评估 SEC 搜索；目前没有证据支持降低核验门槛或重写 Form D 解析器。

唯一最高价值改动：在 SEC 查询前增加一个基于官方法律页面、有出处和主体关系标注的“目标法律主体获取与选择”步骤。它应补齐缺失法律名，区分品牌经营主体与 Advisory/Lending 等关联实体，并输出有证据支持的主查询名称，替代盲取 legalNames[0]。现有验证器及其冲突规则保持不变。

这一步针对本轮 6 个缺名案例和 2 个关联主体查询案例；这是可覆盖问题的范围，不是承诺能解决 8/10。修改后应对同一固定样本另建新请求复测，不覆盖本次基线。

当前实际 SEC 增量价值为 0/10；尚不足以支持大规模追加投入，但足以支持一次有界的上游改进实验。公告路径应继续独立工作，SEC 保持机会性补充，不作为报告生成必选项。此决定来自观察到的渠道产出差异，不是已经证明 SEC 本身覆盖稀少。

后续扩大样本可将 Cohere、Abaka AI 加为已知失败回归对照，并增加由独立审阅预先核实存在 Form D 的阳性对照。阳性名单尚未核实，不凭记忆指定“必过公司”，也不向应用注入其 CIK。另应保留多法律实体、品牌与法律名不同的分层样本。

## 非破坏性验证

- 诊断脚本 `node --check` 通过。
- 10/10 完成真实 HTTP 流程及数据库/报告读回比较。
- 10/10 确认身份未被改写。
- 196/196 应用文件哈希不变。
- 汇总数字与逐公司记录交叉校验；`git diff --check` 通过。
- 未运行会改变业务逻辑的修复；未提交、推送、部署。隔离本地服务已停止。
