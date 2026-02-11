// V7 CSS for report generator - Matches doss-law-report-v7.html reference
// Key changes from V3:
// - ROI box (vertically centered, net revenue hero)
// - Revenue cards (badge + amount + cases, replaces gap cards)
// - Journey v2 (6-step bar, replaces 4-step journey)
// - Mini-compare (replaces before-after)
// - Guarantee section (green banner)
// - Deliverables grid (3 groups, 21 items)
// - Timeline strip (dark bar, "14 days")
// - "Your only job" box
// - Confidence grid (3 tiles)
// - Floating CTA button
// - Omnichannel intro
// - Removed: gap cards, gap stats, gap connectors, math boxes, total strip,
//   competitor bars, build list, old journey, callout, old before-after, old SERP "you" styles

module.exports = function getV3CSS() {
  return `
<style>
  :root {
    --ink: #0a0a0a;
    --slate: #4a4a4a;
    --slate-light: #6b6b6b;
    --muted: #9a9a9a;
    --border: #e8e8e8;
    --warm-white: #f8f8f6;
    --cream: #FDFCF9;
    --primary: #4f46e5;
    --primary-light: #6366f1;
    --primary-subtle: rgba(79, 70, 229, 0.06);
    --success: #059669;
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

  .container { max-width: 820px; margin: 0 auto; padding: 40px; }

  h1, h2, h3 {
    font-family: 'Fraunces', Georgia, serif;
    font-weight: 600; color: var(--ink); line-height: 1.15; letter-spacing: -0.02em;
  }

  /* ========== HEADER ========== */
  .header {
    display: flex; justify-content: space-between; align-items: center;
    padding-bottom: 12px; border-bottom: 1px solid var(--border);
  }

  .logo { font-family: 'Fraunces', serif; font-size: 1.1rem; font-weight: 700; color: var(--ink); }
  .meta { font-size: 0.75rem; color: var(--slate-light); font-weight: 500; }

  /* ========== HERO ========== */
  .hero {
    text-align: center; padding: 40px 0 28px;
    display: flex; flex-direction: column; justify-content: center;
  }

  .hero-context {
    font-size: 0.7rem; font-weight: 700; text-transform: uppercase;
    letter-spacing: 4px; color: var(--primary); margin-bottom: 24px; opacity: 0.85;
  }

  .hero-setup {
    font-family: 'Fraunces', Georgia, serif;
    font-size: 1.6rem; font-weight: 400; color: var(--slate); margin-bottom: 18px;
  }

  .search-bar {
    display: inline-flex; align-items: center; gap: 12px;
    background: white; border: 1px solid rgba(0,0,0,0.08); border-radius: 50px;
    padding: 16px 28px; margin: 0 auto 28px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.04), 0 8px 40px rgba(0,0,0,0.08);
    min-width: 420px;
  }

  .search-bar-inner {
    display: flex; align-items: center; font-family: 'Outfit', sans-serif;
    font-size: 1.2rem; color: var(--ink); text-align: left; min-width: 280px;
  }

  .search-bar-inner .cursor-blink {
    display: inline-block; width: 2px; height: 1.3em;
    background: var(--primary); margin-left: 1px; vertical-align: text-bottom;
    animation: blink 1s step-end infinite;
  }

  @keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }

  .hero h1 { font-size: 3.25rem; line-height: 1.1; letter-spacing: -0.03em; margin-bottom: 18px; }
  .hero h1 .highlight { color: var(--primary); }

  .hero-sub {
    font-size: 1.125rem; color: var(--slate);
    max-width: 540px; margin: 0 auto; line-height: 1.75;
  }

  .scroll-hint {
    margin-top: 28px; font-size: 0.75rem; color: var(--muted);
    letter-spacing: 1px; text-transform: uppercase; font-weight: 600;
  }

  .scroll-hint span { display: block; margin-top: 6px; font-size: 1.1rem; animation: bounce 2s infinite; }

  @keyframes bounce { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(5px); } }

  /* ========== OBSERVATIONS ========== */
  .observations-section {
    margin: 36px auto; max-width: 680px;
  }

  .observations-label {
    font-family: 'Fraunces', Georgia, serif; font-size: 1.125rem;
    font-weight: 600; color: var(--ink); margin-bottom: 16px;
  }

  .observation-item {
    font-size: 0.925rem; color: var(--slate); line-height: 1.7;
    margin-bottom: 8px; padding-left: 24px; text-indent: -24px;
  }

  /* ========== DIVIDER ========== */
  .divider {
    height: 1px;
    background: linear-gradient(to right, transparent, var(--border), transparent);
    margin: 48px 0;
  }

  /* ========== NARRATIVE ========== */
  .narrative h2 {
    font-size: 1.875rem; margin-bottom: 14px; letter-spacing: -0.02em;
    padding-left: 14px; border-left: 3px solid var(--primary);
  }

  .narrative p { margin-bottom: 14px; line-height: 1.75; }
  .narrative p:last-child { margin-bottom: 0; }

  /* ========== ROI BOX ========== */
  .roi-box {
    background: white; border: 2px solid var(--primary); border-radius: 16px;
    padding: 36px 32px; margin: 28px 0; text-align: center;
    box-shadow: 0 4px 20px rgba(79, 70, 229, 0.08);
  }

  .roi-hero-label {
    font-size: 0.65rem; font-weight: 700; text-transform: uppercase;
    letter-spacing: 2px; color: var(--muted); margin-bottom: 8px;
  }

  .roi-hero-number {
    font-family: 'Fraunces', serif; font-size: 2.75rem; font-weight: 700;
    color: var(--success); letter-spacing: -0.03em; line-height: 1.1;
  }

  .roi-hero-number span {
    font-size: 1.1rem; font-weight: 500; color: var(--slate-light);
  }

  .roi-breakdown {
    display: flex; align-items: center; justify-content: center; gap: 24px;
    margin-top: 20px; padding-top: 20px; border-top: 1px solid var(--border);
  }

  .roi-detail { text-align: center; }

  .roi-detail-number {
    font-family: 'Fraunces', serif; font-size: 1.2rem; font-weight: 700;
    color: var(--ink); letter-spacing: -0.02em;
  }

  .roi-detail-label {
    font-size: 0.6rem; font-weight: 600; text-transform: uppercase;
    letter-spacing: 1px; color: var(--muted); margin-top: 2px;
  }

  .roi-detail-divider {
    font-family: 'Fraunces', serif; font-size: 1.1rem; font-weight: 600;
    color: var(--border);
  }

  .roi-bottom {
    margin-top: 20px; padding-top: 18px; border-top: 1px solid var(--border);
  }

  .roi-annual-number {
    font-family: 'Fraunces', serif; font-size: 1.2rem; font-weight: 700;
    color: var(--primary); letter-spacing: -0.02em;
  }

  .roi-annual-label {
    font-size: 0.7rem; color: var(--slate-light); margin-top: 2px;
  }

  .roi-cases {
    display: inline-block; margin-top: 10px; background: rgba(5, 150, 105, 0.08);
    padding: 6px 16px; border-radius: 50px; font-size: 0.8rem;
    font-weight: 600; color: var(--success);
  }

  /* ========== OMNICHANNEL INTRO ========== */
  .omni-intro {
    background: white; border: 1px solid var(--border); border-radius: 14px;
    padding: 24px 28px; margin: 24px 0 8px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.025);
  }

  .omni-intro p {
    font-size: 0.95rem; color: var(--slate); line-height: 1.75; margin: 0;
  }

  .omni-intro strong { color: var(--ink); }

  /* ========== JOURNEY V2 ========== */
  .journey-v2 {
    display: flex; align-items: stretch; gap: 0; margin: 20px 0 24px;
    background: white; border: 1px solid var(--border); border-radius: 12px;
    overflow: hidden;
  }

  .journey-v2-step {
    flex: 1; padding: 16px 12px; text-align: center;
    border-right: 1px solid var(--border); position: relative;
  }

  .journey-v2-step:last-child { border-right: none; }

  .journey-v2-step::after {
    content: '\\2192'; position: absolute; right: -8px; top: 50%;
    transform: translateY(-50%); font-size: 0.9rem; color: var(--muted);
    background: white; padding: 2px 0; z-index: 1;
  }

  .journey-v2-step:last-child::after { display: none; }

  .journey-v2-icon { font-size: 1.2rem; margin-bottom: 4px; }

  .journey-v2-label {
    font-size: 0.7rem; font-weight: 700; text-transform: uppercase;
    letter-spacing: 1px; color: var(--ink);
  }

  .journey-v2-sub {
    font-size: 0.65rem; color: var(--muted); margin-top: 2px; line-height: 1.3;
  }

  .journey-v2-handled {
    font-size: 0.55rem; font-weight: 700; text-transform: uppercase;
    letter-spacing: 1px; color: var(--success); margin-top: 6px;
  }

  /* ========== REVENUE CARDS ========== */
  .revenue-cards { display: flex; flex-direction: column; gap: 16px; margin: 24px 0; }

  .revenue-card {
    background: white; border: 1px solid var(--border); border-radius: 14px;
    padding: 26px 28px; box-shadow: 0 2px 8px rgba(0,0,0,0.025);
  }

  .revenue-card-header {
    display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px;
  }

  .revenue-card-badge {
    display: inline-block; font-family: 'Outfit', sans-serif;
    font-size: 0.6rem; font-weight: 700; text-transform: uppercase;
    letter-spacing: 1.5px; padding: 3px 10px; border-radius: 50px;
  }

  .revenue-card-badge.search { background: rgba(66, 133, 244, 0.1); color: #4285F4; }
  .revenue-card-badge.social { background: rgba(59, 89, 152, 0.1); color: #3b5998; }
  .revenue-card-badge.intake { background: rgba(5, 150, 105, 0.1); color: var(--success); }

  .revenue-card-amount { text-align: right; }

  .revenue-card-number {
    font-family: 'Fraunces', serif; font-size: 1.4rem; font-weight: 700;
    letter-spacing: -0.02em; white-space: nowrap;
  }

  .revenue-card:nth-child(1) .revenue-card-number { color: #4285F4; }
  .revenue-card:nth-child(2) .revenue-card-number { color: #3b5998; }
  .revenue-card:nth-child(3) .revenue-card-number { color: var(--success); }

  .revenue-card-sub {
    font-size: 0.65rem; font-weight: 600; text-transform: uppercase;
    letter-spacing: 1px; color: var(--muted); margin-top: 1px; text-align: right;
  }

  .revenue-card-cases {
    font-size: 0.75rem; font-weight: 600; color: var(--slate-light);
    text-align: right; margin-top: 4px;
  }

  .revenue-card-body {
    font-size: 0.925rem; color: var(--slate); line-height: 1.7; margin-bottom: 14px;
  }

  .revenue-card-body strong { color: var(--ink); font-weight: 600; }

  /* ========== SERP MOCKUP ========== */
  .serp-mockup {
    background: white; border: 1px solid var(--border); border-radius: 10px;
    padding: 14px 18px; box-shadow: 0 1px 4px rgba(0,0,0,0.04);
  }

  .serp-query {
    display: flex; align-items: center; gap: 8px; padding-bottom: 10px;
    margin-bottom: 8px; border-bottom: 1px solid var(--border); color: var(--slate-light);
  }

  .serp-query span { font-style: italic; font-size: 0.875rem; color: var(--ink); }

  .serp-row { display: flex; align-items: center; gap: 10px; padding: 6px 8px; border-radius: 6px; }
  .serp-row + .serp-row { margin-top: 2px; }

  .serp-tag {
    display: inline-block; font-size: 0.5rem; font-weight: 700; text-transform: uppercase;
    letter-spacing: 0.5px; padding: 2px 7px; border-radius: 3px; min-width: 28px;
    text-align: center; flex-shrink: 0;
  }

  .serp-tag-ad { background: rgba(66, 133, 244, 0.12); color: #4285F4; }
  .serp-tag-map { background: rgba(52, 168, 83, 0.12); color: #34A853; }
  .serp-tag-you { background: rgba(79, 70, 229, 0.12); color: var(--primary); }

  .serp-name {
    font-weight: 600; font-size: 0.825rem; color: var(--ink);
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 300px;
  }

  .serp-note { margin-left: auto; font-size: 0.7rem; color: var(--muted); white-space: nowrap; flex-shrink: 0; }

  .serp-you { background: rgba(79, 70, 229, 0.04); border: 1px solid rgba(79, 70, 229, 0.2); }
  .serp-you .serp-name { color: var(--primary); }
  .serp-you .serp-note { color: var(--primary); font-weight: 600; }

  /* ========== MINI COMPARE ========== */
  .mini-compare { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }

  .mini-compare-side {
    padding: 14px 16px; border-radius: 10px; font-size: 0.85rem; line-height: 1.6;
  }

  .mini-compare-label {
    font-size: 0.6rem; font-weight: 700; text-transform: uppercase;
    letter-spacing: 1.5px; margin-bottom: 6px;
  }

  .mini-compare-side p { margin: 0; color: var(--slate); }

  .mini-compare-a { background: var(--warm-white); border: 1px solid var(--border); }
  .mini-compare-a .mini-compare-label { color: var(--slate-light); }

  .mini-compare-b-social {
    background: linear-gradient(135deg, rgba(59, 89, 152, 0.05), rgba(59, 89, 152, 0.02));
    border: 1px solid rgba(59, 89, 152, 0.2);
  }
  .mini-compare-b-social .mini-compare-label { color: #3b5998; }

  .mini-compare-b-intake {
    background: linear-gradient(135deg, rgba(5, 150, 105, 0.05), rgba(16, 185, 129, 0.02));
    border: 1px solid rgba(5, 150, 105, 0.2);
  }
  .mini-compare-b-intake .mini-compare-label { color: var(--success); }

  /* ========== CARD CONNECTOR ========== */
  .card-connector {
    width: 32px; height: 32px; border-radius: 50%; border: 2px solid var(--border);
    display: flex; align-items: center; justify-content: center; margin: 0 auto;
    font-family: 'Fraunces', serif; font-size: 1rem; font-weight: 600; color: var(--muted);
  }

  /* ========== GUARANTEE ========== */
  .guarantee-section {
    background: linear-gradient(135deg, #059669, #10b981);
    color: white; border-radius: 16px; padding: 36px 32px; margin: 32px 0; text-align: center;
  }

  .guarantee-label {
    font-size: 0.65rem; font-weight: 700; text-transform: uppercase;
    letter-spacing: 2px; opacity: 0.8; margin-bottom: 12px;
  }

  .guarantee-headline {
    font-family: 'Fraunces', serif; font-size: 1.65rem; font-weight: 700;
    color: white; margin-bottom: 10px; letter-spacing: -0.02em;
  }

  .guarantee-sub {
    font-size: 1rem; opacity: 0.9; max-width: 520px;
    margin: 0 auto; line-height: 1.7;
  }

  /* ========== CASE STUDY ========== */
  .case-study {
    background: white; border: 1px solid var(--border); border-radius: 16px;
    padding: 30px; margin: 24px 0; box-shadow: 0 2px 8px rgba(0,0,0,0.025); text-align: center;
  }

  .case-study-label {
    font-size: 0.625rem; font-weight: 700; text-transform: uppercase;
    letter-spacing: 1.5px; color: var(--success); margin-bottom: 12px;
  }

  .case-study-firm {
    font-family: 'Fraunces', Georgia, serif; font-size: 1.3rem;
    font-weight: 600; color: var(--ink); margin-bottom: 16px;
  }

  .case-study-stats { display: flex; align-items: center; justify-content: center; gap: 24px; }
  .case-study-stat { display: flex; flex-direction: column; align-items: center; }

  .case-study-number {
    font-family: 'Fraunces', serif; font-size: 2rem; font-weight: 700;
    color: var(--primary); letter-spacing: -0.02em;
  }

  .case-study-desc {
    font-size: 0.75rem; font-weight: 600; text-transform: uppercase;
    letter-spacing: 1px; color: var(--muted); margin-top: 4px;
  }

  .case-study-arrow { font-size: 1.5rem; color: var(--success); font-weight: 700; }

  /* ========== DELIVERABLES ========== */
  .deliverables-group { margin-bottom: 28px; }

  .deliverables-group-label {
    font-size: 0.65rem; font-weight: 700; text-transform: uppercase;
    letter-spacing: 2px; color: var(--primary); margin-bottom: 12px;
    padding-bottom: 8px; border-bottom: 1px solid var(--border);
  }

  .deliverables-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }

  .deliverable-item {
    background: white; border: 1px solid var(--border); border-radius: 12px;
    padding: 14px 16px; display: flex; align-items: flex-start; gap: 10px;
  }

  .deliverable-check {
    width: 20px; height: 20px; background: rgba(5, 150, 105, 0.1);
    border-radius: 50%; display: flex; align-items: center; justify-content: center;
    flex-shrink: 0; margin-top: 1px; color: var(--success);
  }

  .deliverable-text strong { display: block; font-size: 0.85rem; color: var(--ink); }
  .deliverable-text p { font-size: 0.75rem; color: var(--slate-light); margin: 2px 0 0; line-height: 1.45; }

  /* ========== TIMELINE STRIP ========== */
  .timeline-strip {
    background: var(--ink); color: white; border-radius: 14px;
    padding: 24px 32px; display: flex; justify-content: space-between;
    align-items: center; margin: 28px 0;
  }

  .timeline-strip-text { font-size: 1rem; font-weight: 500; opacity: 0.85; }

  .timeline-strip-number {
    font-family: 'Fraunces', serif; font-size: 1.75rem; font-weight: 700;
  }

  /* ========== YOUR ONLY JOB ========== */
  .only-job {
    background: linear-gradient(135deg, rgba(5, 150, 105, 0.06), rgba(16, 185, 129, 0.03));
    border: 1px solid rgba(5, 150, 105, 0.2);
    border-radius: 16px; padding: 36px; text-align: center; margin: 28px 0;
  }

  .only-job-label {
    font-size: 0.65rem; font-weight: 700; text-transform: uppercase;
    letter-spacing: 2px; color: var(--success); margin-bottom: 12px;
  }

  .only-job-big {
    font-family: 'Fraunces', serif; font-size: 1.5rem; font-weight: 600;
    color: var(--ink); line-height: 1.4;
  }

  .only-job-sub {
    font-size: 0.95rem; color: var(--slate); margin-top: 8px;
  }

  /* ========== CONFIDENCE ========== */
  .confidence-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; margin: 24px 0; }

  .confidence-item {
    text-align: center; padding: 18px 14px; background: white;
    border: 1px solid var(--border); border-radius: 12px;
  }

  .confidence-icon { font-size: 1.3rem; margin-bottom: 6px; }
  .confidence-item strong { display: block; font-size: 0.875rem; color: var(--ink); margin-bottom: 3px; }
  .confidence-item p { font-size: 0.75rem; color: var(--slate-light); margin: 0; line-height: 1.45; }

  /* ========== CTA ========== */
  .cta {
    text-align: center; padding: 48px 36px;
    background: linear-gradient(180deg, rgba(79,70,229,0.04), rgba(99,102,241,0.08));
    border-radius: 20px; margin: 40px 0 36px;
    border: 1px solid rgba(79,70,229,0.12); box-shadow: 0 4px 20px rgba(0,0,0,0.035);
  }

  .cta h2 {
    font-size: 1.65rem; margin-bottom: 10px; letter-spacing: -0.02em;
    max-width: 480px; margin-left: auto; margin-right: auto;
  }

  .cta > p { font-size: 1rem; color: var(--slate); margin-bottom: 28px; }

  /* ========== FLOATING CTA ========== */
  .floating-cta {
    position: fixed; bottom: 24px; right: 24px; z-index: 100;
    opacity: 0; transform: translateY(20px);
    transition: opacity 0.3s ease, transform 0.3s ease;
    pointer-events: none;
  }

  .floating-cta.visible { opacity: 1; transform: translateY(0); pointer-events: all; }

  .floating-cta a {
    display: flex; align-items: center; gap: 8px;
    background: var(--primary); color: white; text-decoration: none;
    padding: 14px 24px; border-radius: 50px; font-weight: 600; font-size: 0.925rem;
    box-shadow: 0 4px 20px rgba(79, 70, 229, 0.4);
    transition: background 0.2s, box-shadow 0.2s, transform 0.2s;
  }

  .floating-cta a:hover {
    background: var(--primary-light);
    box-shadow: 0 6px 28px rgba(79, 70, 229, 0.5);
    transform: translateY(-2px);
  }

  /* ========== FADE ========== */
  @keyframes fadeUp {
    from { opacity: 0; transform: translateY(24px); }
    to { opacity: 1; transform: translateY(0); }
  }

  .fade-in { opacity: 0; }
  .fade-in.visible { animation: fadeUp 0.6s ease-out forwards; }

  /* ========== FOOTER ========== */
  .footer {
    text-align: center; padding: 32px 0 16px; color: var(--slate-light);
    font-size: 0.8125rem; border-top: 1px solid var(--border);
  }

  .footer a { color: var(--primary); text-decoration: none; font-weight: 500; }

  /* ========== MOBILE ========== */
  @media (max-width: 768px) {
    .container { padding: 28px 22px; }
    .hero { padding: 48px 0 36px; }
    .hero h1 { font-size: 2.125rem; }
    .hero-setup { font-size: 1.3rem; }
    .search-bar { min-width: auto; width: 100%; padding: 14px 22px; }
    .search-bar-inner { min-width: auto; font-size: 1rem; }
    .narrative h2 { font-size: 1.5rem; }
    .header { flex-direction: column; gap: 10px; text-align: center; }
    .cta { padding: 36px 22px; }
    .cta h2 { font-size: 1.4rem; }
    .divider { margin: 36px 0; }
    .case-study { padding: 24px 20px; }
    .case-study-number { font-size: 1.65rem; }
    .case-study-stats { gap: 16px; }
    .guarantee-section { padding: 28px 22px; }
    .guarantee-headline { font-size: 1.4rem; }
    .roi-box { padding: 28px 20px; }
    .roi-hero-number { font-size: 2rem; }
    .roi-breakdown { gap: 16px; }
    .roi-detail-number { font-size: 1rem; }
    .deliverables-grid { grid-template-columns: 1fr; }
    .confidence-grid { grid-template-columns: 1fr; }
    .timeline-strip { flex-direction: column; gap: 8px; text-align: center; padding: 20px; }
    .revenue-card { padding: 20px; }
    .revenue-card-header { flex-direction: column; align-items: flex-start; gap: 8px; }
    .revenue-card-amount { text-align: left; }
    .revenue-card-sub { text-align: left; }
    .revenue-card-cases { text-align: left; }
    .mini-compare { grid-template-columns: 1fr; }
    .serp-name { max-width: 180px; }
    .journey-v2 { flex-direction: column; }
    .journey-v2-step { border-right: none; border-bottom: 1px solid var(--border); padding: 12px 16px; }
    .journey-v2-step:last-child { border-bottom: none; }
    .journey-v2-step::after { display: none; }
    .floating-cta { bottom: 16px; right: 16px; }
    .floating-cta a { padding: 12px 20px; font-size: 0.85rem; }
  }

  @media (max-width: 480px) {
    .hero h1 { font-size: 1.75rem; }
  }
</style>
  `;
};
