import { strict as assert } from "node:assert";
import { test } from "node:test";
import { readAuthCallback } from "../src/lib/auth-callback.ts";

test("conserva recuperación antes de que Supabase borre el fragmento", () => {
  const initial = readAuthCallback(
    "https://gymtuchin.vercel.app/#access_token=fake&refresh_token=fake&type=recovery",
  );
  const cleaned = readAuthCallback("https://gymtuchin.vercel.app/");
  assert.equal(initial.setup, true);
  assert.equal(initial.hasAuthResponse, true);
  assert.equal(cleaned.setup, false);
  assert.equal("access_token" in initial, false);
  assert.equal(JSON.stringify(initial).includes("fake"), false);
});

test("reconoce destino explícito, enlaces anteriores e invitaciones", () => {
  for (const suffix of [
    "/?auth=recovery",
    "/?setup=1",
    "/#type=invite&access_token=fake",
  ]) {
    assert.equal(
      readAuthCallback("https://gymtuchin.vercel.app" + suffix).setup,
      true,
    );
  }
  assert.equal(
    readAuthCallback("https://gymtuchin.vercel.app/#login").setup,
    false,
  );
});

test("un enlace vencido devuelve un error visible sin exponer su contenido", () => {
  const result = readAuthCallback(
    "https://gymtuchin.vercel.app/#error=access_denied&error_code=otp_expired&error_description=private-data",
  );
  assert.match(result.error, /Solicita un correo nuevo/);
  assert.equal(result.error.includes("private-data"), false);
});
