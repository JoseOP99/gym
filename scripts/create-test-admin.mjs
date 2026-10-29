import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
const file = ".admin-access.local";
const previous = existsSync(file)
  ? JSON.parse(readFileSync(file, "utf8"))
  : null;
if (previous && previous.status !== "failed")
  throw new Error("La solicitud anterior debe verificarse antes de repetir.");
const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => {
      const i = line.indexOf("=");
      return [line.slice(0, i), line.slice(i + 1)];
    }),
);
if (env.VITE_SUPABASE_URL !== "https://cjmffrhnlsypasnijuhm.supabase.co")
  throw new Error("Destino inesperado");
const email = process.argv[2];
if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
  throw new Error("Indica un correo válido");
if (previous && previous.email !== email)
  throw new Error("El correo debe coincidir con el intento anterior");
const password =
  previous?.password || randomBytes(24).toString("base64url") + "aA1!";
const db = createClient(
  env.VITE_SUPABASE_URL,
  env.VITE_SUPABASE_PUBLISHABLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } },
);
// Save before the request so a network interruption cannot lose generated credentials.
writeFileSync(
  file,
  JSON.stringify({ email, password, status: "request_pending" }, null, 2),
  { mode: 0o600 },
);
const { data, error } = await db.auth.signUp({
  email,
  password,
  options: { emailRedirectTo: "http://127.0.0.1:5173/#panel" },
});
if (error) {
  writeFileSync(
    file,
    JSON.stringify(
      { email, password, status: "failed", error: error.message },
      null,
      2,
    ),
    { mode: 0o600 },
  );
  throw new Error(error.message);
}
writeFileSync(
  file,
  JSON.stringify(
    {
      email,
      password,
      user_id: data.user?.id,
      status: data.session ? "active" : "confirmation_required",
    },
    null,
    2,
  ),
  { mode: 0o600 },
);
console.log(
  JSON.stringify({
    user_id: data.user?.id,
    confirmation_required: !data.session,
    credential_file: file,
  }),
);
