'use strict';

// ── CORS proxies (tried in order until one succeeds) ─────────────────────
const PROXIES = [
  {
    build:   (url) => `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`,
    extract: async (res) => { const d = await res.json(); if (!d.contents) throw new Error('empty'); return d.contents; },
  },
  {
    build:   (url) => `https://corsproxy.io/?${encodeURIComponent(url)}`,
    extract: async (res) => res.text(),
  },
  {
    build:   (url) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`,
    extract: async (res) => res.text(),
  },
];

async function fetchHTML(targetUrl, signal) {
  for (const proxy of PROXIES) {
    try {
      const res  = await fetch(proxy.build(targetUrl), { signal });
      if (!res.ok) continue;
      const html = await proxy.extract(res);
      if (html && html.length > 200) return html;
    } catch (err) {
      if (err.name === 'AbortError') throw err;
      // silent — try next proxy
    }
  }
  throw new Error('All proxies failed. The site may be blocking automated access.');
}

// ── Fix suggestions ───────────────────────────────────────────────────────
const FIXES = {
  q1:  { title: 'Fix typographic hierarchy',              detail: 'Establish a clear scale: H1 ≥ 2rem, H2 ≥ 1.5rem, body 1rem. Use typescale.com and enforce the scale system-wide.' },
  q2:  { title: 'Constrain text line length',             detail: 'Add max-width: 65ch to all prose containers. This keeps line length under ~800px for comfortable reading on any screen.' },
  q3:  { title: 'Audit spacing with an 8pt grid',         detail: 'All margins and padding should be multiples of 8px. Remove arbitrary values such as 13px, 22px, or 37px.' },
  q4:  { title: 'Add interactive states to every control', detail: 'Every button and link needs :hover, :active, and :focus-visible styles. Use transition: all 0.15s ease as a baseline.' },
  q5:  { title: 'Fix mobile breakpoints',                 detail: 'Test at 375px, 768px, and 1280px. Replace fixed pixel widths with max-width + padding. Use CSS Grid auto-fill for card layouts.' },
  q6:  { title: 'Remove or build all non-functional UI',  detail: 'Every interactive element must work. Delete decorative dropdowns and stub placeholders, or label them "Coming soon — [date]".' },
  q7:  { title: 'Standardise your icon library',          detail: 'Pick one family (Lucide, Heroicons, Phosphor) and remove all others. Enforce consistent stroke-width (1.5 or 2px) throughout.' },
  q8:  { title: 'Replace AI stock art with purposeful images', detail: 'Use real product screenshots, team photos, or art-directed illustrations. Remove any image that could belong to a competitor.' },
  q9:  { title: 'Fix element alignment',                  detail: 'Use DevTools overlays to find misalignments. Default to text-align: left for body copy. Prefer gap over manual margins in flex/grid.' },
  q10: { title: 'Rewrite copy with specificity',          detail: 'Replace every vague superlative with a concrete claim. "Fast" → "< 200ms p99 latency". "Easy" → "Set up in 3 steps".' },
  q11: { title: 'Remove all placeholder content',         detail: 'Audit every section for lorem ipsum, placeholder images, and TBD copy. Ship only content you can stand behind.' },
  q12: { title: 'Source real testimonials',               detail: 'Add full name, company, role, and a real headshot. Generic praise without attribution reads as fabricated.' },
  q13: { title: 'Optimise assets and load performance',   detail: 'Convert images to WebP, add loading="lazy" below the fold, defer non-critical JS, and target a Lighthouse performance score ≥ 90.' },
  q14: { title: 'Fix accessibility gaps',                 detail: 'Run axe DevTools. Add alt text to all images, ensure 4.5:1 contrast ratio, and verify full keyboard navigation with Tab / Shift-Tab / Enter.' },
  q15: { title: 'Complete meta and social tags',          detail: 'Add a custom favicon.ico, og:title, og:description, og:image (1200×630px), and a unique <title> per page. Test with opengraph.xyz.' },
};

// Questions that require a visual inspection — auto-check not possible
const MANUAL_ONLY = new Set(['q3', 'q6', 'q9']);

// ── State ─────────────────────────────────────────────────────────────────
const autoResults = {};      // { q1: { verdict, confidence, reason }, … }
const overrides   = new Set(); // question keys the user has manually changed

// ── DOM refs ──────────────────────────────────────────────────────────────
const form             = document.getElementById('audit-form');
const urlInput         = document.getElementById('site-url');
const targetDisplay    = document.getElementById('target-display');
const scoreWidget      = document.getElementById('score-widget');
const scoreNumber      = document.getElementById('score-number');
const scoreVerdict     = document.getElementById('score-verdict');
const progressBar      = document.getElementById('progress-bar');
const analyzeBtn       = document.getElementById('analyze-btn');
const resetBtn         = document.getElementById('reset-btn');
const analyzeStatus    = document.getElementById('analyze-status');
const suggestionsPanel = document.getElementById('suggestions-panel');
const suggestionsList  = document.getElementById('suggestions-list');

// ── Initialise status elements ────────────────────────────────────────────
function init() {
  form.querySelectorAll('.audit-item').forEach((item) => {
    const group = item.querySelector('.radio-group');
    if (!group) return;
    const key    = group.dataset.question;
    const titleP = item.querySelector('.audit-info p');
    const descEl = item.querySelector('.audit-info > span');

    // Inline badge next to the criterion title
    const tag = document.createElement('span');
    tag.className = 'auto-tag';
    tag.id        = `tag-${key}`;
    tag.hidden    = true;
    titleP.appendChild(tag);

    // Auto-detected reason line below the human/slop description
    const reason = document.createElement('span');
    reason.className = 'auto-reason';
    reason.id        = `reason-${key}`;
    reason.hidden    = true;
    descEl.after(reason);

    // Mark manual-only items from the start
    if (MANUAL_ONLY.has(key)) {
      tag.hidden          = false;
      tag.dataset.state   = 'manual-only';
      tag.textContent     = 'Visual check';
    }
  });

  calculateScore();
}

// ── Fetch & analyse ───────────────────────────────────────────────────────
async function analyze() {
  const raw = urlInput.value.trim();
  if (!raw || raw === 'https://' || raw === 'http://') {
    showStatus('error', 'Enter a valid URL first.');
    return;
  }

  const url = /^https?:\/\//i.test(raw) ? raw : 'https://' + raw;

  setAnalyzing(true);
  showStatus('loading', 'Fetching page — this may take a few seconds…');

  try {
    const controller = new AbortController();
    const timer      = setTimeout(() => controller.abort(), 20000);

    showStatus('loading', 'Trying proxy 1 of 3…');
    const html = await fetchHTML(url, controller.signal);
    clearTimeout(timer);

    const doc     = new DOMParser().parseFromString(html, 'text/html');
    const results = runChecks(doc);
    applyResults(results);

    const detected = Object.values(results).filter((r) => r?.verdict).length;
    showStatus('success', `Auto-detected ${detected} of 15 criteria. Toggle any result to override.`);
  } catch (err) {
    const msg = err.name === 'AbortError'
      ? 'Timed out — the site may be blocking the proxy. Score manually below.'
      : `Could not fetch the page. ${err.message || 'Check the URL and try again.'}`;
    showStatus('error', msg);
  } finally {
    setAnalyzing(false);
  }
}

function setAnalyzing(active) {
  analyzeBtn.disabled    = active;
  analyzeBtn.textContent = active ? 'Analyzing…' : 'Analyze';
}

function showStatus(type, message) {
  analyzeStatus.hidden       = false;
  analyzeStatus.dataset.type = type;
  analyzeStatus.textContent  = message;
}

// ── Heuristic checks ──────────────────────────────────────────────────────
function runChecks(doc) {
  return {
    q1:  checkTypographyHierarchy(doc),
    q2:  checkLineLength(doc),
    q3:  null,   // visual check only
    q4:  checkInteractiveStates(doc),
    q5:  checkResponsive(doc),
    q6:  null,   // visual check only
    q7:  checkIconLibraries(doc),
    q8:  checkAssetIntent(doc),
    q9:  null,   // visual check only
    q10: checkCopyQuality(doc),
    q11: checkPlaceholders(doc),
    q12: checkSocialProof(doc),
    q13: checkPerformance(doc),
    q14: checkAccessibility(doc),
    q15: checkMeta(doc),
  };
}

function checkTypographyHierarchy(doc) {
  const h1 = doc.querySelectorAll('h1').length;
  const h2 = doc.querySelectorAll('h2').length;
  if (h1 === 0) return { verdict: 'slop', confidence: 'high',   reason: 'No H1 tag — missing typographic root.' };
  if (h1 > 2)   return { verdict: 'slop', confidence: 'medium', reason: `${h1} H1 tags found — multiple H1s break heading hierarchy.` };
  if (h2 === 0) return { verdict: 'slop', confidence: 'medium', reason: 'No H2 tags — flat heading structure with no sub-levels.' };
  return { verdict: 'human', confidence: 'high', reason: `${h1} H1 and ${h2} H2 tags — heading structure present.` };
}

function checkLineLength(doc) {
  const css = Array.from(doc.querySelectorAll('style')).map((s) => s.textContent).join('');
  if (/\d+ch/.test(css))     return { verdict: 'human', confidence: 'high',   reason: 'ch units used — intentional reading-width control.' };
  if (/max-width/.test(css)) return { verdict: 'human', confidence: 'medium', reason: 'max-width found in inline styles — text containers likely constrained.' };
  if (doc.querySelectorAll('link[rel="stylesheet"]').length > 0)
                             return { verdict: null,    reason: 'External stylesheets present — line length needs a manual visual check.' };
  return { verdict: 'slop', confidence: 'low', reason: 'No max-width or ch units found — text may stretch full-width.' };
}

function checkInteractiveStates(doc) {
  const css         = Array.from(doc.querySelectorAll('style')).map((s) => s.textContent).join('');
  const hasHover    = /:hover/.test(css);
  const hasFocus    = /:focus/.test(css);
  const hasExternal = doc.querySelectorAll('link[rel="stylesheet"]').length > 0;
  if (!hasHover && !hasFocus && !hasExternal)
    return { verdict: 'slop', confidence: 'medium', reason: 'No :hover or :focus states found in inline styles.' };
  if (!hasHover && !hasFocus)
    return { verdict: null, reason: 'External stylesheets present — interactive states need a manual check.' };
  return { verdict: 'human', confidence: 'medium', reason: ':hover / :focus states detected in stylesheet.' };
}

function checkResponsive(doc) {
  const vp = doc.querySelector('meta[name="viewport"]');
  if (!vp) return { verdict: 'slop', confidence: 'high', reason: 'No viewport meta tag — not optimised for mobile.' };
  if (!(vp.getAttribute('content') || '').includes('width=device-width'))
    return { verdict: 'slop', confidence: 'high', reason: 'Viewport meta missing width=device-width.' };
  const css = Array.from(doc.querySelectorAll('style')).map((s) => s.textContent).join('');
  if (!/@media/.test(css) && doc.querySelectorAll('link[rel="stylesheet"]').length === 0)
    return { verdict: 'slop', confidence: 'medium', reason: 'No @media queries found — may not be fully responsive.' };
  return { verdict: 'human', confidence: 'high', reason: 'Viewport meta and responsive breakpoints present.' };
}

function checkIconLibraries(doc) {
  const srcs = Array.from(doc.querySelectorAll('link[href], script[src]'))
    .map((el) => (el.getAttribute('href') || el.getAttribute('src') || '').toLowerCase());
  const LIBS = [
    'font-awesome', 'fontawesome', 'material-icons', 'material-symbols',
    'ionicons', 'bootstrap-icons', 'feather', 'lucide', 'heroicons',
    'phosphor', 'remixicon', 'tabler',
  ];
  const found = LIBS.filter((lib) => srcs.some((s) => s.includes(lib)));
  if (found.length > 1)  return { verdict: 'slop',  confidence: 'high',   reason: `Multiple icon libraries loaded: ${found.join(', ')}.` };
  if (found.length === 1) return { verdict: 'human', confidence: 'high',   reason: `Single icon library in use: ${found[0]}.` };
  return { verdict: 'human', confidence: 'low', reason: 'No external icon libraries detected — may use inline SVGs.' };
}

function checkAssetIntent(doc) {
  const imgs = Array.from(doc.querySelectorAll('img'));
  if (imgs.length === 0) return { verdict: null, reason: 'No images found — check manually.' };
  const STOCK = [
    'shutterstock', 'gettyimages', 'istockphoto', 'freepik',
    'unsplash.com', 'pexels.com', 'pixabay', 'depositphotos', 'stock.adobe',
  ];
  const stockCount = imgs.filter((img) =>
    STOCK.some((d) => (img.getAttribute('src') || '').includes(d))
  ).length;
  if (stockCount > imgs.length * 0.5)
    return { verdict: 'slop', confidence: 'high',   reason: `${stockCount} of ${imgs.length} images from stock photo services.` };
  if (stockCount > 0)
    return { verdict: 'slop', confidence: 'medium', reason: `${stockCount} stock photo image(s) detected.` };
  return { verdict: 'human', confidence: 'medium', reason: 'No stock photo domains found in image sources.' };
}

function checkCopyQuality(doc) {
  const SLOP = [
    'revolutionary', 'cutting-edge', 'cutting edge', 'seamless experience',
    'game-changing', 'game changer', 'state-of-the-art', 'innovative solution',
    'next-generation', 'next generation', 'synergy', 'paradigm shift',
    'disruptive', 'world-class', 'best-in-class', 'groundbreaking',
    'transformative', 'unlock the power', 'elevate your', 'empower your',
  ];
  const text  = (doc.body?.textContent || '').toLowerCase();
  const found = SLOP.filter((p) => text.includes(p));
  if (found.length >= 3)
    return { verdict: 'slop', confidence: 'high',   reason: `${found.length} AI slop phrases found: "${found.slice(0, 3).join('", "')}"…` };
  if (found.length >= 1)
    return { verdict: 'slop', confidence: 'medium', reason: `Vague superlative detected: "${found[0]}".` };
  return { verdict: 'human', confidence: 'medium', reason: 'No common AI slop phrases found in copy.' };
}

function checkPlaceholders(doc) {
  const text = (doc.body?.textContent || '').toLowerCase();
  if (text.includes('lorem ipsum'))
    return { verdict: 'slop', confidence: 'high', reason: 'Lorem ipsum placeholder text found on page.' };
  const PLACEHOLDER_HOSTS = [
    'placeholder.com', 'placehold.it', 'picsum.photos',
    'dummyimage.com', 'lorempixel', 'placekitten',
  ];
  const imgs = Array.from(doc.querySelectorAll('img'));
  if (imgs.some((img) => PLACEHOLDER_HOSTS.some((h) => (img.getAttribute('src') || '').includes(h))))
    return { verdict: 'slop', confidence: 'high', reason: 'Placeholder image service URLs found in <img> tags.' };
  return { verdict: 'human', confidence: 'high', reason: 'No lorem ipsum or placeholder image URLs found.' };
}

function checkSocialProof(doc) {
  const text = (doc.body?.textContent || '').toLowerCase();
  const hasSection = /testimonial|what (our )?(customers|clients|users) say|trusted by|hear from/.test(text);
  if (!hasSection) return { verdict: null, reason: 'No testimonial section detected — check manually.' };
  const hasAttribution = /\b(CEO|CTO|CPO|Founder|Co-Founder|Director|VP|Manager|Engineer|Designer|Head of)\b/.test(
    doc.body?.innerHTML || ''
  );
  if (!hasAttribution)
    return { verdict: 'slop', confidence: 'medium', reason: 'Testimonial section found but no role or title attribution detected.' };
  return { verdict: 'human', confidence: 'medium', reason: 'Testimonials with role attribution found.' };
}

function checkPerformance(doc) {
  const scripts  = Array.from(doc.querySelectorAll('script[src]'));
  const blocking = scripts.filter(
    (s) => !s.defer && !s.async && !(s.getAttribute('type') || '').includes('module')
  );
  const imgs    = Array.from(doc.querySelectorAll('img'));
  const notWebP = imgs.filter((img) => {
    const src = img.getAttribute('src') || '';
    return src && !src.includes('.webp') && !src.includes('.avif') &&
      /\.(jpe?g|png|gif)/.test(src);
  });
  const noLazy = imgs.filter((img) => !img.getAttribute('loading'));

  if (blocking.length > 3)
    return { verdict: 'slop', confidence: 'high',   reason: `${blocking.length} render-blocking scripts (no defer/async).` };
  if (notWebP.length > 3)
    return { verdict: 'slop', confidence: 'medium', reason: `${notWebP.length} images not using WebP/AVIF format.` };
  if (noLazy.length > 5)
    return { verdict: 'slop', confidence: 'low',    reason: `${noLazy.length} images missing loading="lazy".` };
  return { verdict: 'human', confidence: 'medium', reason: 'Scripts appear non-blocking and image formats look reasonable.' };
}

function checkAccessibility(doc) {
  const imgs       = Array.from(doc.querySelectorAll('img'));
  const missingAlt = imgs.filter((img) => !img.hasAttribute('alt'));
  if (missingAlt.length > 0)
    return { verdict: 'slop', confidence: 'high', reason: `${missingAlt.length} image(s) with no alt attribute.` };
  const emptyAlt = imgs.filter(
    (img) => img.getAttribute('alt')?.trim() === '' && !img.getAttribute('role')
  );
  if (imgs.length > 0 && emptyAlt.length > imgs.length * 0.5)
    return { verdict: 'slop', confidence: 'medium', reason: 'Most images have empty alt text — likely inaccessible.' };
  if (!doc.querySelector('[aria-label],[aria-labelledby],[role]'))
    return { verdict: 'slop', confidence: 'low', reason: 'No ARIA labels or landmark roles detected.' };
  return { verdict: 'human', confidence: 'medium', reason: 'Images have alt text and ARIA roles are present.' };
}

function checkMeta(doc) {
  const missing = [];
  if (!doc.querySelector('title')?.textContent.trim())      missing.push('page title');
  if (!doc.querySelector('meta[name="description"]'))       missing.push('meta description');
  if (!doc.querySelector('meta[property="og:title"]'))      missing.push('og:title');
  if (!doc.querySelector('meta[property="og:image"]'))      missing.push('og:image');
  if (!doc.querySelector('link[rel~="icon"]'))              missing.push('favicon');

  if (missing.length >= 3)
    return { verdict: 'slop', confidence: 'high',   reason: `Missing: ${missing.join(', ')}.` };
  if (missing.length >= 1)
    return { verdict: 'slop', confidence: 'medium', reason: `Incomplete meta — missing: ${missing.join(', ')}.` };
  return { verdict: 'human', confidence: 'high', reason: 'Title, description, OG tags, and favicon all present.' };
}

// ── Apply auto results to UI ──────────────────────────────────────────────
function applyResults(results) {
  overrides.clear();

  Object.entries(results).forEach(([key, result]) => {
    if (!result) return; // manual-only question

    autoResults[key] = result;
    const tag    = document.getElementById(`tag-${key}`);
    const reason = document.getElementById(`reason-${key}`);

    if (result.verdict) {
      setRadio(key, result.verdict);
      if (tag) {
        tag.hidden       = false;
        tag.dataset.state = 'auto';
        tag.textContent  = `Auto · ${result.confidence}`;
      }
    } else {
      if (tag) {
        tag.hidden       = false;
        tag.dataset.state = 'needs-manual';
        tag.textContent  = 'Manual check';
      }
    }

    if (reason && result.reason) {
      reason.hidden      = false;
      reason.textContent = result.reason;
    }
  });

  calculateScore();
}

function setRadio(key, value) {
  const radio = form.querySelector(`.radio-btn[name="${key}"][value="${value}"]`);
  if (radio) radio.checked = true;
}

// ── Score ─────────────────────────────────────────────────────────────────
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

  const pct            = Math.round((humanCount / groups.length) * 100);
  const { key, label } = getVerdict(pct);

  scoreNumber.textContent      = pct + '%';
  scoreVerdict.textContent     = label;
  progressBar.style.width      = pct + '%';
  scoreWidget.dataset.verdict  = key;

  renderSuggestions(slopKeys);
}

// ── Suggestions ───────────────────────────────────────────────────────────
function makeSuggestionEl(fix) {
  const item   = document.createElement('div');
  item.className = 'suggestion-item';

  const dot = document.createElement('div');
  dot.className = 'suggestion-dot';
  dot.setAttribute('aria-hidden', 'true');

  const body   = document.createElement('div');
  const title  = document.createElement('p');
  const detail = document.createElement('span');

  title.textContent  = fix.title;
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

// ── Events ────────────────────────────────────────────────────────────────
analyzeBtn.addEventListener('click', analyze);

urlInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') analyze();
});

urlInput.addEventListener('input', () => {
  const val     = urlInput.value.trim();
  const isBlank = !val || val === 'https://' || val === 'http://';
  targetDisplay.textContent = isBlank
    ? 'Enter a URL above to begin'
    : 'Analyzing: ' + val.replace(/^https?:\/\//, '');
});

resetBtn.addEventListener('click', () => {
  Object.keys(autoResults).forEach((k) => delete autoResults[k]);
  overrides.clear();

  form.querySelectorAll('.radio-btn[value="human"]').forEach((btn) => { btn.checked = true; });

  form.querySelectorAll('.auto-tag').forEach((el) => {
    if (el.dataset.state !== 'manual-only') el.hidden = true;
  });
  form.querySelectorAll('.auto-reason').forEach((el) => {
    el.hidden = true;
    el.textContent = '';
  });

  analyzeStatus.hidden = true;
  calculateScore();
});

form.addEventListener('change', (e) => {
  if (!e.target.classList.contains('radio-btn')) return;
  const key  = e.target.name;
  const auto = autoResults[key];
  const tag  = document.getElementById(`tag-${key}`);

  if (auto?.verdict && tag) {
    if (e.target.value !== auto.verdict) {
      overrides.add(key);
      tag.dataset.state = 'override';
      tag.textContent   = 'Override';
    } else {
      overrides.delete(key);
      tag.dataset.state = 'auto';
      tag.textContent   = `Auto · ${auto.confidence}`;
    }
  }

  calculateScore();
});

// ── Boot ──────────────────────────────────────────────────────────────────
init();
