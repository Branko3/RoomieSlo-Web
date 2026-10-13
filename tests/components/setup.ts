import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// Runs for every test file; only DOM (jsdom) tests have anything to clean up.
if (typeof document !== "undefined") afterEach(cleanup);
