'use strict';

/** @type {Record<string, { title: string; detail: string }>} */
const FIXES = {
  q1:  { title: 'Fix typographic hierarchy',             detail: 'Establish a clear scale: H1 ≥ 2rem, H2 ≥ 1.5rem, body 1rem. Use typescale.com and enforce the scale system-wide.' },
  q2:  { title: 'Constrain text line length',            detail: 'Add max-width: 65ch to all prose containers. This keeps line length under ~800px for comfortable reading on any screen.' },
  q3:  { title: 'Audit spacing with an 8pt grid',        detail: 'All margins and padding should be multiples of 8px. Remove arbitrary values such as 13px, 22px, or 37px.' },
  q4:  { title: 'Add interactive states to every control', detail: 'Every button and link needs :hover, :active, and :focus-visible styles. Use transition: all 0.15s ease as a baseline.' },
  q5:  { title: 'Fix mobile breakpoints',                detail: 'Test at 375px, 768px, and 1280px. Replace fixed pixel widths with max-width + padding. Use CSS Grid auto-fill for card layouts.' },
  q6:  { title: 'Remove or build all non-functional UI', detail: 'Every interactive element must work. Delete decorative dropdowns and stub placeholders, or label them "Coming soon — [date]".' },
  q7:  { title: 'Standardise your icon library',         detail: 'Pick one family (Lucide, Heroicons, Phosphor) and remove all others. Enforce consistent stroke-width (1.5 or 2px) throughout.' },
  q8:  { title: 'Replace AI stock art with purposeful images', detail: 'Use real product screenshots, team photos, or art-directed illustrations. Remove any image that could belong to a competitor.' },
  q9:  { title: 'Fix element alignment',                 detail: 'Use DevTools overlays to find misalignments. Default to text-align: left for body copy. Prefer gap over manual margins in flex/grid.' },
  q10: { title: 'Rewrite copy with specificity',         detail: 'Replace every vague superlative with a concrete claim. "Fast" → "< 200ms p99 latency". "Easy" → "Set up in 3 steps".' },
  q11: { title: 'Remove all placeholder content',        detail: 'Audit every section for lorem ipsum, placeholder images, and TBD copy. Ship only content you can stand behind.' },
  q12: { title: 'Source real testimonials',              detail: 'Add full name, company, role, and a real headshot. Generic praise without attribution reads as fabricated.' },
  q13: { title: 'Optimise assets and load performance',  detail: 'Convert images to WebP, add loading="lazy" below the fold, defer non-critical JS, and target a Lighthouse performance score ≥ 90.' },
  q14: { title: 'Fix accessibility gaps',               detail: 'Run axe DevTools. Add alt text to all images, ensure 4.5:1 contrast ratio, and verify full keyboard navigation with Tab / Shift-Tab / Enter.' },
  q15: { title: 'Complete meta and social tags',        detail: 'Add a custom favicon.ico, og:title, og:description, og:image (1200×630px), and a unique <title> per page. Test with opengraph.xyz.' },
};

const form             = document.getElementById('audit-form');
const urlInput         = document.getElementById('site-url');
const targetDisplay    = document.getElementById('target-display');
const scoreWidget      = document.getElementById('score-widget');
const scoreNumber      = document.getElementById('score-number');
const scoreVerdict     = document.getElementById('score-verdict');
const progressBar      = document.getElementById('progress-bar');
const resetBtn         = document.getElementById('reset-btn');
const suggestionsPanel = document.getElementById('suggestions-panel');
const suggestionsList  = document.getElementById('suggestions-list');

function getVerdict(pct) {
  if (pct >= 80) return { key: 'human', label: 'Human Engineered' };
  if (pct >= 50) return { key: 'mixed', label: 'Mixed / AI Template' };
  return { key: 'slop', label: 'AI Slop Overload' };
}

function calculateScore() {
  const groups = form.querySelectorAll('.radio-group');
  let humanCount = 0;
  const slopKeys = [];

  groups.forEach((group) => {
    const checked = group.querySelector('.radio-btn:checked');
    const key     = group.dataset.question;
    if (!checked) return;
    if (checked.value === 'human') {
      humanCount++;
    } else {
      slopKeys.push(key);
    }
  });

  const pct             = Math.round((humanCount / groups.length) * 100);
  const { key, label }  = getVerdict(pct);

  scoreNumber.textContent    = pct + '%';
  scoreVerdict.textContent   = label;
  progressBar.style.width    = pct + '%';
  scoreWidget.dataset.verdict = key;

  renderSuggestions(slopKeys);
}

function makeSuggestionEl(fix) {
  const item = document.createElement('div');
  item.className = 'suggestion-item';

  const dot = document.createElement('div');
  dot.className = 'suggestion-dot';
  dot.setAttribute('aria-hidden', 'true');

  const body = document.createElement('div');

  const title = document.createElement('p');
  title.textContent = fix.title;

  const detail = document.createElement('span');
  detail.textContent = fix.detail;

  body.appendChild(title);
  body.appendChild(detail);
  item.appendChild(dot);
  item.appendChild(body);
  return item;
}

function renderSuggestions(slopKeys) {
  if (slopKeys.length === 0) {
    suggestionsPanel.classList.remove('is-visible');
    suggestionsList.innerHTML = '';
    return;
  }

  const fragment = document.createDocumentFragment();
  slopKeys.forEach((key) => {
    const fix = FIXES[key];
    if (fix) fragment.appendChild(makeSuggestionEl(fix));
  });

  suggestionsList.innerHTML = '';
  suggestionsList.appendChild(fragment);
  suggestionsPanel.classList.add('is-visible');
}

urlInput.addEventListener('input', () => {
  const val = urlInput.value.trim();
  const isBlank = val === '' || val === 'https://' || val === 'http://';
  targetDisplay.textContent = isBlank
    ? 'Enter a URL above to begin'
    : 'Analyzing: ' + val.replace(/^https?:\/\//, '');
});

resetBtn.addEventListener('click', () => {
  form.querySelectorAll('.radio-btn[value="human"]').forEach((btn) => {
    btn.checked = true;
  });
  calculateScore();
});

form.addEventListener('change', calculateScore);

calculateScore();
