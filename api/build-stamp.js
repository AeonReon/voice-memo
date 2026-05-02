// Build-stamp endpoint for the iOS PWA cache-bust dance.
// Returns the Vercel deployment commit SHA — changes on every deploy,
// which is exactly what the page-side poller needs to detect a new build.

export default function handler(_req, res) {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
  const stamp =
    process.env.VERCEL_GIT_COMMIT_SHA ||
    process.env.VERCEL_DEPLOYMENT_ID ||
    String(Date.now());
  res.status(200).json({ stamp });
}
