import { describe, expect, it } from "vitest";

import { isAdminEmail } from "@/lib/admin-emails";

describe("isAdminEmail", () => {
  const LIST = " Admin@Thapar.edu , second@thapar.edu,,";

  it("matches case-insensitively and ignores spacing and blanks", () => {
    expect(isAdminEmail("admin@thapar.edu", LIST)).toBe(true);
    expect(isAdminEmail("SECOND@thapar.edu", LIST)).toBe(true);
  });

  it("rejects everyone else, and everyone when unset", () => {
    expect(isAdminEmail("student@thapar.edu", LIST)).toBe(false);
    expect(isAdminEmail("", LIST)).toBe(false);
    expect(isAdminEmail(null, LIST)).toBe(false);
    expect(isAdminEmail("admin@thapar.edu", undefined)).toBe(false);
  });
});
