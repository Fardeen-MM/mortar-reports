/**
 * AI classification: Claude Haiku API + fallback pattern matcher.
 */

export async function callHaiku(anthropicKey, systemPrompt, userPrompt, maxTokens = 300) {
  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': anthropicKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }]
    })
  });

  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`Haiku API error: ${resp.status} ${errText}`);
  }

  const data = await resp.json();
  return data.content?.[0]?.text?.trim() || '';
}

export async function classifyReplyAI(text, anthropicKey) {
  if (!text || !text.trim()) {
    return { category: 'INTERESTED', confidence: 0.5, summary: 'Empty reply \u2014 treated as interested' };
  }

  const stripped = text
    .split('\n')
    .filter(line => !line.trim().startsWith('>') && !/^On .+ wrote:$/i.test(line.trim()))
    .join('\n')
    .trim();

  if (!stripped) {
    return { category: 'INTERESTED', confidence: 0.5, summary: 'Only quoted text \u2014 treated as interested' };
  }

  if (!anthropicKey) {
    return classifyReplyFallback(stripped);
  }

  try {
    const result = await callHaiku(
      anthropicKey,
      `You classify email replies to cold outreach from a legal marketing agency. Reply with ONLY a JSON object.`,
      `Classify this reply into exactly one category. Reply with JSON only, no other text.

Categories:
- INTERESTED: Genuinely wants to learn more, positive reply, "tell me more", "sounds good", "yes", "let's talk"
- QUESTION: Asks a specific question about services, pricing, process (NOT requests to stop/remove/unsubscribe that happen to contain a question mark)
- OBJECTION: Pushes back but hasn't firmly said no \u2014 "we already have a marketing company", "not sure we need this"
- NOT_INTERESTED: Any form of decline \u2014 "not interested", "no thanks", "no", "I'm retired", "no longer practicing", "left the firm", "wrong person", "I must pass", "pass", "we don't market", "we don't need this", "doesn't fit our model", "we rely on word of mouth", "we are swamped"
- UNSUBSCRIBE: Wants off the list \u2014 "unsubscribe", "remove me", "stop emailing", "stop", "STOP", "stop spamming", "cease and desist", "refrain from further emails", "remove from list", "please remove [name] from your list"
- OOO: Out of office auto-reply, mentions working days, on vacation, on leave, returning on a date
- IRRELEVANT: System/bounce messages, delivery failures ("was not delivered"), spam filter auto-replies ("I apologize for this automatic reply. To control spam..."), security alerts, "not a law firm", challenge-response systems

IMPORTANT rules:
- "Stop" by itself = UNSUBSCRIBE, not INTERESTED
- "Please refrain from further emails" = UNSUBSCRIBE, not INTERESTED
- "I am retired" = NOT_INTERESTED, not INTERESTED
- "STOP SPAMMING ME" = UNSUBSCRIBE, not INTERESTED
- "Please remove [someone] from your list" = UNSUBSCRIBE, not QUESTION
- Short angry messages like "stop", "no", "leave me alone" = UNSUBSCRIBE or NOT_INTERESTED
- "I do not", "nope", "too busy", "I'm too busy" = NOT_INTERESTED, not INTERESTED
- Auto-reply spam filter messages = IRRELEVANT, not QUESTION
- Delivery failure notifications = IRRELEVANT, not INTERESTED
- Only classify as INTERESTED if the person is genuinely expressing interest in learning more. Any form of refusal, decline, or disinterest is NOT interested.

If OOO: also extract the return date if mentioned (e.g. "back on January 15", "returning Monday the 20th", "out until Feb 3"). Convert to YYYY-MM-DD format. If no return date is mentioned, set return_date to null.

Reply text:
"""
${stripped.slice(0, 500)}
"""

Respond with: {"category":"...","confidence":0.0-1.0,"summary":"one line summary","return_date":"YYYY-MM-DD or null"}`,
      200
    );

    if (!result || !result.trim()) {
      console.warn('Empty AI classification result, using fallback');
      return classifyReplyFallback(stripped);
    }
    const parsed = JSON.parse(result);
    if (parsed.category && ['INTERESTED','QUESTION','OBJECTION','NOT_INTERESTED','UNSUBSCRIBE','OOO','IRRELEVANT'].includes(parsed.category)) {
      if (parsed.category === 'INTERESTED') {
        const fallback = classifyReplyFallback(stripped);
        if (['NOT_INTERESTED', 'UNSUBSCRIBE', 'IRRELEVANT'].includes(fallback.category) && fallback.confidence >= 0.8) {
          console.warn(`AI said INTERESTED but fallback detected ${fallback.category} (${fallback.confidence}) \u2014 using fallback`);
          return fallback;
        }
      }
      return parsed;
    }
    return classifyReplyFallback(stripped);
  } catch (e) {
    console.error('AI classification failed, using fallback:', e.message);
    return classifyReplyFallback(stripped);
  }
}

