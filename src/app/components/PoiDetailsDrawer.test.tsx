// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import type { Poi } from "@/types/Poi";
import { PoiDetailsDrawer } from "./PoiDetailsDrawer";

const server = setupServer();
const nativeFetch = globalThis.fetch;

const poi: Poi = {
  id: "forum-boarium",
  name: "Forum Boarium",
  city: "Rome",
  coordinates: { lat: 41.889, lng: 12.481 },
  funFacts: [],
};

const storyContent = {
  introduction: "A visitor-facing introduction.",
  topics: { history: [], design: [], art: [] },
  relatedPeople: [
    { name: "Hercules", personId: "hercules" },
    { name: "Unresolved figure" },
  ],
};

beforeAll(() => {
  vi.stubGlobal("fetch", (input: string | URL | Request, init?: RequestInit) =>
    nativeFetch(
      typeof input === "string" ? new URL(input, "http://localhost") : input,
      init,
    ),
  );
  server.listen({ onUnhandledRequest: "error" });
});

afterEach(() => {
  cleanup();
  server.resetHandlers();
});

afterAll(() => {
  server.close();
  vi.unstubAllGlobals();
});

const useStoryResponse = () => {
  server.use(
    http.get("*/api/pois/rome/forum-boarium/dialog-content", () =>
      HttpResponse.json({ storyContent }),
    ),
  );
};

describe("POI details person navigation", () => {
  it("opens a resolved Person, returns to the same Story, and closes the drawer", async () => {
    useStoryResponse();
    server.use(
      http.get("*/api/people/hercules", () =>
        HttpResponse.json({
          person: {
            id: "hercules",
            name: "Hercules",
            description: ["First Person paragraph.", "Second Person paragraph."],
            curiosities: [],
          },
        }),
      ),
    );
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<PoiDetailsDrawer citySlug="rome" poi={poi} onClose={onClose} />);

    expect(await screen.findByText("A visitor-facing introduction.")).toBeInTheDocument();
    expect(screen.getByText("Unresolved figure")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Unresolved figure" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Hercules" }));

    expect(await screen.findByText("First Person paragraph.")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Hercules" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Back to Forum Boarium" }));

    expect(screen.getByText("A visitor-facing introduction.")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Forum Boarium" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("shows a fallback when a resolved Person is unavailable and still allows Back", async () => {
    useStoryResponse();
    server.use(
      http.get("*/api/people/hercules", () =>
        HttpResponse.json({ person: null }),
      ),
    );
    const user = userEvent.setup();
    render(<PoiDetailsDrawer citySlug="rome" poi={poi} onClose={() => {}} />);

    await user.click(await screen.findByRole("button", { name: "Hercules" }));

    expect(await screen.findByText("This person is unavailable.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Back to Forum Boarium" }));
    expect(screen.getByText("A visitor-facing introduction.")).toBeInTheDocument();
  });

  it("returns to the POI when the same POI is opened again", async () => {
    useStoryResponse();
    server.use(
      http.get("*/api/people/hercules", () =>
        HttpResponse.json({
          person: {
            id: "hercules",
            name: "Hercules",
            description: ["First Person paragraph.", "Second Person paragraph."],
            curiosities: [],
          },
        }),
      ),
    );
    const user = userEvent.setup();
    const { rerender } = render(
      <PoiDetailsDrawer
        citySlug="rome"
        poi={poi}
        openRequestId={1}
        onClose={() => {}}
      />,
    );

    await user.click(await screen.findByRole("button", { name: "Hercules" }));
    expect(await screen.findByRole("heading", { name: "Hercules" })).toBeInTheDocument();

    rerender(
      <PoiDetailsDrawer
        citySlug="rome"
        poi={poi}
        openRequestId={2}
        onClose={() => {}}
      />,
    );

    expect(screen.getByRole("heading", { name: "Forum Boarium" })).toBeInTheDocument();
    expect(screen.getByText("A visitor-facing introduction.")).toBeInTheDocument();
  });
});
