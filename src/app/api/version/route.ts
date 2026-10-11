export const dynamic = "force-static";

export const GET = () =>
  Response.json({
    version: process.env.APP_VERSION,
    commit: process.env.APP_COMMIT || null,
  });
