#!/usr/bin/env node
// Creates a draft Autosend campaign + test email for one post slug.
// Usage: node scripts/newsletter-draft.mjs <slug> [--dry-run]
// Requires a prior `npm run build`. Idempotent by campaign name.
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { transformEmailHtml } from "./lib/email-transform.mjs";
import { campaignNameForSlug, createClient } from "./lib/autosend.mjs";

const SITE_URL = process.env.SITE_URL ?? "https://darshanpania.me";
const REPLY_TO = "darshanpania@gmail.com";
const FROM_NAME = "Darshan Pania";

function fail(msg) {
  console.error(`[newsletter-draft] ${msg}`);
  process.exit(1);
}

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const slug = args.find((a) => !a.startsWith("--"));
if (!slug) fail("usage: newsletter-draft.mjs <slug> [--dry-run]");

// --- read frontmatter -------------------------------------------------
const postPath = ["mdx", "md"]
  .map((ext) => path.join("src/content/posts", `${slug}.${ext}`))
  .find(existsSync);
if (!postPath) fail(`no post file for slug "${slug}"`);

const { data: fm } = matter(await readFile(postPath, "utf8"));
if (fm.draft) {
  console.log(`[newsletter-draft] "${slug}" is a draft post — skipping`);
  process.exit(0);
}
if (!fm.title) fail(`post "${slug}" has no title`);

// --- read built email HTML -------------------------------------------
const builtHtmlPath = path.join("dist/client/newsletter", slug, "index.html");
if (!existsSync(builtHtmlPath)) {
  console.log(
    `[newsletter-draft] no built HTML at ${builtHtmlPath} — skipping (draft or missing build?)`,
  );
  process.exit(0);
}
const rawHtml = await readFile(builtHtmlPath, "utf8");

// --- transform --------------------------------------------------------
const postUrl = `${SITE_URL}/blog/${slug}/`;
const html = transformEmailHtml(rawHtml, { siteUrl: SITE_URL, postUrl });

const bodyMatch = html.includes("data-newsletter-body");
if (!bodyMatch || html.length < 500) {
  fail(`transformed HTML for "${slug}" looks empty — refusing to draft`);
}

const subject = fm.title;
const previewText = (fm.description ?? "").slice(0, 140);
const name = campaignNameForSlug(slug);

// --- dry run ----------------------------------------------------------
if (dryRun) {
  await mkdir("scripts/out", { recursive: true });
  const outPath = path.join("scripts/out", `${slug}.email.html`);
  await writeFile(outPath, html);
  console.log(`[newsletter-draft] dry run — wrote ${outPath}`);
  console.log(
    `[newsletter-draft] would create draft: name="${name}" subject="${subject}"`,
  );
  process.exit(0);
}

// --- env for the real thing ------------------------------------------
const env = (key) => process.env[key] || fail(`missing env ${key}`);
const client = createClient({ apiKey: env("AUTOSEND_API_KEY") });
const listId = env("AUTOSEND_LIST_ID");
const senderId = env("AUTOSEND_SENDER_ID");
const senderEmail = env("AUTOSEND_SENDER_EMAIL");
const unsubGroupId = env("AUTOSEND_UNSUB_GROUP_ID");
const testEmail = env("NEWSLETTER_TEST_EMAIL");

// --- idempotency check ------------------------------------------------
// Reuse an existing draft instead of exiting: if a prior run created the
// campaign but died before the test email went out, the retry must still
// send it.
let campaign = await client.findCampaignByName(name);
if (campaign) {
  console.log(
    `[newsletter-draft] campaign "${name}" already exists (id ${campaign.id}) — skipping creation`,
  );
} else {
  campaign = await client.createDraftCampaign({
    name,
    subject,
    previewText,
    fromSenderId: senderId,
    replyTo: REPLY_TO,
    htmlTemplate: html,
    listId,
    unsubscribeGroupId: unsubGroupId,
  });
  console.log(`[newsletter-draft] created draft campaign id ${campaign.id}`);
}

await client.sendTestEmail({
  toEmail: testEmail,
  fromEmail: senderEmail,
  fromName: FROM_NAME,
  replyTo: REPLY_TO,
  subject: `[test] ${subject}`,
  html,
  unsubscribeGroupId: unsubGroupId,
});
console.log(`[newsletter-draft] test email sent — go approve the campaign`);
