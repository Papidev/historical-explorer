// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it } from "vitest";
import { WikipediaLinks } from "./WikipediaLinks";

afterEach(cleanup);

it("keeps other editions hidden until requested and opens articles in new tabs", async () => {
  const user = userEvent.setup();
  render(
    <WikipediaLinks
      sources={[
        { title: "Foro Boario", url: "https://it.wikipedia.org/wiki/Foro_Boario" },
        { title: "Forum Boarium", url: "https://en.wikipedia.org/wiki/Forum_Boarium" },
      ]}
    />,
  );
  const primary = screen.getByRole("link", {
    name: "Forum Boarium on Wikipedia (opens in a new tab)",
  });
  expect(primary).toHaveAttribute("href", "https://en.wikipedia.org/wiki/Forum_Boarium");
  expect(primary).toHaveAttribute("target", "_blank");
  expect(primary).toHaveAttribute("rel", "noopener noreferrer");
  expect(screen.getAllByRole("link")).toHaveLength(1);
  await user.click(screen.getByRole("button", { name: "Other languages" }));
  const italian = screen.getByRole("link", {
    name: "Foro Boario on Wikipedia (opens in a new tab)",
  });
  expect(italian).toHaveTextContent("Italian");
  expect(italian).toHaveAttribute("href", "https://it.wikipedia.org/wiki/Foro_Boario");
  expect(italian).toHaveAttribute("target", "_blank");
  expect(italian).toHaveAttribute("rel", "noopener noreferrer");
  await user.click(screen.getByRole("button", { name: "Other languages" }));
  expect(screen.queryByRole("link", { name: /Foro Boario/ })).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Other languages" })).toHaveAttribute(
    "aria-expanded",
    "false",
  );
});

it("links a sole non-English edition without offering an empty language menu", () => {
  render(
    <WikipediaLinks
      sources={[{ title: "Foro Boario", url: "https://it.wikipedia.org/wiki/Foro_Boario" }]}
    />,
  );
  expect(screen.getByRole("link")).toHaveAttribute(
    "href",
    "https://it.wikipedia.org/wiki/Foro_Boario",
  );
  expect(screen.queryByRole("button")).not.toBeInTheDocument();
});

it("omits external reading controls for legacy content without a resolved URL", () => {
  const { container } = render(<WikipediaLinks />);
  expect(container).toBeEmptyDOMElement();
});
