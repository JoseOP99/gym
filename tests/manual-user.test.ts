import { strict as assert } from "node:assert";
import { test } from "node:test";
import { manualUserHandler } from "../supabase/functions/create-manual-user/handler.ts";
import type { Dependencies } from "../supabase/functions/create-manual-user/handler.ts";

const invitationId = "11111111-1111-4111-8111-111111111111";
function fixture() {
  const context = {
    platform: false,
    gym: { owner_id: "owner", lifecycle: "active", trial_ends_at: null as string | null },
    invitation: {
      id: invitationId, gym_id: "gym", email: "person@example.test", kind: "staff", role: "reception",
      accepted_at: null as string | null, revoked_at: null as string | null,
      expires_at: new Date(Date.now() + 86400000).toISOString(),
    },
  };
  let calls = 0;
  const deps: Dependencies = {
    authenticate: async () => ({ id: "owner" }),
    context: async () => context,
    createAccount: async (email, _password, invite) => {
      calls++;
      assert.equal(email, context.invitation.email);
      assert.equal(invite.id, invitationId);
      return { ok: true };
    },
  };
  const request = (body = { invitation_id: invitationId, password: "Example-password-123!" }, token = "session") => new Request("https://example.test", {
    method: "POST", headers: { authorization: token ? `Bearer ${token}` : "", origin: "https://gymtuchin.vercel.app" }, body: JSON.stringify(body),
  });
  return { context, deps, request, calls: () => calls };
}

test("creación manual usa el correo y la asignación de la base, no datos de privilegio del navegador", async () => {
  const f = fixture();
  const response = await manualUserHandler(f.deps)(new Request("https://example.test", {
    method: "POST", headers: { authorization: "Bearer session" },
    body: JSON.stringify({ invitation_id: invitationId, password: "Example-password-123!", email: "other@example.test", role: "owner", platform: true }),
  }));
  assert.equal(response.status, 201);
  assert.equal(f.calls(), 1);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.ok(!(await response.text()).includes("Example-password"));
});

test("sin sesión, RLS denegada u otro propietario nunca se crea una cuenta", async () => {
  for (const mode of ["missing", "invalid", "rls", "other-owner"]) {
    const f = fixture();
    if (mode === "invalid") f.deps.authenticate = async () => null;
    if (mode === "rls") f.deps.context = async () => null;
    if (mode === "other-owner") f.context.gym.owner_id = "someone-else";
    const response = await manualUserHandler(f.deps)(f.request(undefined, mode === "missing" ? "" : "session"));
    assert.ok([401, 403, 404].includes(response.status)); assert.equal(f.calls(), 0);
  }
});

test("solo la plataforma crea encargados; nunca se permiten roles globales", async () => {
  const f = fixture(); f.context.invitation.kind = "manager";
  assert.equal((await manualUserHandler(f.deps)(f.request())).status, 403);
  assert.equal(f.calls(), 0);
  f.context.platform = true;
  assert.equal((await manualUserHandler(f.deps)(f.request())).status, 201);
  f.context.invitation.kind = "staff"; f.context.invitation.role = "owner";
  assert.equal((await manualUserHandler(f.deps)(f.request())).status, 400);
  assert.equal(f.calls(), 1);
});

test("pruebas vencidas, suspensión y asignaciones no vigentes bloquean cuentas manuales", async () => {
  for (const mode of ["suspended", "expired-trial", "pending", "revoked", "accepted", "expired-invite", "invalid-expiry"]) {
    const f = fixture();
    if (mode === "suspended" || mode === "pending") f.context.gym.lifecycle = mode;
    if (mode === "expired-trial") { f.context.gym.lifecycle = "trial"; f.context.gym.trial_ends_at = new Date(Date.now() - 1000).toISOString(); }
    if (mode === "revoked") f.context.invitation.revoked_at = new Date().toISOString();
    if (mode === "accepted") f.context.invitation.accepted_at = new Date().toISOString();
    if (mode === "expired-invite") f.context.invitation.expires_at = new Date(Date.now() - 1000).toISOString();
    if (mode === "invalid-expiry") f.context.invitation.expires_at = "invalid";
    assert.ok([403, 409].includes((await manualUserHandler(f.deps)(f.request())).status), mode);
    assert.equal(f.calls(), 0, mode);
  }
});

test("validación de contraseña, JSON y UUID ocurre antes de crear usuarios", async () => {
  for (const body of [null, { invitation_id: "invalid", password: "Example-password-123!" }, { invitation_id: invitationId, password: "short" }, { invitation_id: invitationId, password: "a".repeat(129) }]) {
    const f = fixture();
    const response = await manualUserHandler(f.deps)(new Request("https://example.test", { method: "POST", headers: { authorization: "Bearer session" }, body: JSON.stringify(body) }));
    assert.equal(response.status, 400); assert.equal(f.calls(), 0);
  }
});

test("cuenta existente conserva contraseña y errores internos no se exponen", async () => {
  const f = fixture();
  f.deps.createAccount = async () => ({ ok: false, code: "email_exists" });
  const response = await manualUserHandler(f.deps)(f.request());
  assert.equal(response.status, 409);
  assert.match((await response.json()).message, /No se cambió su contraseña/);
  f.deps.context = async () => { throw new Error("internal-sensitive-detail"); };
  const failed = await manualUserHandler(f.deps)(f.request());
  assert.equal(failed.status, 503); assert.ok(!(await failed.text()).includes("internal-sensitive"));
});
