import { describe, expect, it } from "vitest";
import { centsFromDollars, dollarsFromCents, formatCents } from "./money";

describe("money", () => {
  it("converts dollars to cents, rounding to the nearest cent", () => {
    expect(centsFromDollars(16)).toBe(1600);
    expect(centsFromDollars(9.999)).toBe(1000);
    expect(centsFromDollars(0.1 + 0.2)).toBe(30); // classic float-drift case
  });

  it("converts cents back to dollars", () => {
    expect(dollarsFromCents(1600)).toBe(16);
    expect(dollarsFromCents(1050)).toBe(10.5);
  });

  it("formats cents as USD currency", () => {
    expect(formatCents(1600)).toBe("$16.00");
    expect(formatCents(105)).toBe("$1.05");
  });
});
