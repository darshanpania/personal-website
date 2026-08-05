// Pure HTML → email-HTML transform. No I/O, no env — unit-testable.
import * as cheerio from "cheerio";
import juice from "juice";

const SKIP_URL = /^(https?:|mailto:|tel:|#|\{\{)/;

export function transformEmailHtml(html, { siteUrl, postUrl }) {
  const base = siteUrl.replace(/\/$/, "");
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
    $el.attr(attr, val.startsWith("/") ? `${base}${val}` : `${base}/${val}`);
  };
  $("[href]").each(absolutize("href"));
  $("[src]").each(absolutize("src"));

  // Inline the <style> block into style="" attributes for client support.
  // preserveMediaQueries keeps any @media rules in a residual <style> tag.
  return juice($.html(), { preserveMediaQueries: true });
}
