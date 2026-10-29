import { check } from "./lib/check";
import { useCallback, useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { Activity, ShieldCheck } from "lucide-react";
import { db, configured } from "./lib/supabase";
import type { Gym, Role } from "./lib/domain";
import { DataForm, Field, Footer, ErrorMessage } from "./components";
import Dashboard from "./Dashboard";
import Landing from "./Landing";
import "./App.css";
export default function App() {
  const [route, setRoute] = useState(() => window.location.hash);
  const [setup, setSetup] = useState(
    () =>
      new URLSearchParams(window.location.search).get("setup") === "1" ||
      ["invite", "recovery"].includes(
        new URLSearchParams(window.location.hash.slice(1)).get("type") || "",
      ),
  );
  useEffect(() => {
    const change = () => setRoute(window.location.hash);
    window.addEventListener("hashchange", change);
    return () => window.removeEventListener("hashchange", change);
  }, []);
  const [session, setSession] = useState<Session | null>(null),
    [ready, setReady] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    db.auth.getSession().then(({ data, error }) => {
      if (error) setError(error.message);
      setSession(data.session);
      setReady(true);
    });
    const { data } = db.auth.onAuthStateChange((event, value) => {
      setSession(value);
      setReady(true);
      if (event === "PASSWORD_RECOVERY") setSetup(true);
    });
    return () => data.subscription.unsubscribe();
  }, []);
  if (!["#login", "#panel"].includes(route) && !setup)
    return <Landing signedIn={Boolean(session)} />;
  if (!configured)
    return (
      <main className="setup">
        <h1>Configura la conexión</h1>
        <p>Completa .env.local con la URL y la clave pública de Supabase.</p>
      </main>
    );
  if (!ready)
    return (
      <main className="setup" aria-busy="true">
        Preparando tu espacio…
      </main>
    );
  if (session && setup)
    return (
      <main className="setup">
        <h1>Configura tu contraseña</h1>
        <p>Usa al menos 12 caracteres para proteger tu cuenta.</p>
        <DataForm
          submit="Guardar y entrar a mi gimnasio"
          onSubmit={async (f) => {
            if (f.get("password") !== f.get("repeat"))
              throw new Error("Las contraseñas no coinciden");
            check(
              await db.auth.updateUser({ password: String(f.get("password")) }),
            );
            setSetup(false);
            window.history.replaceState(
              null,
              "",
              window.location.pathname + "#panel",
            );
            setRoute("#panel");
          }}
        >
          <Field
            label="Nueva contraseña"
            name="password"
            type="password"
            autoComplete="new-password"
            minLength={12}
            required
          />
          <Field
            label="Repetir contraseña"
            name="repeat"
            type="password"
            autoComplete="new-password"
            minLength={12}
            required
          />
        </DataForm>
      </main>
    );
  return session ? (
    <Workspace key={session.user.id} session={session} />
  ) : (
    <Auth initialError={error} />
  );
}
function Auth({ initialError }: { initialError: string }) {
  const [register, setRegister] = useState(false),
    [notice, setNotice] = useState(""),
    [recover, setRecover] = useState(false),
    [confirm, setConfirm] = useState(false);
  return (
    <div className="auth-layout">
      <section className="auth-story">
        <a className="brand" href="/">
          <span className="brand-mark">
            <Activity />
          </span>
          GYM<span className="brand-dot">.</span>
        </a>
        <div>
          <p className="eyebrow">EL RITMO DE TU NEGOCIO</p>
          <h1>
            Tu gimnasio.
            <br />
            Todo en
            <br />
            <span>movimiento.</span>
          </h1>
          <p className="story-copy">
            Clientes, equipo y ventas en un mismo lugar. Más tiempo para lo que
            te mueve.
          </p>
        </div>
        <div className="story-foot">
          <span className="status-dot" /> Un espacio para cada gimnasio{" "}
          <span>01 / GESTIÓN</span>
        </div>
      </section>
      <main className="auth-main">
        <div className="auth-card">
          <a className="text-button" href="#inicio">
            ← Volver al inicio
          </a>
          <span className="section-number">BIENVENIDO A TU ESPACIO</span>
          <h2>
            {confirm
              ? "Confirma tu cuenta"
              : recover
              ? "Recupera tu acceso"
              : register
                ? "Crea tu cuenta"
                : "Qué bueno verte."}
          </h2>
          <p className="muted">
            {confirm
              ? "Te enviaremos un nuevo enlace para confirmar tu correo."
              : recover
              ? "Te enviaremos un enlace para establecer tu contraseña."
              : register
                ? "Confirma tu correo para crear tu gimnasio o unirte al equipo."
                : "Ingresa con el correo de tu cuenta para continuar."}
          </p>
          <ErrorMessage message={initialError} />
          {notice && (
            <p className="notice" role="status">
              {notice}
            </p>
          )}
          <DataForm
            key={confirm ? "confirm" : recover ? "recover" : register ? "register" : "login"}
            submit={
              confirm ? "Reenviar confirmación" : recover ? "Enviar enlace" : register ? "Crear cuenta" : "Ingresar"
            }
            onSubmit={async (f) => {
              setNotice("");
              const credentials = {
                email: String(f.get("email")).trim(),
                password: String(f.get("password")),
              };
              if (confirm) {
                check(await db.auth.resend({
                  type: "signup",
                  email: credentials.email,
                  options: { emailRedirectTo: window.location.origin + "/#panel" },
                }));
                setNotice("Si tu cuenta está pendiente de confirmación, recibirás un nuevo enlace. Revisa también la carpeta de spam.");
              } else if (recover) {
                check(
                  await db.auth.resetPasswordForEmail(credentials.email, {
                    redirectTo: window.location.origin + "/?setup=1",
                  }),
                );
                setNotice(
                  "Si existe una cuenta con este correo, recibirás un enlace para recuperar el acceso.",
                );
              } else if (register) {
                check(await db.auth.signUp({
                  ...credentials,
                  options: { emailRedirectTo: window.location.origin + "/#panel" },
                }));
                setNotice(
                  "Revisa tu correo para confirmar la cuenta. Si ya existe, ingresa con tu contraseña.",
                );
              } else {
                check(await db.auth.signInWithPassword(credentials));
                window.location.hash = "panel";
              }
            }}
          >
            <Field
              name="email"
              label="Correo electrónico"
              type="email"
              autoComplete="email"
              required
            />
            {!recover && !confirm && (
              <Field
                name="password"
                label="Contraseña"
                type="password"
                autoComplete={register ? "new-password" : "current-password"}
                minLength={register ? 12 : 1}
                required
              />
            )}
          </DataForm>
          <div className="auth-options">
            <button
              className="text-button"
              onClick={() => {
                setRecover(!recover);
                setRegister(false);
                setConfirm(false);
                setNotice("");
              }}
            >
              {recover ? "Volver a ingresar" : "Olvidé mi contraseña"}
            </button>
            <button
              className="text-button"
              onClick={() => {
                setRegister(!register);
                setRecover(false);
                setConfirm(false);
                setNotice("");
              }}
            >
              {register ? "Ya tengo cuenta" : "Crear cuenta"}
            </button>
          </div>
          <button className="text-button" onClick={() => {
            setConfirm(!confirm);
            setRegister(false);
            setRecover(false);
            setNotice("");
          }}>{confirm ? "Volver al login" : "Reenviar correo de confirmación"}</button>
          <p className="auth-note">
            <ShieldCheck size={16} /> Acceso para propietarios y colaboradores.
          </p>
        </div>
        <Footer />
      </main>
    </div>
  );
}
function Workspace({ session }: { session: Session }) {
  const [gyms, setGyms] = useState<Gym[]>([]),
    [selected, setSelected] = useState(""),
    [roles, setRoles] = useState<Record<string, Role>>({}),
    [newGym, setNewGym] = useState(false),
    [error, setError] = useState(""),
    [loaded, setLoaded] = useState(false);
  const load = useCallback(async () => {
    check(await db.rpc("accept_staff_invitations"));
    const results = await Promise.all([
      db.from("gyms").select("*").order("created_at"),
      db
        .from("staff")
        .select("gym_id,role")
        .eq("user_id", session.user.id)
        .eq("active", true),
    ]);
    results.forEach(check);
    setGyms(results[0].data || []);
    setRoles(
      Object.fromEntries(
        (results[1].data || []).map((s) => [s.gym_id, s.role]),
      ),
    );
    setSelected((prev) =>
      (results[0].data || []).some((g) => g.id === prev)
        ? prev
        : results[0].data?.[0]?.id || "",
    );
    setLoaded(true);
  }, [session.user.id]);
  useEffect(() => {
    void Promise.resolve()
      .then(load)
      .catch((e) => {
        setError(e.message);
        setLoaded(true);
      });
  }, [load]);
  const gym = gyms.find((g) => g.id === selected),
    role: Role | undefined =
      gym?.owner_id === session.user.id ? "owner" : roles[selected];
  async function signOut() {
    const result = await db.auth.signOut();
    if (result.error) setError(result.error.message);
  }
  if (!loaded) return <main className="setup">Cargando tus gimnasios…</main>;
  if (!gym || newGym)
    return (
      <main className="onboarding">
        <div className="topline">
          <span className="brand">
            <Activity /> GYM.
          </span>
          <button className="secondary" onClick={signOut}>
            Cerrar sesión
          </button>
        </div>
        <div className="onboarding-card">
          <span className="eyebrow">TU PRÓXIMO COMIENZO</span>
          <h1>
            {newGym ? "Un nuevo gimnasio." : "Dale espacio a tu gimnasio."}
          </h1>
          <p className="muted">
            Crea el espacio de tu negocio. Si eres colaborador, pide al
            propietario que agregue tu correo al equipo y luego actualiza.
          </p>
          <ErrorMessage message={error} />
          <DataForm
            submit="Crear gimnasio"
            onSubmit={async (f) => {
              const result = await db
                .from("gyms")
                .insert({
                  name: String(f.get("name")).trim(),
                  owner_id: session.user.id,
                })
                .select()
                .single();
              check(result);
              await load();
              setSelected(result.data.id);
              setNewGym(false);
            }}
          >
            <Field
              name="name"
              label="Nombre del gimnasio"
              minLength={2}
              maxLength={100}
              required
            />
          </DataForm>
          <div className="actions">
            <button
              className="secondary"
              onClick={() => load().catch((e) => setError(e.message))}
            >
              Actualizar acceso
            </button>
            {newGym && (
              <button className="text-button" onClick={() => setNewGym(false)}>
                Volver
              </button>
            )}
          </div>
        </div>
        <Footer />
      </main>
    );
  if (!role)
    return (
      <main className="setup">
        <h1>Sin acceso activo</h1>
        <button onClick={signOut}>Cerrar sesión</button>
      </main>
    );
  return (
    <Dashboard
      key={gym.id}
      gym={gym}
      gyms={gyms}
      role={role}
      session={session}
      onSelect={setSelected}
      onNew={() => setNewGym(true)}
      onSignOut={signOut}
      onRefresh={load}
    />
  );
}
