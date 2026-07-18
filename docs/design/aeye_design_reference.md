# Aeye visual reference — archived working brief

## Verified foundation

- Primary blue: `#0055FF` (exact; do not substitute a near-blue).
- Design character: high-contrast white surfaces, clean technical typography, precise borders, compact data density, and a disciplined use of blue for focus, navigation, and primary actions.
- The interface should feel confident and contemporary rather than decorative. Information hierarchy, whitespace, and legible tables take priority over visual effects.

## FinBro translation

FinBro uses this foundation for the public application shell. Product-facing surfaces may add dry, self-aware Ethan copy; generated research output stays formal and institutional. Use the system tokens below as the source of truth:

```css
:root {
  --brand-blue: #0055FF;
  --brand-blue-04: rgba(0, 85, 255, 0.04);
  --brand-blue-08: rgba(0, 85, 255, 0.08);
  --brand-blue-12: rgba(0, 85, 255, 0.12);
  --brand-blue-20: rgba(0, 85, 255, 0.20);
  --brand-blue-40: rgba(0, 85, 255, 0.40);
  --surface-primary: #FFFFFF;
  --surface-subtle: #F7F7F7;
  --surface-muted: #F5F5F5;
  --border-light: #E0E0E0;
  --border-medium: #CCCCCC;
  --text-primary: #1A1A1A;
  --text-secondary: #474747;
  --text-muted: #7A7A7A;
  --text-disabled: #ADADAD;
  --white: #FFFFFF;
}
```

## Guardrails

- Use `#0055FF` exactly for primary actions, active controls, key focus states, and restrained data emphasis.
- Keep research tables, charts, citations, evidence labels, and report prose neutral and professional.
- Do not use the Aeye reference to imply affiliation, endorsement, or a copied visual identity.
