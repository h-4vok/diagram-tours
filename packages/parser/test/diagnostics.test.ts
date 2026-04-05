import { afterEach, describe, expect, it } from "vitest";

import {
  createTourDiagnostic,
  formatTourDiagnostic,
  formatTourDiagnostics
} from "../src/diagnostics.js";
import { restoreParserTestState } from "./parser-test-support.js";

afterEach(restoreParserTestState);

describe("@diagram-tour/parser diagnostics", () => {
  it("creates structured diagnostics from direct error metadata", () => {
    const error = Object.assign(new Error('Tour "broken.tour.yaml": step 1 focus broke "ghost"'), {
      code: "E_PARSE",
      location: { column: 4, line: 2 }
    });

    expect(createTourDiagnostic(error)).toEqual({
      code: "E_PARSE",
      location: { column: 4, line: 2 },
      message: 'step 1 focus broke "ghost"'
    });
    expect(
      formatTourDiagnostic("broken.tour.yaml", {
        code: "E_PARSE",
        location: { column: 4, line: 2 },
        message: "step 1 focus broke"
      })
    ).toBe("broken.tour.yaml:2:4 step 1 focus broke");
  });

  it("falls back to quoted codes and linePos locations", () => {
    const error = Object.assign(new Error('Tour "broken.tour.yaml": step 1 focus broke "ghost"'), {
      linePos: [{ col: 4, line: 2 }]
    });

    expect(createTourDiagnostic(error)).toEqual({
      code: "ghost",
      location: { column: 4, line: 2 },
      message: 'step 1 focus broke "ghost"'
    });
    expect(
      formatTourDiagnostic("broken.tour.yaml", {
        code: "ghost",
        location: null,
        message: "step 1 focus broke"
      })
    ).toBe("broken.tour.yaml step 1 focus broke");
  });

  it("treats an explicit null location as missing", () => {
    const error = Object.assign(new Error('Tour "broken.tour.yaml": step 1 focus broke'), {
      location: null
    });

    expect(createTourDiagnostic(error)).toEqual({
      code: null,
      location: null,
      message: "step 1 focus broke"
    });
  });

  it("ignores malformed line positions", () => {
    const error = Object.assign(new Error('Tour "broken.tour.yaml": step 1 focus broke'), {
      linePos: [undefined]
    });

    expect(createTourDiagnostic(error)).toEqual({
      code: null,
      location: null,
      message: "step 1 focus broke"
    });
  });

  it("ignores empty line position arrays", () => {
    const error = Object.assign(new Error('Tour "broken.tour.yaml": step 1 focus broke'), {
      linePos: []
    });

    expect(createTourDiagnostic(error)).toEqual({
      code: null,
      location: null,
      message: "step 1 focus broke"
    });
  });

  it("ignores null line positions", () => {
    const error = Object.assign(new Error('Tour "broken.tour.yaml": step 1 focus broke'), {
      linePos: [null]
    });

    expect(createTourDiagnostic(error)).toEqual({
      code: null,
      location: null,
      message: "step 1 focus broke"
    });
  });

  it("falls back to a generic diagnostic for non-errors", () => {
    expect(createTourDiagnostic("bad")).toEqual({
      code: null,
      location: null,
      message: "failed unexpectedly"
    });
  });

  it("formats direct diagnostic arrays and ignores empty diagnostic arrays", () => {
    const diagnostics = [
      {
        code: "E_ONE",
        location: { column: 4, line: 2 },
        message: "step 1 focus broke"
      },
      {
        code: null,
        location: null,
        message: "step 1 text broke"
      }
    ];
    const directError = Object.assign(new Error('Tour "broken.tour.yaml": broken'), {
      diagnostics
    });
    const emptyDiagnosticsError = Object.assign(new Error('Tour "broken.tour.yaml": step 1 focus broke'), {
      diagnostics: []
    });

    expect(createTourDiagnostic(directError)).toEqual(diagnostics[0]);
    expect(formatTourDiagnostics("broken.tour.yaml", diagnostics)).toEqual([
      "broken.tour.yaml:2:4 step 1 focus broke",
      "broken.tour.yaml step 1 text broke"
    ]);
    expect(createTourDiagnostic(emptyDiagnosticsError)).toEqual({
      code: null,
      location: null,
      message: "step 1 focus broke"
    });
  });

  it("treats blank diagnostic codes as missing", () => {
    const error = Object.assign(new Error('Tour "broken.tour.yaml": step 1 focus broke'), {
      code: "   "
    });

    expect(createTourDiagnostic(error)).toEqual({
      code: null,
      location: null,
      message: "step 1 focus broke"
    });
  });
});
