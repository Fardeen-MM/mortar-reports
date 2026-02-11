/**
 * Email QC - Deterministic quality checks for outgoing emails
 * Returns { passed, errors, warnings } where errors block sending and warnings are info only.
 */

function validateEmail(emailContent, context) {
  const errors = [];
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

  const allText = `${body || ''}${html || ''}`;

  // === ERRORS (block send) ===

  // Empty/invalid report URL
  if (!reportUrl || reportUrl.trim() === '') {
    errors.push('Report URL is empty');
  } else if (!reportUrl.startsWith('https://reports.mortarmetrics.com/')) {
    errors.push(`Report URL invalid: "${reportUrl}"`);
  } else if (/\s/.test(reportUrl)) {
    errors.push('Report URL contains spaces');
  }

  // Empty body
  if (!body || body.trim().length === 0) {
    errors.push('Email body is empty');
  }

  // Broken content
  if (/\{\{|\}\}/.test(allText)) {
    errors.push('Unresolved template placeholder ({{ }}) in email');
  }
  if (/\[TODO\]/i.test(allText)) {
    errors.push('[TODO] placeholder found in email');
  }
  if (/(?<!\w)undefined(?!\w)/i.test(allText)) {
    errors.push('"undefined" found in email content');
  }
  if (/(?<!\w)null(?!\w)/.test(allText)) {
    errors.push('"null" found in email content');
  }
  if (/(?<!\w)NaN(?!\w)/.test(allText)) {
    errors.push('"NaN" found in email content');
  }

  // Encoding corruption (mojibake)
  if (/Â£|Â|â€"|â€™|â€œ|â€/.test(allText)) {
    errors.push('Encoding corruption (mojibake) detected');
  }

  // === WARNINGS (info only) ===

  // Generic contact name
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
  }

  // No personalization data
  if (!totalRange && !totalCases && !practiceLabel) {
    warnings.push('No personalization data (totalRange, totalCases, practiceLabel all missing)');
  }

  // Generic firm name
  if (!firmName || firmName.trim() === '') {
    warnings.push('Firm name is empty');
  } else {
    const fn = firmName.trim().toLowerCase();
    if (fn === 'your firm' || fn === 'unknown firm') {
      warnings.push(`Firm name is generic: "${firmName}"`);
    }
  }

  // Body too long
  if (body && body.trim().length > 1000) {
    warnings.push(`Email body long (${body.trim().length} chars)`);
  }

  return {
    passed: errors.length === 0,
    errors,
    warnings
  };
}

module.exports = { validateEmail };
