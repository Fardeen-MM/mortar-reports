/**
 * CSV Lead Personalizer
 *
 * Reads an Apollo CSV export, calls Claude Haiku to generate a personalized
 * subject line + opening line for each lead, writes results to a new CSV.
 *
 * Usage:
 *   ANTHROPIC_API_KEY=sk-... node personalize.js ../leads.csv
 *   Output: ../leads_personalized.csv
 */

const fs = require('fs');
const path = require('path');
const Anthropic = require('@anthropic-ai/sdk');

// ============================================================================
// CONFIG
// ============================================================================

const BATCH_SIZE = 10;         // concurrent requests per batch
const BATCH_DELAY_MS = 200;    // delay between batches
const MODEL = 'claude-haiku-4-5-20251001';

// ============================================================================
// CSV PARSING (no external deps)
// ============================================================================

function parseCSV(text) {
  const lines = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') {
      if (inQuotes && text[i + 1] === '"') {
        current += '"';
        i++; // skip escaped quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      lines.push(current);
      current = '';
    } else if ((ch === '\n' || ch === '\r') && !inQuotes) {
      if (ch === '\r' && text[i + 1] === '\n') i++; // skip \r\n
      lines.push(current);
      current = '';
      // Mark row boundary with null sentinel
      lines.push(null);
    } else {
      current += ch;
    }
  }
  // Push last field
  if (current || lines.length > 0) {
    lines.push(current);
  }

  // Split into rows using null sentinels
  const rows = [];
  let row = [];
  for (const field of lines) {
    if (field === null) {
      if (row.length > 0) rows.push(row);
      row = [];
    } else {
      row.push(field);
    }
  }
  if (row.length > 0) rows.push(row);

  return rows;
}

function csvToObjects(rows) {
  if (rows.length < 2) return { headers: rows[0] || [], records: [] };
  const headers = rows[0].map(h => h.trim());
  const records = [];
  for (let i = 1; i < rows.length; i++) {
    // Skip empty rows (trailing newlines)
    if (rows[i].every(f => f.trim() === '')) continue;
    const obj = {};
    for (let j = 0; j < headers.length; j++) {
      obj[headers[j]] = (rows[i][j] || '').trim();
    }
    records.push(obj);
  }
  return { headers, records };
}

