// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { PoiImageGallery } from ".";

const images = ["First", "Second", "Third"].map((id) => ({
  id,
  thumbnailUrl: `https://upload.wikimedia.org/wikipedia/commons/thumb/${id}/960px-${id}.jpg`,
  originalImageUrl: `https://upload.wikimedia.org/wikipedia/commons/${id}.jpg`,
  commonsPageUrl: `https://commons.wikimedia.org/wiki/File:${id}.jpg`,
  attribution: `${id} photographer`,
  license: "CC BY-SA 4.0",
  width: 2000,
}));

afterEach(cleanup);

describe("POI image gallery", () => {
  it("opens the Main Image, navigates with arrows and thumbnails, and restores focus on Escape", async () => {
    const user = userEvent.setup();
    render(<PoiImageGallery images={images} mainImageId="Second" name="Colosseum" />);
    const trigger = screen.getByRole("button", { name: "Open image gallery for Colosseum" });
    expect(screen.queryAllByRole("img")).toHaveLength(0);
    await user.click(trigger);
    const gallery = screen.getByRole("dialog", { name: "Colosseum" });
    expect(within(gallery).getByText("Photo 2 of 3")).toBeVisible();
    expect(within(gallery).getByText(/Second photographer/)).toBeVisible();
    await user.click(within(gallery).getByRole("button", { name: "Next photo" }));
    expect(within(gallery).getByText("Photo 3 of 3")).toBeVisible();
    await user.keyboard("{ArrowRight}");
    expect(within(gallery).getByText("Photo 1 of 3")).toBeVisible();
    await user.keyboard("{ArrowLeft}");
    expect(within(gallery).getByText("Photo 3 of 3")).toBeVisible();
    await user.click(within(gallery).getByRole("button", { name: "View photo 2" }));
    expect(within(gallery).getByRole("button", { name: "View photo 2" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it("requests an optimized thumbnail instead of the full original and keeps the original opt-in", async () => {
    const user = userEvent.setup();
    render(<PoiImageGallery images={images} mainImageId="First" name="Colosseum" />);
    await user.click(screen.getByRole("button", { name: "Open image gallery for Colosseum" }));
    const image = screen.getByRole("img", { name: "Colosseum — photo 1" });
    expect(image).toHaveAttribute("src", expect.stringContaining("/_next/image?"));
    expect(new URL(image.getAttribute("src")!, "http://localhost").searchParams.get("url")).toBe(
      images[0].thumbnailUrl,
    );
    expect(screen.getByRole("link", { name: "Open original ↗" })).toHaveAttribute(
      "href",
      images[0].originalImageUrl,
    );
    fireEvent.load(image);
    await waitFor(() => expect(screen.queryByText("Loading image…")).not.toBeInTheDocument());
    expect(screen.getAllByAltText("")).toHaveLength(images.length);
  });

  it("shows an error immediately and retries through Next Image only on request", async () => {
    const user = userEvent.setup();
    render(<PoiImageGallery images={images} mainImageId="First" name="Colosseum" />);
    await user.click(screen.getByRole("button", { name: "Open image gallery for Colosseum" }));
    const source = screen.getByRole("img", { name: "Colosseum — photo 1" }).getAttribute("src");
    fireEvent.error(screen.getByRole("img", { name: "Colosseum — photo 1" }));
    expect(screen.getByText("Image unavailable")).toBeVisible();
    expect(screen.queryByRole("img", { name: "Colosseum — photo 1" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Retry" }));
    expect(screen.getByText("Loading image…")).toBeVisible();
    const retriedImage = screen.getByRole("img", { name: "Colosseum — photo 1" });
    expect(retriedImage).toHaveAttribute("src", source);
    expect(retriedImage).toHaveAttribute("src", expect.stringContaining("/_next/image?"));
    fireEvent.load(retriedImage);
    await waitFor(() => expect(retriedImage).toBeVisible());
    expect(screen.queryByRole("button", { name: "Retry" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Next photo" }));
    expect(screen.getByText("Photo 2 of 3")).toBeVisible();
    expect(screen.getByText("Loading image…")).toBeVisible();
  });

  it("keeps an unavailable thumbnail selectable without retrying it automatically", async () => {
    const user = userEvent.setup();
    render(<PoiImageGallery images={images} mainImageId="First" name="Colosseum" />);
    await user.click(screen.getByRole("button", { name: "Open image gallery for Colosseum" }));
    const thumbnail = screen.getByRole("button", { name: "View photo 2" });
    fireEvent.error(within(thumbnail).getByAltText(""));
    expect(within(thumbnail).getByText("Unavailable")).toBeVisible();
    expect(within(thumbnail).queryByAltText("")).not.toBeInTheDocument();
    await user.click(thumbnail);
    expect(screen.getByText("Photo 2 of 3")).toBeVisible();
    expect(screen.getByText("Loading image…")).toBeVisible();
  });

  it("supports horizontal swipes and ignores vertical gestures", async () => {
    const user = userEvent.setup();
    render(<PoiImageGallery images={images} mainImageId="First" name="Colosseum" />);
    await user.click(screen.getByRole("button", { name: "Open image gallery for Colosseum" }));
    fireEvent.touchStart(screen.getByRole("img", { name: "Colosseum — photo 1" }), {
      touches: [{ clientX: 200, clientY: 100 }],
    });
    fireEvent.touchEnd(screen.getByRole("img", { name: "Colosseum — photo 1" }), {
      changedTouches: [{ clientX: 100, clientY: 110 }],
    });
    expect(screen.getByText("Photo 2 of 3")).toBeVisible();
    fireEvent.touchStart(screen.getByRole("img", { name: "Colosseum — photo 2" }), {
      touches: [{ clientX: 200, clientY: 100 }],
    });
    fireEvent.touchEnd(screen.getByRole("img", { name: "Colosseum — photo 2" }), {
      changedTouches: [{ clientX: 100, clientY: 300 }],
    });
    expect(screen.getByText("Photo 2 of 3")).toBeVisible();
  });

  it("opens a single image with disabled navigation and closes with the button", async () => {
    const user = userEvent.setup();
    render(<PoiImageGallery images={images.slice(0, 1)} mainImageId="First" name="Colosseum" />);
    await user.click(screen.getByRole("button", { name: "Open image gallery for Colosseum" }));
    expect(screen.getByText("Photo 1 of 1")).toBeVisible();
    expect(screen.getByRole("button", { name: "Next photo" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Previous photo" })).toBeDisabled();
    expect(screen.queryByRole("group", { name: "Choose a photo" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Close gallery" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("does not offer a gallery for an empty image collection", () => {
    render(<PoiImageGallery images={[]} mainImageId={null} name="Colosseum" />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
