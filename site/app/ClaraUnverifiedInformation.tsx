import type { PrivateDiligenceReport, DiligenceLocale } from './lib/private-diligence/types';
import { displayableUnverified, verificationText } from './lib/private-diligence/verification/presentation';
import { visualSourceUrl } from './lib/private-diligence/reports/claraVisualization';

const categories={sec_identity:['Potential SEC Records','待核验 SEC 记录'],funding:['Potential Funding Information','待核验融资信息'],leadership:['Potential Leadership Information','待核验人员信息'],hiring:['Potential Hiring Information','待核验招聘信息'],recent:['Potential Recent Developments','待核验业务动态'],identity:['Potential Corporate Relationships','待核验主体关系'],other:['Other Unresolved Research Findings','其他待核验发现']} as const;
const reasons: Record<string,[string,string]>={
  legal_entity_relationship_unresolved:['The legal entity relationship remains unresolved','法律实体与目标品牌的关系尚未确认'],
  supported_primary_legal_entity:['A company-owned statement identifying the primary operator','公司官方来源对主要经营主体的明确陈述'],
  explicit_person_role_and_company:['An explicit link between this person, role and company','明确关联该人员、职位和公司的原文'],
  unbound_legal_name_mention:['The name is mentioned without an explicit company relationship','仅提到名称，没有明确说明与目标公司的关系'],
  strong_legal_name_match:['A strong match to the supported legal name','与有证据支持的法律名称明确匹配'],
  field_support_incomplete:['The original source does not fully support this field','原始来源尚不能充分支持该字段'],
  original_supporting_excerpt:['An original excerpt supporting this exact statement','支持该具体陈述的原始摘录'],
  explicit_field_support_and_transaction_subject:['Explicit field wording and the target as financing subject','明确的字段原文，以及目标公司作为融资主体'],
  role_status_unclear:['The role or its time context remains unclear','职位或其时间语境尚不清楚'],
  career_source_unconfirmed:['The career source has not been confirmed','招聘来源尚未确认归属'],
  business_address_conflict:['Company and SEC business addresses conflict','公司与 SEC 的业务地址存在冲突'],
  legal_name_match:['The legal name matches','法律名称匹配'],
  official_legal_entity_statement:['An official legal entity statement was found','已找到官方法律主体陈述'],
  sec_issuer_association_unverified:['SEC issuer association not yet verified','SEC 发行人与目标公司的关联尚未核验'],
  corroborating_identity_signal:['An address, official domain, or other supported identity signal','地址、官方域名或其他有证据支持的身份印证'],
  resolve_identity_conflict:['Resolve conflicting identity evidence','解释相互冲突的身份资料'],
  field_entity_unverified:['The field belongs to an issuer whose company association is unresolved','该字段所属发行人与目标公司的关联尚未解决'],
  amount_meaning_unknown:['Amount meaning is not established','金额口径尚未确认'],
  conflicting_field_evidence:['Source statements conflict or may describe different transactions','来源陈述冲突或可能属于不同交易'],
  ats_association_unverified:['ATS board ownership is not confirmed','ATS 招聘页面的公司归属尚未确认'],
  person_role_association_incomplete:['Person, role, and company association need explicit support','人员、职位及公司关系需要明确支持'],
  event_timing_unresolved:['Event timing remains unresolved','事件时间尚未确认'],
};
export function ClaraUnverifiedInformation({report,locale}:{report:PrivateDiligenceReport;locale:DiligenceLocale}) {
  const items=displayableUnverified(report.verification),zh=locale==='zh';
  if(!items.length)return null;
  const explain=(code:string)=>reasons[code]?.[zh?1:0]??code.replaceAll('_',' ');
  return <section className="clara-unverified-information" aria-labelledby="clara-unverified-title" data-pdf-block>
    <header><h2 id="clara-unverified-title">⚠ {zh?'未核验信息':'Unverified Information'}</h2><p>{zh?'以下信息可能相关，但尚未满足核验要求；不计入标准事实、融资金额、估值摘要或正常图表。':'These findings may be relevant but do not yet meet verification requirements. They are excluded from canonical facts, funding amounts, valuation summaries, and normal charts.'}</p></header>
    {Object.entries(categories).map(([domain,label])=>{const group=items.filter(f=>f.domain===domain);return group.length?<section key={domain}><h3>{label[zh?1:0]}</h3>{group.map(item=><article key={item.id} data-verification="unverified">
      <h4>{verificationText(item.label)}</h4>{item.value!==null&&<p className="clara-unverified-value">{verificationText(String(item.value))}</p>}
      <p><strong>{zh?'为何未核验':'Why unverified'}:</strong> {item.verification.reasonCodes.map(explain).join('; ')}</p>
      {item.verification.missingRequirements.length>0&&<p><strong>{zh?'仍需支持':'Missing corroboration'}:</strong> {item.verification.missingRequirements.map(explain).join('; ')}</p>}
      {item.eventDate&&<p>{zh?'事件日期':'Event date'}: {item.eventDate}</p>}
      <details><summary>{zh?'来源、摘录与核验记录':'Sources, excerpts & verification record'}</summary>{item.sources.map((source,index)=><div key={`${source.evidenceId}-${index}`}>
        {visualSourceUrl(source.sourceUrl)&&<a href={visualSourceUrl(source.sourceUrl)!} target="_blank" rel="noreferrer">{verificationText(source.title)}</a>}
        <blockquote>{verificationText(source.excerpt)}</blockquote><p>{zh?'检索时间':'Retrieved'}: {source.retrievedAt}</p>
        {source.publicationDate&&<p>{zh?'来源发布日期（非事件日期）':'Source published (not event date)'}: {source.publicationDate}</p>}
        <small>{source.evidenceId}</small>
      </div>)}<p>{zh?'核验时间':'Evaluated'}: {item.verification.evaluatedAt}</p>{item.verification.conflictingEvidenceIds.length>0&&<p>{zh?'冲突证据':'Conflicting evidence'}: {item.verification.conflictingEvidenceIds.join(', ')}</p>}</details>
    </article>)}</section>:null;})}
  </section>;
}
