import { cleanup } from "@testing-library/svelte";
import "@testing-library/svelte/vitest";
import { afterEach } from "vitest";

afterEach(() => {
  cleanup();
});
