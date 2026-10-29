import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  total,
  csvCell,
  membershipState,
  salesCsv,
} from "../src/lib/domain.ts";
test("POS usa centavos exactos y rechaza cantidades inválidas", () => {
  assert.equal(
    total([
      { quantity: 2, unit_price: 300000 },
      { quantity: 1, unit_price: 1500000 },
    ]),
    2100000,
  );
  assert.throws(() => total([{ quantity: -1, unit_price: 100 }]));
  assert.throws(() => total([{ quantity: 1, unit_price: 0.1 }]));
  assert.throws(() =>
    total([{ quantity: 1000, unit_price: Number.MAX_SAFE_INTEGER }]),
  );
});
test("CSV escapa comillas, saltos y fórmulas de Excel", () => {
  assert.equal(csvCell('=HYPERLINK("x")'), '"\'=HYPERLINK(""x"")"');
  assert.equal(csvCell("Cliente; uno"), '"Cliente; uno"');
  assert.equal(csvCell("  +SUM(1)"), '"\'  +SUM(1)"');
  assert.ok(salesCsv([]).startsWith("\uFEFF"));
});
test("Membresías vencen al comenzar su fecha de vencimiento local", () => {
  assert.equal(membershipState(undefined, "2026-10-28"), "Sin membresía");
  assert.equal(membershipState("2026-10-28", "2026-10-28"), "Vencida");
  assert.equal(membershipState("2026-10-31", "2026-10-28"), "Por vencer");
  assert.equal(membershipState("2026-11-01", "2026-10-28"), "Activa");
});
