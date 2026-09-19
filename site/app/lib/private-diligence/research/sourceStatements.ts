import type { ResearchTopic } from './types';

const properWord = "[A-Z][A-Za-z0-9&.'’()-]*";
const namedParty = `${properWord}(?:\\s+(?:${properWord}|and|of|the)){0,5}`;
const genericPartyWords = /\b(?:see|what|how|why|when|where|who|which|does|can|should|our|your|we|you|they|their|teams?|businesses|business|customers?|clients?|company|companies|partners?|partnerships?|platform|users?|people|view|learn|keep|use|using|by|through|in|with|without|from|at|on|for|via|into|over|under|between|during|author|stories|news|blog|california|all|many|some|enterprise|startup|audit|firms|compliance)\b/i;
const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
function isNamedThirdParty(value: string | undefined, companyName: string) {
  if (!value) return false;
  const name=value.trim().replace(/[.,;:]+$/,'');
  return name.length>1 && !genericPartyWords.test(name) && !new RegExp(`\\b${escape(companyName)}\\b`,'i').test(name);
}
function matchesNamedParty(statement: string, pattern: RegExp, companyName: string) {
  const match=statement.match(pattern);
  return Boolean(match&&isNamedThirdParty(match[1],companyName));
}

/** A relationship requires a named counterparty in the grammatical relationship, never any capitalized word. */
export function supportsExpandedStatement(topic: ResearchTopic, statement: string, name: string) {
  const escaped=escape(name);
  if (!new RegExp(`\\b${escaped}\\b`,'i').test(statement) || /\b(?:may|might|could|will|planned|likely|probably|estimated|we aim|we hope|become a partner|join our|our partners include)\b/i.test(statement)) return false;
  if (['customers','partnerships'].includes(topic)) {
    if (/\?|^(?:see\b|what\b|how\b|why\b|when\b|where\b|who\b|which\b|can\b|does\b|do\b|learn\b|view\b|keep\b|use\b|by\s)|\b(?:our dataset|aggregated|anonymized transactions|return on investment)\b/i.test(statement)) return false;
    if (topic==='customers') {
      // Example uses Acme. / Example is a customer of Acme.
      const subject=new RegExp(`^(${namedParty})\\s+(?:(?:now|currently)\\s+|has\\s+)?(?:uses|used|is using|selected|adopted|deployed|chose|is a customer of|became a customer of)\\s+(?:the\\s+)?${escaped}\\b`);
      // Acme customer Example ... / Acme is used by Example.
      const labelled=new RegExp(`^${escaped}(?:['’]s)?\\s+(?:customer|client)\\s+(${namedParty})(?:\\s|[.,;:]|$)`);
      const passive=new RegExp(`^${escaped}\\s+(?:is|was|has been)\\s+(?:used|selected|adopted|deployed)\\s+by\\s+(${namedParty})(?:\\s|[.,;:]|$)`);
      return [subject,labelled,passive].some(pattern=>matchesNamedParty(statement,pattern,name));
    }
    const relationship='(?:partnered with|partners with|partnership with|partner of|collaborates with|collaborated with|collaborating with|strategic alliance with)';
    const prefix='(?:(?:is|has|excited|pleased|proud|to|announce|announces|announced|a|an|new|expanded|strategic|its|our)\\s+){0,10}';
    const forward=new RegExp(`^${escaped}\\s+${prefix}${relationship}\\s+(${namedParty})(?:\\s|[.,;:]|$)`);
    const reverse=new RegExp(`^(${namedParty})\\s+${prefix}${relationship}\\s+${escaped}\\b`);
    const introductory=new RegExp(`^(?:In|Through)(?:\\s+(?:a|the|its|our))?\\s+partnership with ${escaped},\\s+(${namedParty})\\s+(?:is|has|provides|offers|delivers|supports)\\b`);
    return [forward,reverse,introductory].some(pattern=>matchesNamedParty(statement,pattern,name));
  }
  if (topic==='pricing') {
    if (/\?|\b(?:benefits?|savings?|saved|saves|return on investment|ROI|value delivered|customers achieve|earn(?:s|ed)?)\b/i.test(statement)) return false;
    if (!new RegExp(`^${escaped}\\b|\\b${escaped}(?:['’]s)?\\s+(?:plan|pricing|subscription|free|pro|enterprise|starter)\\b`,'i').test(statement)) return false;
    // A dollar/year figure can be a claimed customer benefit; require actual commercial price terms.
    return /\b(?:price|pricing|priced|costs?|plan|subscription|billed|charged|starting (?:at|from)|starts (?:at|from)|contact sales|free tier|free plan)\b/i.test(statement)
      && /(?:[$£€]\s*\d|\b(?:USD|EUR|GBP)\s*\d|\bfree\b|contact sales)/i.test(statement);
  }
  if (topic==='security') {
    // Keep the standard and predicate in the target's own explicit clause.
    // A comparison table's remote SOC 2 cell cannot qualify "Acme supports idempotency".
    const clauses=new RegExp(`\\b${escaped}\\s+(?:is|has|supports?|maintains?|provides?|offers?|completed|achieved|underwent|undergoes)\\b[^.!?;]*`,'gi');
    return [...statement.matchAll(clauses)].some(match=>{
      const clause=match[0].split(/\b(?:while|whereas|but)\b/i)[0];
      return /\b(?:SOC\s*2|ISO\s*27001|FedRAMP|HIPAA|PCI\s*DSS|GDPR)\b/i.test(clause)
        && /\b(?:certified|certification|compliant|compliance|supports?|authorized|attestation|report|audit(?:ed)?)\b/i.test(clause);
    });
  }
  return false;
}
