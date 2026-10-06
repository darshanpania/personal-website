// Draft posts stay out of production but show on Vercel preview builds,
// so a draft PR can be read in its preview deployment.
export function showDrafts(vercelEnv: string | undefined = process.env.VERCEL_ENV): boolean {
  return vercelEnv === "preview";
}

export function isListed(data: { draft?: boolean }, vercelEnv?: string): boolean {
  return !data.draft || showDrafts(vercelEnv ?? process.env.VERCEL_ENV);
}
