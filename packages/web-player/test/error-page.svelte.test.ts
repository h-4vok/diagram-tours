import { render, screen } from "@testing-library/svelte";
import { describe, expect, it, vi } from "vitest";

const { pageState } = vi.hoisted(() => ({
  pageState: {
    error: {
      message: 'Unknown tour slug "examples/tuvieja".'
    },
    status: 404
  }
}));

vi.mock("$app/state", () => ({
  page: pageState
}));

import ErrorPage from "../src/routes/+error.svelte";
import { resolvedTourCollection } from "./fixtures/tour-collection";

describe("+error.svelte", () => {
  it("renders a guided 404 with a single recovery action for unknown tours", async () => {
    render(ErrorPage, {
      data: {
        collection: resolvedTourCollection
      }
    });

    expect(await screen.findByRole("heading", { name: "Tour not found" })).toBeDefined();
    expect(screen.getByText('Unknown tour slug "examples/tuvieja".')).toBeDefined();
    expect(screen.getByRole("link", { name: "Back to Tours" }).getAttribute("href")).toBe(
      "/payment-flow"
    );
    expect(screen.getAllByRole("link")).toHaveLength(1);
  });
});
