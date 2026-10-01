// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ActionToast, getActionError } from "./ActionToast";

afterEach(cleanup);

describe("Action toast", () => {
  it("shows a waiting notice when the POI has no linked English Wikipedia source", () => {
    render(
      <ActionToast
        toast={getActionError(
          new Error("source-not-found: No English Wikipedia page is linked to POI example"),
        )}
        onDismiss={() => {}}
      />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent("Story waiting for a source");
    expect(screen.getByRole("alert")).not.toHaveTextContent("source-not-found");
  });

  it("shows the failure category without exposing the technical error", () => {
    const error = new Error(
      "sources-unavailable: Unable to resolve an English Wikipedia page for POI basilica-costantiniana-di-s-agnese",
    );

    render(<ActionToast toast={getActionError(error)} onDismiss={() => {}} />);

    expect(screen.getByRole("alert")).toHaveTextContent("Source acquisition failed");
    expect(screen.getByRole("alert")).not.toHaveTextContent("sources-unavailable");
    expect(screen.getByRole("alert")).not.toHaveTextContent("basilica-costantiniana-di-s-agnese");
  });
});
