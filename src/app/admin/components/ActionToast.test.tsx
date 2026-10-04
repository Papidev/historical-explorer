// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ActionToast, getActionError } from "./ActionToast";

afterEach(cleanup);

describe("Action toast", () => {
  it("shows a waiting notice when no English or Italian Wikipedia source can be resolved", () => {
    render(
      <ActionToast
        toast={getActionError(
          new Error(
            "source-not-found: No unambiguous English or Italian Wikipedia page was found for POI example",
          ),
        )}
        onDismiss={() => {}}
      />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent("Story waiting for a source");
    expect(screen.getByRole("alert")).toHaveTextContent(
      "No unambiguous English or Italian Wikipedia page",
    );
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

it("dismisses a success toast automatically after six seconds", () => {
  vi.useFakeTimers();
  try {
    const view = render(
      <ActionToast
        toast={{ tone: "success", title: "Changes saved", description: "Category saved." }}
        onDismiss={() => view.unmount()}
      />,
    );
    expect(screen.getByRole("status")).toHaveTextContent("Category saved.");
    expect(screen.getByRole("button", { name: "Dismiss notification" })).toBeVisible();
    act(() => vi.advanceTimersByTime(5999));
    expect(screen.getByRole("status")).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(1));
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  } finally {
    vi.useRealTimers();
  }
});
