import { getContentPool } from "@/server/content/database";
import { createContentHandler } from "@/server/content/handler";
import { createPostgresContent } from "@/server/content/postgresContent";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const handle = createContentHandler(() => createPostgresContent(getContentPool()));
export {
  handle as GET,
  handle as PUT,
  handle as POST,
  handle as PATCH,
  handle as DELETE,
  handle as HEAD,
  handle as OPTIONS,
};
