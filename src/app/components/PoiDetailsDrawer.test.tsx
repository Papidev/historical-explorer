// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import type { Poi } from "@/types/Poi";
import { PoiDetailsDrawer } from "./PoiDetailsDrawer";
import { exampleStoryWrite } from "@/server/content/__fixtures__/writes";

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
  relatedPeople: [{ name: "Hercules", personId: "hercules" }, { name: "Unresolved figure" }],
};

beforeAll(() => {
  vi.stubGlobal("fetch", (input: string | URL | Request, init?: RequestInit) =>
    nativeFetch(typeof input === "string" ? new URL(input, "http://localhost") : input, init),
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
    const { rerender } = render(<PoiDetailsDrawer citySlug="rome" poi={poi} onClose={onClose} />);

    expect(screen.queryByText("Loading additional content...")).not.toBeInTheDocument();
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
    rerender(<PoiDetailsDrawer citySlug="rome" onClose={onClose} />);
    expect(screen.getByText("A visitor-facing introduction.")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Forum Boarium" })).not.toBeInTheDocument();
    await waitFor(() =>
      expect(screen.queryByText("A visitor-facing introduction.")).not.toBeInTheDocument(),
    );
  });

  it("shows a fallback when a resolved Person is unavailable and still allows Back", async () => {
    let finishStory: () => void;
    server.use(
      http.get("*/api/pois/rome/forum-boarium/dialog-content", async () => {
        await new Promise<void>((resolve) => {
          finishStory = resolve;
        });
        return HttpResponse.json({ storyContent });
      }),
    );
    server.use(http.get("*/api/people/hercules", () => HttpResponse.json({ person: null })));
    const user = userEvent.setup();
    render(<PoiDetailsDrawer citySlug="rome" poi={poi} onClose={() => {}} />);

    expect(screen.queryByText("Loading additional content...")).not.toBeInTheDocument();
    expect(screen.queryByText(/No additional content/)).not.toBeInTheDocument();
    expect(await screen.findByText("Loading additional content...")).toBeInTheDocument();
    finishStory!();
    await user.click(await screen.findByRole("button", { name: "Hercules" }));
    expect(screen.queryByText("Loading additional content...")).not.toBeInTheDocument();

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
      <PoiDetailsDrawer citySlug="rome" poi={poi} openRequestId={1} onClose={() => {}} />,
    );

    await user.click(await screen.findByRole("button", { name: "Hercules" }));
    expect(await screen.findByRole("heading", { name: "Hercules" })).toBeInTheDocument();

    rerender(<PoiDetailsDrawer citySlug="rome" poi={poi} openRequestId={2} onClose={() => {}} />);

    expect(screen.getByRole("heading", { name: "Forum Boarium" })).toBeInTheDocument();
    expect(screen.getByText("A visitor-facing introduction.")).toBeInTheDocument();
  });
});

describe("online Story details", () => {
  it("shows an image placeholder, online Markdown and a linked Person", async () => {
    const detail = exampleStoryWrite().detail;
    detail.story.introduction.text = "Built under **Vespasian**.";
    server.use(
      http.get("*/api/pois/rome/forum-boarium/dialog-content", () =>
        HttpResponse.json({
          detail,
          storyContent: {
            ...storyContent,
            introduction: "Built under **Vespasian**.",
            textFormat: "markdown",
            relatedPeople: [{ name: "Vespasian", personId: "vespasian" }],
          },
        }),
      ),
      http.get("*/api/people/vespasian", () =>
        HttpResponse.json({
          person: {
            id: "vespasian",
            name: "Vespasian",
            textFormat: "markdown",
            description: ["A **Roman** emperor.", "He commissioned the amphitheatre."],
            curiosities: [],
          },
        }),
      ),
    );
    const user = userEvent.setup();
    render(<PoiDetailsDrawer citySlug="rome" poi={poi} onClose={() => {}} />);
    expect(await screen.findByText("Image unavailable")).toBeInTheDocument();
    expect(screen.getByText("Vespasian", { selector: "strong" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Vespasian" }));
    expect(await screen.findByText("Roman", { selector: "strong" })).toBeInTheDocument();
  });

  it("opens additional images in the gallery without the old drawer section", async () => {
    const detail = exampleStoryWrite().detail;
    detail.gallery = ["First.jpg", "Second.jpg"].map((id) => ({
      id,
      commonsPageUrl: `https://commons.wikimedia.org/wiki/File:${id}`,
      thumbnailUrl: `https://upload.wikimedia.org/wikipedia/commons/${id}`,
      originalImageUrl: `https://upload.wikimedia.org/wikipedia/commons/${id}`,
      license: "CC BY-SA 4.0",
      attribution: id === "First.jpg" ? "Main photographer" : "Gallery photographer",
    }));
    detail.mainImageId = "First.jpg";
    server.use(
      http.get("*/api/pois/rome/forum-boarium/dialog-content", () =>
        HttpResponse.json({ detail, storyContent }),
      ),
    );
    const user = userEvent.setup();
    const { rerender } = render(<PoiDetailsDrawer citySlug="rome" poi={poi} onClose={() => {}} />);
    expect(await screen.findByAltText("Main image of Colosseum")).toHaveAttribute(
      "src",
      expect.stringContaining("First.jpg"),
    );
    expect(screen.getByText(/Main photographer/)).toBeInTheDocument();
    expect(screen.queryByText("More images")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Open image gallery for Colosseum" }));
    await user.click(screen.getByRole("button", { name: "Next photo" }));
    expect(screen.getByRole("img", { name: "Colosseum — photo 2" })).toBeInTheDocument();
    expect(screen.getByText(/Gallery photographer/)).toBeVisible();
    rerender(<PoiDetailsDrawer citySlug="rome" onClose={() => {}} />);
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });
});
