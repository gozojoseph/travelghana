import { afterEach, describe, expect, it } from "vitest";

import { adminAppUrls, webAppUrls } from "./app-urls";

// Process.env is process-global in vitest; snapshot and restore the two keys
// these helpers read so other spec files are unaffected.
const ORIGINAL_WEB = process.env.WEB_APP_URL;
const ORIGINAL_ADMIN = process.env.ADMIN_APP_URL;

afterEach(() => {
  if (ORIGINAL_WEB === undefined) delete process.env.WEB_APP_URL;
  else process.env.WEB_APP_URL = ORIGINAL_WEB;
  if (ORIGINAL_ADMIN === undefined) delete process.env.ADMIN_APP_URL;
  else process.env.ADMIN_APP_URL = ORIGINAL_ADMIN;
});

describe("webAppUrls", () => {
  it("falls back to the single dev origin", () => {
    delete process.env.WEB_APP_URL;
    expect(webAppUrls()).toEqual(["http://localhost:3000"]);
  });

  it("parses comma-separated origins and trims trailing slashes", () => {
    process.env.WEB_APP_URL = "https://travelghana.com, http://10.44.196.95:3000/";
    expect(webAppUrls()).toEqual(["https://travelghana.com", "http://10.44.196.95:3000"]);
  });

  it("drops empty entries between commas", () => {
    process.env.WEB_APP_URL = "https://travelghana.com,,";
    expect(webAppUrls()).toEqual(["https://travelghana.com"]);
  });
});

describe("adminAppUrls", () => {
  it("falls back to the standalone local console origin (dev:admin)", () => {
    delete process.env.ADMIN_APP_URL;
    expect(adminAppUrls()).toEqual(["http://localhost:3001"]);
  });

  it("parses comma-separated origins (dev console + prod admin subdomain)", () => {
    process.env.ADMIN_APP_URL = "https://admin.travelghana.com,http://localhost:3001";
    expect(adminAppUrls()).toEqual([
      "https://admin.travelghana.com",
      "http://localhost:3001",
    ]);
  });
});
