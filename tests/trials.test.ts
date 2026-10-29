import { strict as assert } from "node:assert";
import { test } from "node:test";
import { gymAccess } from "../src/lib/trials.ts";
const end = "2026-11-05T15:00:00Z";
test("una prueba se bloquea exactamente al vencer y conserva acceso antes", () => {
  const gym = { lifecycle: "trial", trial_ends_at: end };
  assert.equal(gymAccess(gym, Date.parse(end) - 1).enabled, true);
  assert.equal(gymAccess(gym, Date.parse(end)).enabled, false);
  assert.equal(gymAccess(gym, Date.parse(end) + 1).enabled, false);
});
test("pendiente, suspendido y fechas inválidas deniegan el acceso", () => {
  for (const lifecycle of ["pending", "suspended", "unknown"]) {
    assert.equal(
      gymAccess({ lifecycle, trial_ends_at: end }, 0).enabled,
      false,
    );
  }
  assert.equal(
    gymAccess({ lifecycle: "trial", trial_ends_at: null }, 0).enabled,
    false,
  );
  assert.equal(
    gymAccess({ lifecycle: "trial", trial_ends_at: "bad" }, 0).enabled,
    false,
  );
});
test("solo el indicador de superadministración permite gestionar un espacio vencido", () => {
  const gym = { lifecycle: "suspended", trial_ends_at: end };
  assert.equal(gymAccess(gym, Date.now(), false).enabled, false);
  assert.equal(gymAccess(gym, Date.now(), true).enabled, true);
  assert.equal(
    gymAccess({ lifecycle: "active", trial_ends_at: null }, Date.now()).enabled,
    true,
  );
});
