import { describe, expect, it } from "vitest";
import {
  campaignNameForSlug,
  createClient,
} from "../../scripts/lib/autosend.mjs";

type Call = { url: string; init: RequestInit };

function fakeFetch(status: number, body: unknown) {
  const calls: Call[] = [];
  const impl = async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    return new Response(JSON.stringify(body), { status });
  };
  return { calls, impl: impl as unknown as typeof fetch };
}

describe("campaignNameForSlug", () => {
  it("uses the locked naming convention", () => {
    expect(campaignNameForSlug("my-post")).toBe("blog: my-post");
  });
});

describe("findCampaignByName", () => {
  it("returns the exact-name match from partial-match results", async () => {
    const { calls, impl } = fakeFetch(200, {
      success: true,
      data: {
        campaigns: [
          { id: "1", name: "blog: my-post-part-2" },
          { id: "2", name: "blog: my-post" },
        ],
      },
    });
    const client = createClient({ apiKey: "k", fetchImpl: impl });
    const found = await client.findCampaignByName("blog: my-post");
    expect(found?.id).toBe("2");
    expect(calls[0].url).toContain("/v1/campaigns?");
    expect(calls[0].url).toContain("name=blog%3A+my-post");
    expect((calls[0].init.headers as Record<string, string>).Authorization).toBe(
      "Bearer k",
    );
  });

  it("returns null when nothing matches exactly", async () => {
    const { impl } = fakeFetch(200, {
      success: true,
      data: { campaigns: [{ id: "1", name: "blog: my-post-part-2" }] },
    });
    const client = createClient({ apiKey: "k", fetchImpl: impl });
    expect(await client.findCampaignByName("blog: my-post")).toBeNull();
  });
});

describe("createDraftCampaign", () => {
  it("POSTs a draft (no publish/sendNow/scheduledAt) with the right shape", async () => {
    const { calls, impl } = fakeFetch(200, {
      success: true,
      data: { id: "c1", name: "blog: my-post", status: "draft" },
    });
    const client = createClient({ apiKey: "k", fetchImpl: impl });
    const data = await client.createDraftCampaign({
      name: "blog: my-post",
      subject: "My Post",
      previewText: "preview",
      fromSenderId: "s1",
      replyTo: "reply@example.com",
      htmlTemplate: "<html>x</html>",
      listId: "l1",
      unsubscribeGroupId: "g1",
    });
    expect(data.id).toBe("c1");
    const body = JSON.parse(calls[0].init.body as string);
    expect(calls[0].url).toMatch(/\/v1\/campaigns$/);
    expect(calls[0].init.method).toBe("POST");
    expect(body).toMatchObject({
      name: "blog: my-post",
      subject: "My Post",
      previewText: "preview",
      fromSenderId: "s1",
      replyTo: "reply@example.com",
      htmlTemplate: "<html>x</html>",
      toLists: ["l1"],
      unsubscribeGroupId: "g1",
      trackingClick: true,
      trackingOpen: true,
    });
    expect(body.publish).toBeUndefined();
    expect(body.sendNow).toBeUndefined();
    expect(body.scheduledAt).toBeUndefined();
  });
});

describe("sendTestEmail", () => {
  it("POSTs to /v1/mails/send", async () => {
    const { calls, impl } = fakeFetch(200, {
      success: true,
      data: { emailId: "e1" },
    });
    const client = createClient({ apiKey: "k", fetchImpl: impl });
    await client.sendTestEmail({
      toEmail: "me@example.com",
      fromEmail: "musings@darshanpania.me",
      fromName: "Darshan Pania",
      replyTo: "reply@example.com",
      subject: "[test] My Post",
      html: "<html>x</html>",
      unsubscribeGroupId: "g1",
    });
    const body = JSON.parse(calls[0].init.body as string);
    expect(calls[0].url).toMatch(/\/v1\/mails\/send$/);
    expect(body.to).toEqual({ email: "me@example.com" });
    expect(body.from).toEqual({
      email: "musings@darshanpania.me",
      name: "Darshan Pania",
    });
    expect(body.subject).toBe("[test] My Post");
  });
});

describe("error handling", () => {
  it("throws with status code but not response body", async () => {
    const { impl } = fakeFetch(500, { secret: "pii" });
    const client = createClient({ apiKey: "k", fetchImpl: impl });
    await expect(client.findCampaignByName("x")).rejects.toThrow(/500/);
    await expect(client.findCampaignByName("x")).rejects.not.toThrow(/pii/);
  });
});