function escapeCSVField(value) {
  const str = String(value ?? '');
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

function objectsToCSV(headers, records) {
  const lines = [headers.map(escapeCSVField).join(',')];
  for (const rec of records) {
    lines.push(headers.map(h => escapeCSVField(rec[h])).join(','));
  }
  return lines.join('\n') + '\n';
}

// ============================================================================
// COLUMN NAME DETECTION
// ============================================================================

function findColumn(headers, candidates) {
  const lower = headers.map(h => h.toLowerCase().replace(/[\s_-]+/g, ''));
  for (const c of candidates) {
    const norm = c.toLowerCase().replace(/[\s_-]+/g, '');
    const idx = lower.indexOf(norm);
    if (idx !== -1) return headers[idx];
  }
  return null;
}

function detectColumns(headers) {
  return {
    firstName: findColumn(headers, ['first_name', 'firstName', 'First Name', 'first name']),
    firmName:  findColumn(headers, ['firm_name', 'firmName', 'company', 'Company', 'organization', 'Organization', 'company_name']),
    practice:  findColumn(headers, ['practice_area', 'practiceArea', 'Practice Area', 'industry', 'Industry']),
    city:      findColumn(headers, ['city', 'City', 'person_city', 'organization_city']),
    website:   findColumn(headers, ['website_url', 'website', 'Website', 'url', 'company_url', 'organization_website']),
  };
}

// ============================================================================
// AI PERSONALIZATION
// ============================================================================

function buildPrompt(lead) {
  return `You write cold email openers for a law firm marketing agency. We drive massive revenue for law firms through Google Ads, Meta Ads, and AI intake — typically $50K-$200K/month in new cases.

Name: ${lead.firstName || 'there'}
Firm: ${lead.firmName || 'their firm'}
Practice area: ${lead.practice || 'legal services'}
City: ${lead.city || ''}

Generate TWO things:
1. SUBJECT: 3-6 words, lowercase. About money or revenue they're missing. NOT a question. Each subject must be different — vary the angle (revenue, cases, competitors, growth, untapped demand).
2. FIRST_LINE: One bold sentence (8-14 words). Rules:
   - Make them feel the money they're leaving on the table
   - Use specific dollar figures or case counts to paint the picture
   - Statement, NOT a question
   - Confident — we know their market and we print results
   - No "I noticed", no "I came across", no flattery
   - Mention their city or practice area naturally

NEVER write:
- "Curious how you're handling..."
- "more [practice] cases this quarter" (too generic)
- Anything that sounds like every other cold email

Good examples:
- SUBJECT: ${lead.city || 'your city'} ${lead.practice || 'firms'} leaving $100k on the table
- SUBJECT: untapped ${lead.practice || 'legal'} demand in ${lead.city || 'your market'}
- FIRST_LINE: ${lead.city || 'Your city'} has 800+ people searching for ${lead.practice || 'legal help'} monthly and most firms aren't showing up.
- FIRST_LINE: We added $140K/month in new ${lead.practice || ''} cases for a firm your size last quarter.

Output format (exactly):
SUBJECT: ...
FIRST_LINE: ...`;
}

function parseResponse(text) {
  const subjectMatch = text.match(/SUBJECT:\s*(.+)/i);
  const firstLineMatch = text.match(/FIRST_LINE:\s*(.+)/i);
  return {
    subject: subjectMatch ? subjectMatch[1].trim() : '',
    first_line: firstLineMatch ? firstLineMatch[1].trim() : '',
  };
}

async function personalizeLead(client, lead) {
  const msg = await client.messages.create({
    model: MODEL,
    max_tokens: 100,
    messages: [{ role: 'user', content: buildPrompt(lead) }],
  });

  const text = msg.content[0]?.text || '';
  return parseResponse(text);
}

// ============================================================================
// BATCH PROCESSING
// ============================================================================

async function processBatch(client, leads, startIdx) {
  const results = await Promise.allSettled(
    leads.map(lead => personalizeLead(client, lead))
  );

  return results.map((r, i) => {
    if (r.status === 'fulfilled') {
      return r.value;
    }
    console.error(`  [${startIdx + i + 1}] Error: ${r.reason?.message || r.reason}`);
    return { subject: '', first_line: '' };
  });
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  const inputPath = process.argv[2];
  if (!inputPath) {
    console.error('Usage: node personalize.js <input.csv>');
    process.exit(1);
  }

  const resolvedInput = path.resolve(inputPath);
  if (!fs.existsSync(resolvedInput)) {
    console.error(`File not found: ${resolvedInput}`);
    process.exit(1);
  }

  // Output path: same dir, same name with _personalized suffix
  const dir = path.dirname(resolvedInput);
  const ext = path.extname(resolvedInput);
  const base = path.basename(resolvedInput, ext);
  const outputPath = path.join(dir, `${base}_personalized${ext}`);

  // Init Anthropic
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error('Missing ANTHROPIC_API_KEY environment variable');
    process.exit(1);
  }
  const client = new Anthropic({ apiKey });

  // Read + parse CSV
  console.log(`Reading ${resolvedInput}...`);
  const raw = fs.readFileSync(resolvedInput, 'utf-8');
  const rows = parseCSV(raw);
  const { headers, records } = csvToObjects(rows);

  if (records.length === 0) {
    console.error('No data rows found in CSV');
    process.exit(1);
  }

  // Detect columns
  const cols = detectColumns(headers);
  console.log(`Found ${records.length} leads`);
  console.log(`Columns: firstName=${cols.firstName || '?'}, firm=${cols.firmName || '?'}, practice=${cols.practice || '?'}, city=${cols.city || '?'}`);

  if (!cols.firstName && !cols.firmName) {
    console.error('Could not find first_name or firm_name/company column. Check your CSV headers.');
    process.exit(1);
  }

  // Add output columns
  const outputHeaders = [...headers, 'subject', 'first_line'];

  // Process in batches
  const total = records.length;
  let processed = 0;

  for (let i = 0; i < total; i += BATCH_SIZE) {
    const batch = records.slice(i, i + BATCH_SIZE);

    // Build lead objects for the prompt
    const leads = batch.map(rec => ({
      firstName: cols.firstName ? rec[cols.firstName] : '',
      firmName: cols.firmName ? rec[cols.firmName] : '',
      practice: cols.practice ? rec[cols.practice] : '',
      city: cols.city ? rec[cols.city] : '',
    }));

    const results = await processBatch(client, leads, i);

    // Merge results back
    for (let j = 0; j < batch.length; j++) {
      batch[j].subject = results[j].subject;
      batch[j].first_line = results[j].first_line;
      processed++;
      const name = leads[j].firstName || 'Lead';
      const firm = leads[j].firmName || '';
      console.log(`  [${processed}/${total}] ${name}${firm ? ' - ' + firm : ''}`);
    }

    // Delay between batches (skip after last)
    if (i + BATCH_SIZE < total) {
      await sleep(BATCH_DELAY_MS);
    }
  }

  // Write output
  const csv = objectsToCSV(outputHeaders, records);
  fs.writeFileSync(outputPath, csv, 'utf-8');
  console.log(`\nDone! ${processed} leads personalized.`);
  console.log(`Output: ${outputPath}`);
}

main().catch(err => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});
