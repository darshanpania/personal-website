/**
 * A stop is a place in the 3D world. Each URL of the site maps to one stop,
 * and a page change moves the camera to the stop of the new page.
 */

export const STOPS = ["home", "blog", "post", "projects", "resume", "contact", "other"] as const;

export type Stop = (typeof STOPS)[number];

export function stopFor(pathname: string): Stop {
  const path = pathname.replace(/\/+$/, "") || "/";
  if (path === "/") return "home";
  if (path === "/blog") return "blog";
  if (path.startsWith("/blog/")) return "post";
  if (path === "/projects") return "projects";
  if (path === "/resume") return "resume";
  if (path === "/contact") return "contact";
  return "other";
}
