// V9 CSS for report generator
module.exports = function getV9CSS() {
  return `
<style>
  :root {
    --ink: #0a0a0a;
    --ink-soft: #171717;
    --slate: #525252;
    --slate-light: #737373;
    --muted: #a3a3a3;
    --border: #e5e5e5;
    --warm-white: #fafafa;
    --cream: #FDFBF7;
    --white: #ffffff;
    --primary: #6366f1;
    --primary-light: #818cf8;
    --accent: #8b5cf6;
    --success: #10b981;
    --danger: #ef4444;
  }

  * { box-sizing: border-box; margin: 0; padding: 0; }
  
  body { 
    font-family: 'Outfit', -apple-system, sans-serif; 
    background: var(--cream);
    color: var(--slate); 
    line-height: 1.8;
    font-size: 17px;
  }

  .container { 
    max-width: 820px; 
    margin: 0 auto; 
    padding: 60px 32px;
  }

  h1, h2, h3 { 
    font-family: 'Fraunces', Georgia, serif;
    font-weight: 600;
    color: var(--ink);
    line-height: 1.2;
  }

  /* Header */
  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding-bottom: 32px;
    border-bottom: 1px solid var(--border);
    margin-bottom: 60px;
  }

  .logo {
    font-family: 'Fraunces', serif;
    font-size: 1.5rem;
    font-weight: 700;
    color: var(--ink);
  }

  .meta {
    font-size: 0.875rem;
    color: var(--slate-light);
  }

  /* CENTERED HERO (MATCHES WEBSITE) */
  .hero {
    text-align: center;
    padding: 60px 0 80px;
  }

  .hero-label {
    font-size: 0.75rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 2px;
    color: var(--primary);
    margin-bottom: 20px;
  }

  .hero-setup {
    font-family: 'Fraunces', Georgia, serif;
    font-size: 2rem;
    font-weight: 400;
    color: var(--ink);
    margin-bottom: 24px;
  }

  .search-bar-mockup {
    display: inline-flex;
    align-items: center;
    gap: 16px;
    background: white;
    border: 1px solid #e5e5e5;
    border-radius: 32px;
    padding: 20px 32px;
    margin: 0 auto 32px;
    box-shadow: 0 4px 20px rgba(0,0,0,0.08);
    min-width: 420px;
  }

  .google-g {
    flex-shrink: 0;
  }

  .search-text {
    font-family: 'Outfit', sans-serif;
    font-size: 1.25rem;
    color: #1a1a1a;
    text-align: left;
    min-width: 280px;
  }

  .cursor {
    font-weight: 300;
    color: #1a1a1a;
    animation: blink 1s infinite;
    margin-left: -4px;
  }

  @keyframes blink {
    0%, 50% { opacity: 1; }
    51%, 100% { opacity: 0; }
  }

  .hero-punch {
    font-family: 'Fraunces', Georgia, serif;
    font-size: 3.25rem;
    font-weight: 600;
    line-height: 1.15;
    color: var(--ink);
    margin: 32px 0 20px;
  }

  .hero-punch .accent {
    color: var(--primary);
    display: block;
  }

  .hero-cost {
    font-family: 'Outfit', sans-serif;
    font-size: 1.25rem;
    color: var(--slate);
    margin-bottom: 32px;
  }

  .hero-cost strong {
    color: var(--danger);
    font-size: 1.375rem;
  }

  .hero-cta {
    display: inline-block;
    font-family: 'Outfit', sans-serif;
    font-size: 1rem;
    font-weight: 600;
    color: var(--primary);
    text-decoration: none;
    padding-bottom: 4px;
    border-bottom: 2px solid var(--primary-light);
  }

  .hero-cta:hover {
    color: var(--primary-light);
    border-bottom-color: var(--primary);
  }

  /* TLDR BOX */
  .tldr-box {
    background: linear-gradient(135deg, rgba(99, 102, 241, 0.08) 0%, rgba(139, 92, 246, 0.04) 100%);
    border: 2px solid var(--primary-light);
    border-radius: 12px;
    padding: 20px 24px;
    margin: 24px 0;
  }

  .tldr-label {
    font-size: 0.6875rem;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 2px;
    color: var(--primary);
    margin-bottom: 8px;
  }

  .tldr-content {
    font-size: 1.0625rem;
    line-height: 1.6;
    color: var(--ink-soft);
  }

  .tldr-content strong {
    color: var(--ink);
  }

  .tldr-cost {
    color: var(--danger);
    font-weight: 600;
  }

  /* STAT BOX */
  .stat-box {
    background: var(--warm-white);
    border: 2px solid var(--border);
    border-radius: 12px;
    padding: 24px;
    margin: 24px 0;
    text-align: center;
  }

  .stat-number {
    font-family: 'Fraunces', Georgia, serif;
    font-size: 3rem;
    font-weight: 700;
    color: var(--primary);
    line-height: 1;
    margin-bottom: 8px;
  }

  .stat-label {
    font-size: 1rem;
    color: var(--slate);
  }

  /* Math and Proof lines */
  .math-line {
    background: var(--warm-white);
    padding: 16px 20px;
    border-radius: 8px;
    font-size: 0.9375rem;
    margin: 20px 0;
  }

  .proof-line {
    font-size: 0.9375rem;
    color: var(--slate-light);
    font-style: italic;
  }

  /* Gap sections */
  .section-label {
    display: inline-block;
    padding: 8px 20px;
    background: var(--ink);
    color: white;
    font-size: 0.75rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 1.5px;
    border-radius: 100px;
    margin: 48px 0 16px;
  }

  .gap-box {
    background: white;
    border: 1px solid var(--border);
    border-radius: 16px;
    padding: 32px;
    margin: 24px 0;
  }

  .gap-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;
  }

  .gap-title {
    font-family: 'Fraunces', serif;
    font-size: 1.5rem;
    font-weight: 600;
    color: var(--ink);
  }

  .gap-cost {
    font-family: 'Fraunces', serif;
    font-size: 1.25rem;
    font-weight: 700;
    color: var(--danger);
  }

  .gap-box p {
    margin: 16px 0;
  }

  /* Flow diagram */
  .flow-diagram {
    margin: 32px 0;
    padding: 24px;
    background: var(--warm-white);
    border-radius: 12px;
  }

  .flow-step {
    padding: 16px;
    background: white;
    border: 1px solid var(--border);
    border-radius: 8px;
    margin: 8px 0;
    font-size: 0.9375rem;
  }

  .flow-arrow {
    text-align: center;
    font-size: 1.5rem;
    color: var(--primary);
    margin: 4px 0;
  }

  /* Contrast box */
  .contrast-box {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 20px;
    margin: 32px 0;
  }

  .contrast-side {
    padding: 24px;
    border-radius: 12px;
  }

  .contrast-side:first-child {
    background: var(--warm-white);
    border: 1px solid var(--border);
  }

  .contrast-side:last-child {
    background: linear-gradient(135deg, rgba(16, 185, 129, 0.08), rgba(5, 150, 105, 0.04));
    border: 1px solid var(--success);
  }

  .contrast-label {
    font-size: 0.75rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 1px;
    margin-bottom: 12px;
  }

  .contrast-label.bad {
    color: var(--danger);
  }

  .contrast-label.good {
    color: var(--success);
  }

  .contrast-side ul {
    list-style: none;
    padding: 0;
  }

  .contrast-side li {
    padding: 8px 0;
    font-size: 0.9375rem;
  }

  /* Competitor table */
  .competitor-table {
    width: 100%;
    border-collapse: collapse;
    margin: 32px 0;
    background: white;
    border-radius: 12px;
    overflow: hidden;
    border: 1px solid var(--border);
  }

  .competitor-table th {
    background: var(--ink);
    color: white;
    padding: 16px;
    text-align: left;
    font-size: 0.875rem;
    font-weight: 600;
  }

  .competitor-table td {
    padding: 16px;
    border-bottom: 1px solid var(--border);
    font-size: 0.9375rem;
  }

  .competitor-table tr:last-child td {
    border-bottom: none;
  }

  .competitor-insight {
    background: var(--warm-white);
    padding: 24px;
    border-radius: 12px;
    margin-top: 24px;
    font-size: 1.0625rem;
    line-height: 1.7;
  }

  /* Solution stack */
  .solution-stack {
    margin: 32px 0;
  }

  .solution-item {
    display: flex;
    gap: 20px;
    padding: 24px;
    background: white;
    border: 1px solid var(--border);
    border-radius: 12px;
    margin: 16px 0;
  }

  .solution-icon {
    font-size: 2rem;
    flex-shrink: 0;
  }

  .solution-content strong {
    display: block;
    font-size: 1.125rem;
    margin-bottom: 8px;
    color: var(--ink);
  }

  .solution-content p {
    font-size: 0.9375rem;
    color: var(--slate);
    margin: 0;
  }

  /* Proof grid */
  .proof-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 24px;
    margin: 32px 0;
  }

  .proof-box {
    text-align: center;
    padding: 32px 24px;
    background: white;
    border: 1px solid var(--border);
    border-radius: 12px;
  }

  .proof-number {
    font-family: 'Fraunces', serif;
    font-size: 3rem;
    font-weight: 700;
    color: var(--primary);
    line-height: 1;
    margin-bottom: 8px;
  }

  .proof-label {
    font-size: 0.875rem;
    color: var(--slate);
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 1px;
    margin-bottom: 12px;
  }

  .proof-box p {
    font-size: 0.9375rem;
    color: var(--slate);
    margin: 0;
  }

  /* Two options */
  .two-options {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 24px;
    margin: 32px 0;
  }

  .option-box {
    padding: 32px;
    border-radius: 16px;
  }

  .option-bad {
    background: var(--warm-white);
    border: 2px solid var(--border);
  }

  .option-good {
    background: linear-gradient(135deg, rgba(16, 185, 129, 0.08), rgba(5, 150, 105, 0.04));
    border: 2px solid var(--success);
  }

  .option-box h3 {
    font-size: 1.25rem;
    margin-bottom: 16px;
  }

  .option-box ul {
    list-style: none;
    padding: 0;
  }

  .option-box li {
    padding: 10px 0;
    font-size: 1rem;
  }

  /* CTA */
  .cta {
    text-align: center;
    padding: 60px 32px;
    background: white;
    border-radius: 16px;
    margin: 60px 0;
  }

  .cta h2 {
    font-size: 2rem;
    margin-bottom: 16px;
  }

  .cta p {
    font-size: 1.125rem;
    color: var(--slate);
    margin-bottom: 32px;
  }

  /* Soft CTA */
  .soft-cta {
    text-align: center;
    padding: 24px;
    background: var(--warm-white);
    border-radius: 12px;
    margin: 32px 0;
    font-size: 1.0625rem;
  }

  .soft-cta-link {
    color: var(--primary);
    font-weight: 600;
    text-decoration: none;
    border-bottom: 2px solid var(--primary-light);
    padding-bottom: 2px;
  }

  .soft-cta-link:hover {
    color: var(--primary-light);
    border-bottom-color: var(--primary);
  }

  /* Utilities */
  .section-pull {
    text-align: center;
    font-size: 1.125rem;
    margin: 48px 0;
    color: var(--ink-soft);
  }

  .callout {
    background: var(--warm-white);
    padding: 24px 28px;
    border-left: 4px solid var(--primary);
    border-radius: 0 12px 12px 0;
    margin: 32px 0;
    font-size: 1.0625rem;
  }

  .big-divider {
    height: 2px;
    background: var(--border);
    margin: 80px 0;
  }

  .section-divider {
    height: 1px;
    background: var(--border);
    margin: 48px 0;
  }

  .footer {
    text-align: center;
    padding: 48px 0 24px;
    color: var(--slate-light);
    font-size: 0.875rem;
    border-top: 1px solid var(--border);
    margin-top: 80px;
  }

  .footer a {
    color: var(--primary);
    text-decoration: none;
  }

  /* Mobile */
  @media (max-width: 640px) {
    .container {
      padding: 40px 20px;
    }

    .hero-punch {
      font-size: 2.25rem;
    }

    .search-bar-mockup {
      min-width: auto;
      width: calc(100% - 40px);
      padding: 16px 24px;
    }

    .search-text {
      min-width: auto;
      font-size: 1rem;
    }

    .contrast-box,
    .two-options,
    .proof-grid {
      grid-template-columns: 1fr;
    }

    .header {
      flex-direction: column;
      gap: 16px;
      text-align: center;
    }
  }
</style>
  `;
};
