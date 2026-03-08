/**
 * GitHub API helpers for triggering workflows and fetching approval data.
 */

export const GITHUB_REPO = 'Fardeen-MM/mortar-reports';

export async function triggerGitHubWorkflow(githubToken, approvalData, skipEmail = false) {
  const payload = {
    event_type: 'send_approved_email',
    client_payload: {
      firm_name: approvalData.firm_name,
      firm_folder: approvalData.firm_folder,
      lead_email: approvalData.lead_email,
      contact_name: approvalData.contact_name,
      report_url: approvalData.report_url,
      country: approvalData.country || '',
      total_range: approvalData.total_range || '',
      total_cases: approvalData.total_cases || '',
      practice_label: approvalData.practice_label || '',
      _extra: JSON.stringify({
        classification: approvalData.classification || 'INTERESTED',
        skip_email: skipEmail ? 'true' : '',
        ooo_return_date: approvalData.ooo_return_date || '',
        channel: approvalData.channel || 'instantly',
        linkedin_url: approvalData.linkedin_url || approvalData.linkedin || '',
        prosp_sender: approvalData.prosp_sender || '',
        source: approvalData.source || '',
        connection_dm: approvalData.connection_dm || '',
        reply_text: approvalData.reply_text || ''
      })
    }
  };

  const response = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/dispatches`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/vnd.github.v3+json',
      'Authorization': `Bearer ${githubToken}`,
      'User-Agent': 'MortarMetrics-Telegram-Bot'
    },
    body: JSON.stringify(payload)
  });

  if (response.status === 204) {
    return { success: true };
  } else {
    const text = await response.text();
    throw new Error(`GitHub API error: ${response.status} ${text}`);
  }
}

export async function fetchApprovalData(githubToken, firmFolder) {
  const url = `https://api.github.com/repos/${GITHUB_REPO}/contents/automation/pending-approvals/${encodeURIComponent(firmFolder + '.json')}`;
  const response = await fetch(url, {
    headers: {
      'Accept': 'application/vnd.github.v3+json',
      'Authorization': `Bearer ${githubToken}`,
      'User-Agent': 'MortarMetrics-Telegram-Bot'
    }
  });

  if (response.status === 200) {
    const data = await response.json();
    const content = atob(data.content);
    return JSON.parse(content);
  }
  return null;
}

export async function forwardToGitHub(env, githubPayload) {
  const response = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/dispatches`, {
    method: 'POST',
    headers: {
      'Authorization': `token ${env.GITHUB_TOKEN}`,
      'Accept': 'application/vnd.github.v3+json',
      'Content-Type': 'application/json',
      'User-Agent': 'Cloudflare-Worker-Instantly-Proxy'
    },
    body: JSON.stringify(githubPayload)
  });

  if (response.status !== 204) {
    const errorText = await response.text();
    throw new Error(`GitHub error: ${response.status} ${errorText}`);
  }
}
