// Thin Autosend REST client. No PII in thrown errors or logs — status
// codes and ids only. Endpoints verified against docs.autosend.com.
const BASE = "https://api.autosend.com/v1";

export function campaignNameForSlug(slug) {
  return `blog: ${slug}`;
}

export function createClient({ apiKey, fetchImpl = fetch, timeoutMs = 15000 }) {
  async function request(method, path, { query, body } = {}) {
    const url = new URL(`${BASE}${path}`);
    for (const [k, v] of Object.entries(query ?? {})) {
      url.searchParams.set(k, String(v));
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetchImpl(url.toString(), {
        method,
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: controller.signal,
      });
      if (!res.ok) {
        throw new Error(`Autosend ${method} ${path} failed: HTTP ${res.status}`);
      }
      return await res.json();
    } finally {
      clearTimeout(timer);
    }
  }

  return {
    async findCampaignByName(name) {
      const json = await request("GET", "/campaigns", {
        query: { name, limit: 100 },
      });
      const campaigns = json?.data?.campaigns ?? [];
      return campaigns.find((c) => c.name === name) ?? null;
    },

    async createDraftCampaign({
      name,
      subject,
      previewText,
      fromSenderId,
      replyTo,
      htmlTemplate,
      listId,
      unsubscribeGroupId,
    }) {
      // Draft on purpose: publish/sendNow/scheduledAt are never set.
      const json = await request("POST", "/campaigns", {
        body: {
          name,
          subject,
          previewText,
          fromSenderId,
          replyTo,
          htmlTemplate,
          toLists: [listId],
          unsubscribeGroupId,
          trackingClick: true,
          trackingOpen: true,
        },
      });
      return json.data;
    },

    async sendTestEmail({
      toEmail,
      fromEmail,
      fromName,
      replyTo,
      subject,
      html,
      unsubscribeGroupId,
    }) {
      const json = await request("POST", "/mails/send", {
        body: {
          to: { email: toEmail },
          from: { email: fromEmail, name: fromName },
          replyTo: { email: replyTo },
          subject,
          html,
          unsubscribeGroupId,
        },
      });
      return json.data;
    },
  };
}