export function classifyReplyFallback(text) {
  const lower = text.toLowerCase();

  const ownText = lower.split(/\n\s*>|\n\s*-{3,}|\n\s*_{3,}|\nfrom:|\non .+ wrote:|\nsincerely|\nregards|\nbest regards|\nsent from|\nget outlook|\n-- \n/i)[0].trim();

  const systemPatterns = ['mail delivery failed', 'undeliverable', 'delivery status notification',
    'message not delivered', 'couldn\'t be delivered', 'returned to sender',
    'non-delivery report', 'mailbox unavailable', 'mailbox not found',
    'security alert', 'security issue', 'suspicious activity',
    'verify your account', 'confirm your identity', 'quarantine',
    'message quarantined', 'held for review', 'blocked by', 'spam filter',
    'action required:', 'has been blocked', 'message rejected',
    'was not delivered to', 'email message was not delivered',
    'this message triggered', 'correlated intelligence', 'security risks'];
  if (systemPatterns.some(p => lower.includes(p))) {
    return { category: 'IRRELEVANT', confidence: 0.95, summary: 'System/bounce/security message' };
  }

  if (/i apologize for this automatic reply|to control spam|your message has been|challenge.?response|not on my approved/i.test(lower)) {
    return { category: 'IRRELEVANT', confidence: 0.9, summary: 'Auto-reply spam filter' };
  }

  if (/not a law firm|not a lawyer|not an attorney|we are not a/i.test(lower)) {
    return { category: 'IRRELEVANT', confidence: 0.9, summary: 'Not a law firm' };
  }

  const unsubPatterns = ['unsubscribe', 'remove me from', 'stop emailing', 'opt out', 'opt-out',
    'take me off', 'remove my email', 'stop contacting', 'remove from list',
    'remove from your list', 'cease and desist', 'refrain from',
    'further emails', 'future emails', 'please remove',
    'don\'t contact', 'don\'t email', 'do not email', 'stop spamming',
    'remove from your', 'remove from mailing', 'remove .+ from .+ list'];
  if (unsubPatterns.some(p => lower.includes(p))) {
    return { category: 'UNSUBSCRIBE', confidence: 0.9, summary: 'Unsubscribe request' };
  }

  if (/^\s*stop[\s.!]*$/i.test(ownText)) {
    return { category: 'UNSUBSCRIBE', confidence: 0.85, summary: 'Stop request' };
  }

  const notIntPatterns = ['not interested', 'no thank', 'no, thank', 'please stop', 'leave me alone',
    'do not contact', 'not for us', 'not for me', 'pass on this', 'we\'re good',
    'we are good', 'no need', 'not looking', 'not in the market',
    'i am retired', 'i\'m retired', 'i have retired', 'i\'ve retired',
    'no longer practic', 'no longer with', 'left the firm', 'no longer at',
    'wrong person', 'wrong email', 'doesn\'t work here',
    'i must pass', 'i\'ll pass', 'we don\'t market', 'we don\'t advertise',
    'we don\'t need', 'not for our firm', 'doesn\'t fit',
    'we rely on word of mouth', 'word of mouth', 'we are swamped',
    'don\'t need marketing', 'don\'t need your',
    'too busy', 'i do not want', 'i do not need', 'i don\'t want', 'i don\'t need'];
  if (notIntPatterns.some(p => lower.includes(p))) {
    return { category: 'NOT_INTERESTED', confidence: 0.8, summary: 'Not interested' };
  }

  if (/^\s*(no|nope|i do not|i don't)[\s.!]*$/i.test(ownText)) {
    return { category: 'NOT_INTERESTED', confidence: 0.8, summary: 'Short refusal' };
  }

  if (/out of (the )?office|auto[- ]?reply|on leave|on vacation|will return|i('m| am) away|normal working days|working days are/i.test(lower)) {
    return { category: 'OOO', confidence: 0.9, summary: 'Out of office', return_date: null };
  }

  if (ownText.includes('?')) {
    return { category: 'QUESTION', confidence: 0.6, summary: 'Contains question' };
  }

  if (/already have|already work|not sure|not the right|maybe later|bad time/i.test(lower)) {
    return { category: 'OBJECTION', confidence: 0.6, summary: 'Possible objection' };
  }

  return { category: 'INTERESTED', confidence: 0.5, summary: 'Default positive classification' };
}
