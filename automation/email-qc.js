/**
 * Email QC - Deterministic quality checks for outgoing emails
 * No AI calls. Returns warnings only, never blocks sending.
 */

function validateEmail(emailContent, context) {
  const warnings = [];
  const { subject, body, html } = emailContent || {};
  const {
    contactName = '',
    firmName = '',
    reportUrl = '',
    totalRange = '',
    totalCases = '',
    practiceLabel = ''
  } = context || {};

  // 1. Em dashes
  const allText = `${body || ''}${html || ''}`;
  if (/\u2014|—|&mdash;/.test(allText)) {
    warnings.push('Em dash found in email body or HTML');
  }

  // 2. Placeholders
  if (/\{\{|\}\}|\[TODO\]|undefined|(?<!\w)null(?!\w)|(?<!\w)NaN(?!\w)/.test(allText)) {
    warnings.push('Placeholder or undefined/null/NaN found in email');
  }

  // 3. Encoding issues (mojibake)
  if (/Â£|Â|â€"|â€™|â€œ|â€/.test(allText)) {
    warnings.push('Encoding issue (mojibake) detected in email');
  }

  // 4. Contact name checks
  if (!contactName || contactName.trim() === '') {
    warnings.push('Contact name is empty');
  } else {
    const name = contactName.trim();
    if (name === 'Partner' || name === 'there') {
      warnings.push(`Contact name is generic: "${name}"`);
    }
    if (name === name.toUpperCase() && name.length > 2) {
      warnings.push(`Contact name is all-caps: "${name}"`);
    }
    if (name.length < 2 || name.length > 50) {
      warnings.push(`Contact name length out of range (${name.length} chars): "${name}"`);
    }
  }

  // 5. Report URL
  if (!reportUrl || reportUrl.trim() === '') {
    warnings.push('Report URL is empty');
  } else {
    if (!reportUrl.startsWith('https://reports.mortarmetrics.com/')) {
      warnings.push(`Report URL doesn't start with https://reports.mortarmetrics.com/: "${reportUrl}"`);
    }
    if (/\s/.test(reportUrl)) {
      warnings.push('Report URL contains spaces');
    }
  }

  // 6. Personalization
  if (!totalRange && !totalCases && !practiceLabel) {
    warnings.push('No personalization data (totalRange, totalCases, practiceLabel all missing)');
  }

  // 7. Firm name
  if (!firmName || firmName.trim() === '') {
    warnings.push('Firm name is empty');
  } else {
    const fn = firmName.trim().toLowerCase();
    if (fn === 'your firm' || fn === 'unknown firm') {
      warnings.push(`Firm name is generic: "${firmName}"`);
    }
  }

  // 8. Body length
  if (body) {
    const len = body.trim().length;
    if (len < 100) {
      warnings.push(`Email body too short (${len} chars, min 100)`);
    }
    if (len > 1000) {
      warnings.push(`Email body too long (${len} chars, max 1000)`);
    }
  } else {
    warnings.push('Email body is empty');
  }

  return {
    passed: warnings.length === 0,
    warnings
  };
}

module.exports = { validateEmail };
