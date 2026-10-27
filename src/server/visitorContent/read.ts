import { setTimeout } from "node:timers/promises";
import { createCachedRead } from "./cache";

export const createPublishedRead = <T>(read: (id: string) => Promise<T>) =>
  createCachedRead(async (id) => {
    for (let attempt = 0; ; attempt++) {
      try {
        return await read(id);
      } catch (error) {
        // pg hides the pooler's pre-authentication ErrorResponse behind this message.
        // Retry only this observed handshake failure, never SQL or certificate errors.
        if (
          attempt >= 4 ||
          !(error instanceof Error) ||
          error.message !== "There was an error establishing an SSL connection"
        )
          throw error;
        await setTimeout(Math.min(100 * 2 ** attempt, 200));
      }
    }
  });
