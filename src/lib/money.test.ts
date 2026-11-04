import test from "node:test";
import assert from "node:assert/strict";
import { amountFromCents, calculateTaxLine, cents, financialYear } from "./money.ts";

test("money rounds currency values to paise", () => { assert.equal(cents(10.105), 1011); assert.equal(amountFromCents(1011), "10.11"); });
test("GST calculation rounds per invoice line", () => { assert.deepEqual(calculateTaxLine(2.5, 10, 5), { subtotalCents: 2500, taxCents: 125, totalCents: 2625 }); });
test("invalid quantities and tax rates are rejected", () => { assert.throws(() => calculateTaxLine(0, 10, 5)); assert.throws(() => calculateTaxLine(1, 10, 101)); });
test("Indian financial years roll over in April", () => { assert.equal(financialYear("2026-03-31"), "2025-26"); assert.equal(financialYear("2026-04-01"), "2026-27"); });
