import type { PrivateDiligenceReport } from "./lib/private-diligence/types";

export function ClaraFundingResearch({ report, locale }: { report: PrivateDiligenceReport; locale: "en" | "zh" }) {
  const funding = report.fundingResearch;
  if (!funding) return null;
  const zh = locale === "zh";
  const status = { supported: "有来源支持", partial: "部分信息／存在缺口", no_information: "检索范围内未发现", inaccessible: "来源或供应商不可用", issuer_unresolved: "发行人关联未确认", not_performed: "未执行", budget_exhausted: "预算已耗尽" };
  const labels: Record<string, string> = { roundLabel: "轮次", amount: "金额", amountMeaning: "金额口径", currency: "币种", financingType: "融资类型", eventStatus: "事件状态", valuation: "估值", valuationBasis: "估值口径", eventDate: "事件日期", dateMeaning: "日期口径", offeringAmount: "发行总额（USD）", amountSold: "已售金额（USD）", firstSaleDate: "首次出售日期", filingDate: "申报日期", accessionNumber: "申报编号", previousAccessionNumber: "前次申报编号", form: "表格类型", cik: "CIK" };
  return <section className="clara-report-section" aria-label="Funding research">
    <h2>{zh ? "融资信息（有限公开来源研究）" : "Funding — bounded public-source research"}</h2>
    <p>{zh ? "公告" : "Announcements"}: {zh ? status[funding.announcementStatus] : funding.announcementStatus} · SEC: {zh ? status[funding.secStatus] : funding.secStatus}</p>
    {funding.events.filter(event=>!event.verification||event.verification.status==='verified').map((event) => <article key={event.eventId}>
      <h3>{event.sourceKind === "formD" ? "SEC Form D / D/A" : zh ? "融资公告披露" : "Reported financing"}</h3>
      <dl>{Object.entries(event.fields).filter(([,field])=>!field.verification||field.verification.status==='verified').map(([key, field]) => <div key={key}>
        <dt>{zh ? labels[key] ?? key : key.replace(/([A-Z])/g, " $1")}</dt>
        <dd>{String(field.value)} · <a href={field.sourceUrl} target="_blank" rel="noreferrer">{zh ? "字段来源" : "Field source"}</a>
          <details><summary>{zh ? "原文与定位" : "Excerpt and locator"}</summary><blockquote>{field.excerpt}</blockquote><small>{field.locator} · {zh ? "发布" : "Published"}: {field.publicationDate ?? "Unknown"} · {zh ? "检索" : "Retrieved"}: {field.retrievedAt}</small></details>
        </dd>
      </div>)}</dl>
      {event.sourceKind === "announcement" && <p>{zh ? "未披露字段保持未知：" : "Fields without explicit support remain unknown: "}{["roundLabel", "amount", "currency", "valuation", "valuationBasis", "investor1", "eventDate"].filter((key) => !event.fields[key]).join(", ")}</p>}
      {event.limitations.map((item) => <p key={item}>{item}</p>)}
    </article>)}
    {[...funding.gaps, ...new Set(funding.limitations)].map((gap) => <p key={gap}>{gap}</p>)}
    <details><summary>{zh ? "研究记录与请求数" : "Research record and request counts"}</summary>
      <p>{JSON.stringify(funding.requests)}</p>
      <ol>{funding.actions.map((action, index) => <li key={index}>{action.action} · {action.reasonCode} · {action.status} · {action.targetGap}</li>)}</ol>
    </details>
  </section>;
}
