import { createHash, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { ContentDatabaseConfigurationError } from "./database";
import { ContentWriteError } from "./postgresContent";

export const CONTENT_BODY_LIMIT = 4_000_000;

export class ContentHttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export const contentJson = (body: unknown, status = 200, headers?: HeadersInit) =>
  Response.json(body, {
    status,
    headers: { ...Object.fromEntries(new Headers(headers)), "Cache-Control": "no-store" },
  });

export const authenticateContentRequest = (
  request: Request,
  token = process.env.CONTENT_API_TOKEN,
) => {
  if (!token || Buffer.byteLength(token) < 32)
    throw new ContentHttpError(503, "unavailable", "The content API is not configured.");
  const authorization = request.headers.get("authorization");
  const presented = authorization?.match(/^Bearer ([^\s]+)$/i)?.[1] ?? "";
  if (
    !timingSafeEqual(
      createHash("sha256").update(presented).digest(),
      createHash("sha256").update(token).digest(),
    )
  )
    throw new ContentHttpError(401, "unauthorized", "A valid API credential is required.");
};

export const readContentBody = async (request: Request) => {
  if (
    request.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase() !==
    "application/json"
  )
    throw new ContentHttpError(415, "unsupported-media-type", "Use application/json.");
  if (
    request.headers.has("content-encoding") &&
    request.headers.get("content-encoding") !== "identity"
  )
    throw new ContentHttpError(415, "unsupported-media-type", "Use uncompressed JSON.");
  if (Number(request.headers.get("content-length")) > CONTENT_BODY_LIMIT)
    throw new ContentHttpError(
      413,
      "payload-too-large",
      "The request exceeds the content API body limit.",
    );
  if (!request.body) throw new ContentHttpError(400, "invalid", "A JSON body is required.");
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > CONTENT_BODY_LIMIT) {
        await reader.cancel();
        throw new ContentHttpError(
          413,
          "payload-too-large",
          "The request exceeds the content API body limit.",
        );
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  try {
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(Buffer.concat(chunks)));
  } catch {
    throw new ContentHttpError(400, "invalid", "The request must contain valid JSON.");
  }
};

export const contentErrorResponse = (error: unknown) => {
  if (error instanceof ContentHttpError)
    return contentJson({ error: { code: error.code, message: error.message } }, error.status);
  if (error instanceof ContentDatabaseConfigurationError)
    return contentJson(
      { error: { code: "unavailable", message: "The content store is not configured." } },
      503,
    );
  if (error instanceof ContentWriteError)
    return contentJson(
      {
        error: {
          code: error.reason,
          message: {
            invalid: "The operation identity or content is invalid.",
            conflict: "The online version has changed.",
            obsolete: "The target was removed or generation inputs changed.",
          }[error.reason],
        },
      },
      error.reason === "invalid" ? 400 : 409,
    );
  const code = error && typeof error === "object" && "code" in error ? String(error.code) : "";
  if (code === "23505")
    return contentJson(
      { error: { code: "conflict", message: "The content identity is already in use." } },
      409,
    );
  if (code === "40001" || code === "40P01")
    return contentJson(
      {
        error: { code: "conflict", message: "A concurrent operation changed the online version." },
      },
      409,
    );
  if (
    code.startsWith("08") ||
    [
      "53300",
      "53400",
      "57P01",
      "57P02",
      "57P03",
      "57014",
      "55P03",
      "ECONNREFUSED",
      "ECONNRESET",
      "ETIMEDOUT",
      "EPIPE",
      "ENOTFOUND",
      "EAI_AGAIN",
      "SELF_SIGNED_CERT_IN_CHAIN",
      "DEPTH_ZERO_SELF_SIGNED_CERT",
      "UNABLE_TO_VERIFY_LEAF_SIGNATURE",
      "CERT_HAS_EXPIRED",
      "ERR_TLS_CERT_ALTNAME_INVALID",
    ].includes(code) ||
    (error instanceof Error &&
      /^(Connection terminated|Connection timeout|timeout exceeded when trying to connect|Query read timeout|Received invalid response to SSL negotiation|The server does not support SSL connections|There was an error establishing an SSL connection)/i.test(
        error.message,
      ))
  )
    return contentJson(
      { error: { code: "unavailable", message: "The content store is temporarily unavailable." } },
      503,
    );
  // Validation of database results is a server error; never return its details as bad client input.
  return contentJson(
    { error: { code: "internal", message: "The content request could not be completed." } },
    500,
  );
};

export const parseContentInput = <T>(schema: z.ZodType<T>, value: unknown): T => {
  const result = schema.safeParse(value);
  if (!result.success)
    throw new ContentHttpError(
      400,
      "invalid",
      "The request does not match the content API schema.",
    );
  return result.data;
};
