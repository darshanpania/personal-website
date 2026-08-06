// Pure HTML → email-HTML transform. No I/O, no env — unit-testable.
import * as cheerio from "cheerio";
import juice from "juice";

// Skip fragments, merge tags ({{unsubscribe}}), and anything with a scheme
// (http, https, mailto, tel, data, cid, ...). Everything else resolves
// against the post URL, which also normalizes protocol-relative //host paths.
const SKIP_URL = /^(#|\{\{|[a-zA-Z][a-zA-Z0-9+.-]*:)/;

export function transformEmailHtml(html, { postUrl }) {
  const $ = cheerio.load(html);

  $("script").remove();

  $("iframe, video, audio, embed, object").each((_, el) => {
    $(el).replaceWith(
      `<p><a href="${postUrl}">view this on the site →</a></p>`,
    );
  });

  const absolutize = (attr) => (_, el) => {
    const $el = $(el);
    const val = $el.attr(attr);
    if (!val || SKIP_URL.test(val)) return;
    try {
      $el.attr(attr, new URL(val, postUrl).href);
    } catch {
      // Malformed URL — leave it untouched rather than corrupt it.
    }
  };
  $("[href]").each(absolutize("href"));
  $("[src]").each(absolutize("src"));

  // Inline the <style> block into style="" attributes for client support.
  // preserveMediaQueries keeps any @media rules in a residual <style> tag.
  return juice($.html(), { preserveMediaQueries: true });
}
