// V3 CSS for report generator - Matches paletz-report-v3.html reference
// Key changes from V9:
// - Container: 820px (was 860px)
// - Tighter spacing: 48px dividers (was 80px)
// - Gap cards with badges (not TLDR boxes)
// - Horizontal bar chart for reviews (not table)
// - Total strip (black bar)
// - Numbered build list (not feature icons)
// - Removed: TLDR boxes, flow diagrams, proof grid, two-options

module.exports = function getV3CSS() {
  return `
<style>
  :root {
    --ink: #0a0a0a;
    --ink-soft: #1a1a1a;
    --slate: #4a4a4a;
    --slate-light: #6b6b6b;
    --muted: #9a9a9a;
    --border: #e8e8e8;
    --warm-white: #f8f8f6;
    --cream: #FDFCF9;
    --white: #ffffff;
    --primary: #4f46e5;
    --primary-light: #6366f1;
    --primary-subtle: rgba(79, 70, 229, 0.06);
    --success: #059669;
    --danger: #dc2626;
  }

  * { box-sizing: border-box; margin: 0; padding: 0; }
  html { scroll-behavior: smooth; }

  body {
    font-family: 'Outfit', -apple-system, BlinkMacSystemFont, sans-serif;
    background: var(--cream);
    color: var(--slate);
    line-height: 1.7;
    font-size: 17px;
    -webkit-font-smoothing: antialiased;
  }

  .container {
    max-width: 820px;
    margin: 0 auto;
    padding: 40px 40px;
  }

  h1, h2, h3 {
    font-family: 'Fraunces', Georgia, serif;
    font-weight: 600;
    color: var(--ink);
    line-height: 1.15;
    letter-spacing: -0.02em;
  }

  /* ========== HEADER ========== */
  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding-bottom: 12px;
    border-bottom: 1px solid var(--border);
  }

  .logo {
    font-family: 'Fraunces', serif;
    font-size: 1.1rem;
    font-weight: 700;
    color: var(--ink);
  }

  .meta {
    font-size: 0.75rem;
    color: var(--slate-light);
    font-weight: 500;
  }

  /* ========== HERO ========== */
  .hero {
    text-align: center;
    padding: 40px 0 28px;
    min-height: auto;
    display: flex;
    flex-direction: column;
    justify-content: center;
  }

  .hero-context {
    font-size: 0.7rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 4px;
    color: var(--primary);
    margin-bottom: 24px;
    opacity: 0.85;
  }

  .hero-setup {
    font-family: 'Fraunces', Georgia, serif;
    font-size: 1.6rem;
    font-weight: 400;
    color: var(--slate);
    margin-bottom: 18px;
  }

  .search-bar {
    display: inline-flex;
    align-items: center;
    gap: 12px;
    background: white;
    border: 1px solid rgba(0,0,0,0.08);
    border-radius: 50px;
    padding: 16px 28px;
    margin: 0 auto 28px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.04), 0 8px 40px rgba(0,0,0,0.08);
    min-width: 420px;
  }

  .search-bar-inner {
    display: flex;
    align-items: center;
    font-family: 'Outfit', sans-serif;
    font-size: 1.2rem;
    color: var(--ink);
    text-align: left;
    min-width: 280px;
  }

  .search-bar-inner .cursor-blink {
    display: inline-block;
    width: 2px;
    height: 1.3em;
    background: var(--primary);
    margin-left: 1px;
    vertical-align: text-bottom;
    animation: blink 1s step-end infinite;
  }

  @keyframes blink {
    0%, 100% { opacity: 1; }
    50% { opacity: 0; }
  }

  .hero h1 {
    font-size: 3.25rem;
    line-height: 1.1;
    letter-spacing: -0.03em;
    margin-bottom: 18px;
  }

  .hero h1 .highlight {
    color: var(--primary);
  }

  .hero-sub {
    font-size: 1.125rem;
    color: var(--slate);
    max-width: 540px;
    margin: 0 auto;
    line-height: 1.75;
  }

  .scroll-hint {
    margin-top: 28px;
    font-size: 0.75rem;
    color: var(--muted);
    letter-spacing: 1px;
    text-transform: uppercase;
    font-weight: 600;
  }

  .scroll-hint span {
    display: block;
    margin-top: 6px;
    font-size: 1.1rem;
    animation: bounce 2s infinite;
  }

  @keyframes bounce {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(5px); }
  }

  /* ========== DIVIDER ========== */
  .divider {
    height: 1px;
    background: linear-gradient(to right, transparent, var(--border), transparent);
    margin: 56px 0;
  }

  /* ========== NARRATIVE TEXT ========== */
  .narrative h2 {
    font-size: 1.875rem;
    margin-bottom: 14px;
    letter-spacing: -0.02em;
    padding-left: 14px;
    border-left: 3px solid var(--primary);
  }

  .narrative p {
    margin-bottom: 14px;
    line-height: 1.75;
  }

  .narrative p:last-child {
    margin-bottom: 0;
  }

  /* ========== BADGE ========== */
  .badge {
    display: inline-block;
    font-family: 'Outfit', sans-serif;
    font-size: 0.625rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 1.5px;
    padding: 4px 12px;
    border-radius: 50px;
    margin-bottom: 12px;
  }

  .badge-search {
    background: rgba(66, 133, 244, 0.1);
    color: #4285F4;
  }

  .badge-social {
    background: rgba(59, 89, 152, 0.1);
    color: #3b5998;
  }

  .badge-intake {
    background: rgba(5, 150, 105, 0.1);
    color: var(--success);
  }

  /* ========== GAP CARDS ========== */
  .gap-card {
    background: white;
    border: 1px solid var(--border);
    border-radius: 16px;
    padding: 30px;
    margin: 20px 0;
    box-shadow: 0 2px 8px rgba(0,0,0,0.025);
  }

  .gap-search { border-top: 4px solid #4285F4; }
  .gap-social { border-top: 4px solid #3b5998; }
  .gap-intake { border-top: 4px solid #059669; }

  .gap-search .gap-stat-number { color: #4285F4; }
  .gap-social .gap-stat-number { color: #3b5998; }
  .gap-intake .gap-stat-number { color: #059669; }

  .narrative + .gap-card {
    margin-top: 24px;
  }

  .gap-card h3 {
    font-size: 1.3rem;
    line-height: 1.3;
    margin-bottom: 0;
    letter-spacing: -0.01em;
  }

  .gap-stat {
    text-align: center;
    padding: 18px 0;
    margin: 14px 0 18px;
    border-top: 1px solid var(--border);
    border-bottom: 1px solid var(--border);
  }

  .gap-stat-number {
    font-family: 'Fraunces', serif;
    font-size: 2rem;
    font-weight: 700;
    color: var(--ink);
    letter-spacing: -0.02em;
  }

  .gap-stat-number span {
    font-size: 1rem;
    font-weight: 500;
    color: var(--slate-light);
  }

  .gap-stat-label {
    font-size: 0.65rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 1.5px;
    color: var(--muted);
    margin-top: 4px;
  }

  .gap-card p {
    margin-bottom: 16px;
    line-height: 1.75;
    font-size: 0.975rem;
  }

  .gap-card p:last-child {
    margin-bottom: 0;
  }

  .math-box {
    background: var(--warm-white);
    padding: 18px 20px;
    border-radius: 8px;
    font-size: 0.85rem;
    border: 1px solid var(--border);
    color: var(--slate);
    margin-top: 20px;
    line-height: 1.65;
    position: relative;
  }

  .math-box-label {
    display: block;
    font-size: 0.6rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 1.5px;
    color: var(--muted);
    margin-bottom: 8px;
  }

  .math-box strong {
    color: var(--ink);
  }

  /* ========== BEFORE/AFTER ========== */
  .before-after {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
    margin: 14px 0;
  }

  .ba-side {
    padding: 18px;
    border-radius: 12px;
    font-size: 0.9rem;
    line-height: 1.7;
  }

  .ba-before {
    background: var(--warm-white);
    border: 1px solid var(--border);
  }

  .ba-after {
    background: linear-gradient(135deg, rgba(5, 150, 105, 0.05), rgba(16, 185, 129, 0.02));
    border: 1px solid rgba(5, 150, 105, 0.2);
  }

  .ba-label {
    font-size: 0.65rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 1.5px;
    margin-bottom: 8px;
    color: var(--slate-light);
  }

  .ba-label.good { color: var(--success); }

  .ba-side p { margin: 0; color: var(--slate); }

  .ba-social {
    background: linear-gradient(135deg, rgba(59, 89, 152, 0.05), rgba(59, 89, 152, 0.02));
    border: 1px solid rgba(59, 89, 152, 0.2);
  }

  /* ========== SERP MOCKUP ========== */
  .serp-mockup {
    background: white;
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 16px 20px;
    margin: 14px 0;
    box-shadow: 0 1px 4px rgba(0,0,0,0.04);
  }

  .serp-query {
    display: flex;
    align-items: center;
    gap: 8px;
    padding-bottom: 12px;
    margin-bottom: 10px;
    border-bottom: 1px solid var(--border);
    color: var(--slate-light);
  }

  .serp-query span {
    font-style: italic;
    font-size: 0.9rem;
    color: var(--ink);
  }

  .serp-row {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 7px 8px;
    border-radius: 6px;
  }

  .serp-row + .serp-row {
    margin-top: 2px;
  }

  .serp-tag {
    display: inline-block;
    font-size: 0.55rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    padding: 2px 7px;
    border-radius: 3px;
    min-width: 32px;
    text-align: center;
    flex-shrink: 0;
  }

  .serp-tag-ad {
    background: rgba(66, 133, 244, 0.12);
    color: #4285F4;
  }

  .serp-tag-map {
    background: rgba(52, 168, 83, 0.12);
    color: #34A853;
  }

  .serp-tag-you {
    background: rgba(220, 38, 38, 0.12);
    color: var(--danger);
  }

  .serp-name {
    font-weight: 600;
    font-size: 0.875rem;
    color: var(--ink);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 300px;
  }

  .serp-note {
    margin-left: auto;
    font-size: 0.75rem;
    color: var(--muted);
    white-space: nowrap;
    flex-shrink: 0;
  }

  .serp-you {
    background: rgba(220, 38, 38, 0.04);
    border: 1px dashed rgba(220, 38, 38, 0.25);
  }

  .serp-you .serp-name {
    color: var(--danger);
  }

  .serp-you .serp-note {
    color: var(--danger);
    font-weight: 600;
  }

  .serp-you-running {
    background: rgba(66, 133, 244, 0.04);
    border: 1px solid rgba(66, 133, 244, 0.15);
  }

  .serp-you-running .serp-note {
    color: #4285F4;
    font-weight: 500;
    font-style: italic;
  }

  .serp-ellipsis {
    padding: 2px 8px;
  }

  /* ========== TOTAL STRIP ========== */
  .total-strip {
    background: linear-gradient(135deg, #4f46e5, #6366f1);
    color: white;
    border-radius: 14px;
    padding: 28px 32px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin: 24px 0 16px;
  }

  .total-strip-text {
    font-size: 1rem;
    font-weight: 500;
    opacity: 0.9;
  }

  .total-strip-number {
    font-family: 'Fraunces', serif;
    font-size: 2.25rem;
    font-weight: 700;
    letter-spacing: -0.02em;
  }

  /* ========== COMPETITOR BARS ========== */
  .competitor-section {
    margin-top: 24px;
  }

  .review-bar-group {
    margin-bottom: 18px;
  }

  .review-bar-label {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    margin-bottom: 5px;
  }

  .review-bar-name {
    font-weight: 600;
    color: var(--ink);
    font-size: 0.9rem;
  }

  .review-bar-name.you {
    color: var(--danger);
  }

  .review-bar-count {
    font-family: 'Fraunces', serif;
    font-weight: 600;
    font-size: 0.95rem;
    color: var(--ink);
  }

  .review-bar-count.you {
    color: var(--danger);
  }

  .review-bar-track {
    height: 38px;
    background: var(--warm-white);
    border-radius: 6px;
    overflow: hidden;
    border: 1px solid var(--border);
  }

  @keyframes barFill { from { width: 0; } }

  .review-bar-fill {
    height: 100%;
    border-radius: 5px;
  }

  .competitor-section.visible .review-bar-fill {
    animation: barFill 0.8s ease-out backwards;
  }

  .competitor-section.visible .review-bar-group:nth-child(1) .review-bar-fill { animation-delay: 0.2s; }
  .competitor-section.visible .review-bar-group:nth-child(2) .review-bar-fill { animation-delay: 0.45s; }
  .competitor-section.visible .review-bar-group:nth-child(3) .review-bar-fill { animation-delay: 0.7s; }
  .competitor-section.visible .review-bar-group:nth-child(4) .review-bar-fill { animation-delay: 0.95s; }

  .review-bar-fill.competitor {
    background: linear-gradient(90deg, var(--primary), var(--primary-light));
  }

  .review-bar-fill.yours {
    background: linear-gradient(90deg, var(--danger), #ef4444);
    min-width: 6px;
  }

  .competitor-takeaway {
    background: rgba(79,70,229,0.03);
    border-left: 4px solid var(--primary);
    border-radius: 0 14px 14px 0;
    padding: 22px 26px;
    margin-top: 24px;
    font-size: 0.95rem;
    line-height: 1.75;
    color: var(--slate);
  }

  .competitor-takeaway strong {
    color: var(--ink);
  }

  /* ========== BUILD LIST ========== */
  .build-item {
    display: flex;
    gap: 16px;
    padding: 18px 0;
    border-bottom: 1px solid var(--border);
    align-items: flex-start;
  }

  .build-item:last-child { border-bottom: none; }

  .build-number {
    font-family: 'Fraunces', serif;
    font-size: 1.1rem;
    font-weight: 700;
    color: white;
    background: var(--primary);
    border-radius: 50%;
    width: 36px;
    height: 36px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .build-content strong {
    display: block;
    color: var(--ink);
    font-size: 0.975rem;
    margin-bottom: 3px;
  }

  .build-content p {
    font-size: 0.9rem;
    color: var(--slate);
    margin: 0;
    line-height: 1.6;
  }

  .build-timeline {
    display: inline-block;
    font-size: 0.7rem;
    font-weight: 600;
    color: var(--primary);
    background: var(--primary-subtle);
    padding: 2px 8px;
    border-radius: 4px;
    margin-top: 4px;
    letter-spacing: 0.3px;
  }

  /* ========== JOURNEY FLOW ========== */
  .journey-heading {
    text-align: center;
    font-size: 0.65rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 1.5px;
    color: var(--muted);
    margin-bottom: 4px;
    padding-top: 8px;
  }

  .journey-flow {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0;
    padding: 28px 0 8px;
  }

  .journey-step {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
  }

  .journey-icon {
    width: 48px;
    height: 48px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .journey-label {
    font-size: 0.6rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 1.5px;
    color: var(--slate-light);
  }

  .journey-line {
    width: 48px;
    height: 2px;
    border-top: 2px dashed var(--border);
    margin-bottom: 24px;
  }

  /* ========== SCROLL FADE-IN ========== */
  @keyframes fadeUp {
    from { opacity: 0; transform: translateY(24px); }
    to { opacity: 1; transform: translateY(0); }
  }

  .fade-in { opacity: 0; }
  .fade-in.visible { animation: fadeUp 0.6s ease-out forwards; }

  /* ========== GAP CONNECTORS ========== */
  .gap-connector {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    border: 2px solid var(--border);
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 0 auto;
    font-family: 'Fraunces', serif;
    font-size: 1.1rem;
    font-weight: 600;
  }

  /* ========== CALLOUT ========== */
  .callout {
    background: rgba(79,70,229,0.03);
    border-left: 4px solid var(--primary);
    border-radius: 0 10px 10px 0;
    padding: 18px 24px;
    margin: 16px 0;
    box-shadow: 0 1px 4px rgba(0,0,0,0.04);
  }

  .callout p {
    margin: 0;
    line-height: 1.75;
    color: var(--slate);
  }

  /* ========== CTA ========== */
  .cta {
    text-align: center;
    padding: 48px 36px;
    background: linear-gradient(180deg, rgba(79,70,229,0.04), rgba(99,102,241,0.08));
    border-radius: 20px;
    margin: 48px 0 36px;
    border: 1px solid rgba(79,70,229,0.12);
    box-shadow: 0 4px 20px rgba(0,0,0,0.035);
  }

  .cta h2 {
    font-size: 1.65rem;
    margin-bottom: 10px;
    letter-spacing: -0.02em;
    max-width: 480px;
    margin-left: auto;
    margin-right: auto;
  }

  .cta > p {
    font-size: 1rem;
    color: var(--slate);
    margin-bottom: 28px;
  }

  /* ========== FOOTER ========== */
  .footer {
    text-align: center;
    padding: 32px 0 16px;
    color: var(--slate-light);
    font-size: 0.8125rem;
    border-top: 1px solid var(--border);
  }

  .footer a {
    color: var(--primary);
    text-decoration: none;
    font-weight: 500;
  }

  /* ========== MOBILE ========== */
  @media (max-width: 768px) {
    .container { padding: 28px 22px; }
    .hero { min-height: auto; padding: 48px 0 36px; }
    .hero h1 { font-size: 2.125rem; }
    .hero-setup { font-size: 1.3rem; }
    .search-bar { min-width: auto; width: 100%; padding: 14px 22px; }
    .search-bar-inner { min-width: auto; font-size: 1rem; }
    .narrative h2 { font-size: 1.5rem; }
    .gap-card { padding: 24px 20px; margin: 16px 0; }
    .gap-card p { margin-bottom: 18px; line-height: 1.85; }
    .narrative + .gap-card { margin-top: 20px; }
    .gap-stat-number { font-size: 1.65rem; }
    .before-after { grid-template-columns: 1fr; }
    .total-strip { flex-direction: column; gap: 10px; text-align: center; padding: 24px; }
    .total-strip-number { font-size: 1.875rem; }
    .header { flex-direction: column; gap: 10px; text-align: center; }
    .cta { padding: 36px 22px; }
    .cta h2 { font-size: 1.4rem; }
    .divider { margin: 36px 0; }
    .journey-flow { gap: 0; }
    .journey-line { width: 24px; }
    .journey-icon { width: 40px; height: 40px; }
    .serp-name { max-width: 180px; }
    .serp-mockup { padding: 14px 16px; }
  }

  @media (max-width: 480px) {
    .hero h1 { font-size: 1.75rem; }
  }
</style>
  `;
};
