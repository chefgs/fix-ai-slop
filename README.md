# Design Authenticity Auditor — Find AI Slop

A lightweight, zero-dependency browser tool for auditing websites against common AI-generated design anti-patterns and getting concrete, actionable fixes.

---

## What it does

Rate any website across **15 audit criteria** in 5 categories:

| Category | What it checks |
|---|---|
| Typography & Content Layout | Font hierarchy, line length, whitespace |
| Interactions & Behaviours | Hover/focus states, responsiveness, working components |
| Visual Design & Asset Integrity | Icon consistency, image intent, pixel alignment |
| Content & Copy Quality | Writing specificity, placeholder content, real testimonials |
| Performance & Technical Craft | Load speed, accessibility, meta completeness |

Each "Slop" selection automatically surfaces a **specific, implementable fix** — not vague advice.

The live score widget classifies the site as one of three tiers:

- **Human Engineered** — ≥ 80 %
- **Mixed / AI Template** — 50–79 %
- **AI Slop Overload** — < 50 %

---

## Getting started

No build step, no dependencies, no framework.

```bash
git clone https://github.com/chefgs/fix-ai-slop.git
cd fix-ai-slop
open index.html        # macOS
# or
xdg-open index.html    # Linux
# or just drag index.html into any browser
```

---

## Project structure

```
fix-ai-slop/
├── index.html        # Semantic markup, ARIA labels, no inline styles
├── css/
│   └── styles.css    # Design tokens, component styles, responsive breakpoints
└── js/
    └── audit.js      # Score calculation, DOM-safe suggestion rendering
```

---

## Recommended tools

The app includes a curated **Recommended Tools** section covering:

- **Design & Prototyping** — Figma, Framer, Webflow, Penpot, GetDesign.md
- **Typography & Fonts** — Typescale, Fontpair, Fontjoy, Fontshare
- **Colour Systems** — Coolors, Radix Colors, Realtime Colors, Color Hunt
- **Icons & Assets** — Lucide, Heroicons, Phosphor, Squoosh
- **CSS & Components** — Tailwind CSS, shadcn/ui, Open Props, daisyUI
- **Accessibility & Testing** — axe DevTools, WAVE, PageSpeed Insights, WebPageTest
- **Inspiration & Reference** — Mobbin, Awwwards, Screenlane, Refero

---

## Technical notes

- **No inline styles** — all colour state is driven by a `data-verdict` attribute on the score widget and matched in CSS
- **No `innerHTML` with user data** — suggestion items are built with `createElement` / `textContent`
- **Accessible** — `<fieldset>`/`<legend>` grouping, `aria-labelledby` on every radio group, `role="status"` on the live score, `:focus-visible` on every interactive element
- **`defer`ed script** — zero render-blocking JavaScript

---

## Contributing

1. Fork the repo
2. Create a feature branch: `git checkout -b feat/your-feature`
3. Commit: `git commit -m "feat: describe your change"`
4. Open a pull request

New audit criteria, additional tool suggestions, and language translations are all welcome.

---

## License

MIT
