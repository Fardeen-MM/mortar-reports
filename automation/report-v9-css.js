// V9 CSS for report generator - POLISHED VERSION
module.exports = function getV9CSS() {
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
    --primary-subtle: rgba(79, 70, 229, 0.08);
    --accent: #7c3aed;
    --success: #059669;
    --success-light: #10b981;
    --danger: #dc2626;
    --danger-light: #ef4444;
  }

  * { box-sizing: border-box; margin: 0; padding: 0; }

  html {
    scroll-behavior: smooth;
  }

  body {
    font-family: 'Outfit', -apple-system, BlinkMacSystemFont, sans-serif;
    background: var(--cream);
    color: var(--slate);
    line-height: 1.7;
    font-size: 17px;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
  }

  .container {
    max-width: 860px;
    margin: 0 auto;
    padding: 48px 40px;
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
    padding-bottom: 24px;
    border-bottom: 1px solid var(--border);
    margin-bottom: 0;
  }

  .logo {
    font-family: 'Fraunces', serif;
    font-size: 1.25rem;
    font-weight: 700;
    color: var(--ink);
    letter-spacing: -0.01em;
  }

  .meta {
    font-size: 0.8125rem;
    color: var(--slate-light);
    font-weight: 500;
  }

  /* ========== HERO - DRAMATIC & SCROLL-STOPPING ========== */
  .hero {
    text-align: center;
    padding: 100px 0 80px;
    min-height: 85vh;
    display: flex;
    flex-direction: column;
    justify-content: center;
    position: relative;
  }

  .hero::after {
    content: '';
    position: absolute;
    bottom: 0;
    left: 50%;
    transform: translateX(-50%);
    width: 1px;
    height: 60px;
    background: linear-gradient(to bottom, var(--border), transparent);
  }

  .hero-label {
    font-size: 0.75rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 4px;
    color: var(--primary);
    margin-bottom: 40px;
    opacity: 0.9;
  }

  .hero-setup {
    font-family: 'Fraunces', Georgia, serif;
    font-size: 1.75rem;
    font-weight: 400;
    color: var(--slate);
    margin-bottom: 28px;
    letter-spacing: -0.01em;
  }

  .search-bar-mockup {
    display: inline-flex;
    align-items: center;
    gap: 14px;
    background: white;
    border: 1px solid rgba(0,0,0,0.08);
    border-radius: 50px;
    padding: 20px 36px;
    margin: 0 auto 40px;
    box-shadow:
      0 1px 3px rgba(0,0,0,0.04),
      0 8px 40px rgba(0,0,0,0.08);
    min-width: 440px;
    transition: box-shadow 0.3s ease, transform 0.3s ease;
  }

  .search-bar-mockup:hover {
    box-shadow:
      0 1px 3px rgba(0,0,0,0.04),
      0 12px 48px rgba(0,0,0,0.12);
    transform: translateY(-2px);
  }

  .google-g {
    flex-shrink: 0;
    opacity: 0.9;
  }

  .search-text {
    font-family: 'Outfit', sans-serif;
    font-size: 1.25rem;
    color: var(--ink);
    text-align: left;
    min-width: 280px;
    font-weight: 400;
  }

  .cursor {
    font-weight: 300;
    color: var(--primary);
    animation: blink 1s infinite;
    margin-left: -2px;
    font-size: 1.25rem;
  }

  @keyframes blink {
    0%, 45% { opacity: 1; }
    50%, 100% { opacity: 0; }
  }

  .hero-punch {
    font-family: 'Fraunces', Georgia, serif;
    font-size: 3.5rem;
    font-weight: 600;
    line-height: 1.08;
    color: var(--ink);
    margin: 32px 0 24px;
    letter-spacing: -0.03em;
  }

  .hero-punch .accent {
    color: var(--primary);
    display: block;
    margin-top: 4px;
  }

  .hero-cost {
    font-family: 'Outfit', sans-serif;
    font-size: 1.25rem;
    color: var(--slate);
    margin-bottom: 40px;
    font-weight: 400;
  }

  .hero-cost strong {
    color: var(--danger);
    font-weight: 700;
    font-size: 1.375rem;
  }

  .hero-cta {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    font-family: 'Outfit', sans-serif;
    font-size: 1rem;
    font-weight: 600;
    color: var(--primary);
    text-decoration: none;
    padding: 14px 28px;
    border: 2px solid var(--primary);
    border-radius: 50px;
    transition: all 0.2s ease;
  }

  .hero-cta:hover {
    background: var(--primary);
    color: white;
  }

  /* ========== SECTION INTROS - BREATHING ROOM ========== */
  .section-intro {
    text-align: center;
    max-width: 580px;
    margin: 80px auto 48px;
    padding-top: 40px;
  }

  .section-intro h2 {
    font-family: 'Fraunces', Georgia, serif;
    font-size: 2.25rem;
    font-weight: 600;
    color: var(--ink);
    margin-bottom: 16px;
    letter-spacing: -0.02em;
  }

  .section-intro p {
    font-size: 1.125rem;
    line-height: 1.7;
    color: var(--slate);
    margin: 0;
  }

  /* ========== SECTION LABELS (GAP #1, etc) ========== */
  .section-label {
    display: inline-block;
    padding: 10px 24px;
    background: var(--ink);
    color: white;
    font-size: 0.6875rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 2px;
    border-radius: 50px;
    margin: 32px 0 20px;
  }

  /* ========== TLDR BOX - ATTENTION GRABBER ========== */
  .tldr-box {
    background: linear-gradient(135deg, var(--primary-subtle) 0%, rgba(124, 58, 237, 0.04) 100%);
    border: 1px solid rgba(79, 70, 229, 0.2);
    border-radius: 16px;
    padding: 24px 28px;
    margin: 20px 0 28px;
  }

  .tldr-label {
    font-size: 0.625rem;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 2.5px;
    color: var(--primary);
    margin-bottom: 10px;
  }

  .tldr-content {
    font-size: 1.0625rem;
    line-height: 1.65;
    color: var(--ink-soft);
  }

  .tldr-content strong {
    color: var(--ink);
    font-weight: 600;
  }

  .tldr-cost {
    color: var(--danger);
    font-weight: 600;
  }

  /* ========== GAP BOXES - CLEAN CARDS ========== */
  .gap-box {
    background: white;
    border: 1px solid var(--border);
    border-radius: 20px;
    padding: 36px;
    margin: 24px 0;
    box-shadow: 0 2px 12px rgba(0,0,0,0.03);
  }

  .gap-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 24px;
    gap: 20px;
  }

  .gap-title {
    font-family: 'Fraunces', serif;
    font-size: 1.5rem;
    font-weight: 600;
    color: var(--ink);
    letter-spacing: -0.01em;
    line-height: 1.3;
  }

  .gap-cost {
    font-family: 'Outfit', sans-serif;
    font-size: 1.125rem;
    font-weight: 700;
    color: var(--danger);
    white-space: nowrap;
    padding: 6px 14px;
    background: rgba(220, 38, 38, 0.08);
    border-radius: 8px;
  }

  .gap-box p {
    margin: 16px 0;
    line-height: 1.75;
  }

  .gap-box p strong {
    color: var(--ink);
  }

  /* ========== FLOW DIAGRAM - VISUAL STORY ========== */
  .flow-diagram {
    margin: 28px 0;
    padding: 28px;
    background: var(--warm-white);
    border-radius: 16px;
    border: 1px solid var(--border);
  }

  .flow-step {
    padding: 16px 20px;
    background: white;
    border: 1px solid var(--border);
    border-radius: 10px;
    margin: 6px 0;
    font-size: 0.9375rem;
    color: var(--ink-soft);
    box-shadow: 0 1px 3px rgba(0,0,0,0.02);
  }

  .flow-arrow {
    text-align: center;
    font-size: 1.25rem;
    color: var(--primary-light);
    margin: 2px 0;
    opacity: 0.7;
  }

  /* ========== MATH LINE - PROOF POINT ========== */
  .math-line {
    background: var(--warm-white);
    padding: 18px 24px;
    border-radius: 12px;
    font-size: 0.9375rem;
    margin: 24px 0 0;
    border: 1px solid var(--border);
    color: var(--slate);
  }

  .math-line strong {
    color: var(--ink);
  }

  /* ========== SECTION PULL - TRANSITION TEXT ========== */
  .section-pull {
    text-align: center;
    font-size: 1.125rem;
    margin: 48px 0;
    color: var(--ink-soft);
    font-weight: 500;
  }

  .section-pull strong {
    color: var(--ink);
  }

  /* ========== CONTRAST BOX - BEFORE/AFTER ========== */
  .contrast-box {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
    margin: 28px 0;
  }

  .contrast-side {
    padding: 24px;
    border-radius: 16px;
  }

  .contrast-side:first-child {
    background: var(--warm-white);
    border: 1px solid var(--border);
  }

  .contrast-side:last-child {
    background: linear-gradient(135deg, rgba(5, 150, 105, 0.06), rgba(16, 185, 129, 0.03));
    border: 1px solid rgba(5, 150, 105, 0.25);
  }

  .contrast-label {
    font-size: 0.6875rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 1.5px;
    margin-bottom: 16px;
    color: var(--slate-light);
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
    color: var(--slate);
    display: flex;
    align-items: flex-start;
    gap: 8px;
  }

  .contrast-side li::before {
    content: '→';
    color: var(--muted);
    font-size: 0.875rem;
  }

  .contrast-side:last-child li::before {
    content: '✓';
    color: var(--success);
  }

  /* ========== COMPETITOR TABLE - DATA DISPLAY ========== */
  .competitor-table {
    width: 100%;
    border-collapse: separate;
    border-spacing: 0;
    margin: 28px 0;
    background: white;
    border-radius: 16px;
    overflow: hidden;
    border: 1px solid var(--border);
    box-shadow: 0 2px 12px rgba(0,0,0,0.03);
  }

  .competitor-table th {
    background: var(--ink);
    color: white;
    padding: 16px 18px;
    text-align: left;
    font-size: 0.8125rem;
    font-weight: 600;
    letter-spacing: 0.02em;
  }

  .competitor-table th:first-child {
    border-top-left-radius: 15px;
  }

  .competitor-table th:last-child {
    border-top-right-radius: 15px;
  }

  .competitor-table td {
    padding: 16px 18px;
    border-bottom: 1px solid var(--border);
    font-size: 0.9375rem;
    color: var(--slate);
  }

  .competitor-table tr:last-child td {
    border-bottom: none;
  }

  .competitor-table td:first-child {
    font-weight: 500;
    color: var(--ink-soft);
  }

  .competitor-insight {
    background: var(--warm-white);
    padding: 24px 28px;
    border-radius: 16px;
    margin-top: 28px;
    font-size: 1rem;
    line-height: 1.7;
    border: 1px solid var(--border);
    color: var(--slate);
  }

  .competitor-insight strong {
    color: var(--ink);
  }

  /* ========== SOLUTION STACK - FEATURES ========== */
  .solution-stack {
    margin: 28px 0;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .solution-item {
    display: flex;
    gap: 20px;
    padding: 24px 28px;
    background: white;
    border: 1px solid var(--border);
    border-radius: 16px;
    transition: box-shadow 0.2s ease, transform 0.2s ease;
  }

  .solution-item:hover {
    box-shadow: 0 4px 20px rgba(0,0,0,0.06);
    transform: translateY(-1px);
  }

  .solution-icon {
    font-size: 1.75rem;
    flex-shrink: 0;
    width: 48px;
    height: 48px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--primary-subtle);
    border-radius: 12px;
  }

  .solution-content {
    flex: 1;
  }

  .solution-content strong {
    display: block;
    font-size: 1.0625rem;
    margin-bottom: 6px;
    color: var(--ink);
    font-weight: 600;
  }

  .solution-content p {
    font-size: 0.9375rem;
    color: var(--slate);
    margin: 0;
    line-height: 1.6;
  }

  /* ========== PROOF GRID - METRICS ========== */
  .proof-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 16px;
    margin: 28px 0;
  }

  .proof-box {
    text-align: center;
    padding: 32px 20px;
    background: white;
    border: 1px solid var(--border);
    border-radius: 16px;
    transition: box-shadow 0.2s ease;
  }

  .proof-box:hover {
    box-shadow: 0 4px 20px rgba(0,0,0,0.06);
  }

  .proof-number {
    font-family: 'Fraunces', serif;
    font-size: 2.5rem;
    font-weight: 700;
    color: var(--primary);
    line-height: 1;
    margin-bottom: 8px;
    letter-spacing: -0.02em;
  }

  .proof-label {
    font-size: 0.6875rem;
    color: var(--slate-light);
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 1.5px;
    margin-bottom: 12px;
  }

  .proof-box p {
    font-size: 0.875rem;
    color: var(--slate);
    margin: 0;
    line-height: 1.5;
  }

  /* ========== TWO OPTIONS - DECISION ========== */
  .two-options {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 20px;
    margin: 28px 0;
  }

  .option-box {
    padding: 32px;
    border-radius: 20px;
  }

  .option-bad {
    background: var(--warm-white);
    border: 1px solid var(--border);
  }

  .option-good {
    background: linear-gradient(135deg, rgba(5, 150, 105, 0.06), rgba(16, 185, 129, 0.03));
    border: 2px solid var(--success);
    position: relative;
  }

  .option-good::before {
    content: 'RECOMMENDED';
    position: absolute;
    top: -10px;
    left: 24px;
    font-size: 0.625rem;
    font-weight: 700;
    letter-spacing: 1.5px;
    color: white;
    background: var(--success);
    padding: 4px 12px;
    border-radius: 20px;
  }

  .option-box h3 {
    font-size: 1.25rem;
    margin-bottom: 20px;
    letter-spacing: -0.01em;
  }

  .option-box ul {
    list-style: none;
    padding: 0;
  }

  .option-box li {
    padding: 10px 0;
    font-size: 0.9375rem;
    color: var(--slate);
    display: flex;
    align-items: flex-start;
    gap: 10px;
  }

  .option-bad li::before {
    content: '×';
    color: var(--danger-light);
    font-weight: 700;
    font-size: 1rem;
  }

  .option-good li::before {
    content: '✓';
    color: var(--success);
    font-weight: 700;
  }

  /* ========== CTA - FINAL CONVERSION ========== */
  .cta {
    text-align: center;
    padding: 60px 40px;
    background: white;
    border-radius: 24px;
    margin: 60px 0;
    border: 1px solid var(--border);
    box-shadow: 0 4px 24px rgba(0,0,0,0.04);
  }

  .cta h2 {
    font-size: 1.875rem;
    margin-bottom: 12px;
    letter-spacing: -0.02em;
    max-width: 500px;
    margin-left: auto;
    margin-right: auto;
  }

  .cta p {
    font-size: 1.0625rem;
    color: var(--slate);
    margin-bottom: 32px;
  }

  /* ========== CALLOUT BOX ========== */
  .callout {
    background: white;
    padding: 24px 28px;
    border-left: 4px solid var(--primary);
    border-radius: 0 16px 16px 0;
    margin: 32px 0;
    font-size: 1rem;
    color: var(--slate);
    box-shadow: 0 2px 12px rgba(0,0,0,0.03);
  }

  .callout strong {
    color: var(--ink);
  }

  /* ========== DIVIDERS ========== */
  .big-divider {
    height: 1px;
    background: linear-gradient(to right, transparent, var(--border), transparent);
    margin: 80px 0;
  }

  .section-divider {
    height: 1px;
    background: var(--border);
    margin: 48px 0;
  }

  /* ========== FOOTER ========== */
  .footer {
    text-align: center;
    padding: 40px 0 20px;
    color: var(--slate-light);
    font-size: 0.8125rem;
    border-top: 1px solid var(--border);
    margin-top: 60px;
  }

  .footer a {
    color: var(--primary);
    text-decoration: none;
    font-weight: 500;
  }

  .footer a:hover {
    text-decoration: underline;
  }

  /* ========== MOBILE RESPONSIVE ========== */
  @media (max-width: 768px) {
    .container {
      padding: 32px 24px;
    }

    .hero {
      min-height: auto;
      padding: 60px 0 60px;
    }

    .hero-punch {
      font-size: 2.25rem;
    }

    .hero-setup {
      font-size: 1.375rem;
    }

    .section-intro {
      margin: 60px auto 36px;
    }

    .section-intro h2 {
      font-size: 1.75rem;
    }

    .search-bar-mockup {
      min-width: auto;
      width: 100%;
      padding: 16px 24px;
      gap: 12px;
    }

    .search-text {
      min-width: auto;
      font-size: 1rem;
    }

    .gap-box {
      padding: 28px 24px;
    }

    .gap-header {
      flex-direction: column;
      gap: 12px;
    }

    .gap-cost {
      align-self: flex-start;
    }

    .contrast-box,
    .two-options,
    .proof-grid {
      grid-template-columns: 1fr;
    }

    .option-good::before {
      position: relative;
      top: 0;
      left: 0;
      display: inline-block;
      margin-bottom: 16px;
    }

    .header {
      flex-direction: column;
      gap: 12px;
      text-align: center;
    }

    .cta {
      padding: 40px 24px;
    }

    .cta h2 {
      font-size: 1.5rem;
    }

    .proof-number {
      font-size: 2rem;
    }
  }

  @media (max-width: 480px) {
    .hero-punch {
      font-size: 1.875rem;
    }

    .section-intro h2 {
      font-size: 1.5rem;
    }

    .gap-title {
      font-size: 1.25rem;
    }
  }
</style>
  `;
};
