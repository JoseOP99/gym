import { check } from "./lib/check";
import { lazy, Suspense, useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { Activity, ShieldCheck } from "lucide-react";
import { db, configured, initialAuthCallback } from "./lib/supabase";
import { DataForm, Field, Footer, ErrorMessage } from "./components";
import Landing from "./Landing";
import "./App.css";
const Workspace = lazy(() => import("./Workspace"));
export default function App() {
  const [route, setRoute] = useState(() =>
    initialAuthCallback.hasAuthResponse ? "#panel" : window.location.hash,
  );
  const [setup, setSetup] = useState(initialAuthCallback.setup);
  const [callbackError, setCallbackError] = useState(initialAuthCallback.error);
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
  if (callbackError)
    return (
      <main className="setup">
        <h1>No pudimos abrir este enlace</h1>
        <ErrorMessage message={callbackError} />
        <button
          onClick={() => {
            setCallbackError("");
            setSetup(false);
            window.history.replaceState(
              null,
              "",
              window.location.pathname + "#login",
            );
            setRoute("#login");
          }}
        >
          Volver al acceso para pedir otro correo
        </button>
        <Footer />
      </main>
    );
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
  if (setup && !session)
    return (
      <main className="setup">
        <h1>Abre el enlace de recuperación</h1>
        <p>
          Para crear una contraseña necesitas abrir el enlace más reciente que
          enviamos a tu correo. Puede haber vencido o haberse usado ya.
        </p>
        <button
          onClick={() => {
            setSetup(false);
            window.history.replaceState(
              null,
              "",
              window.location.pathname + "#login",
            );
            setRoute("#login");
          }}
        >
          Volver al acceso
        </button>
        <Footer />
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
    <Suspense
      fallback={
        <main className="setup" aria-busy="true">
          Abriendo tu espacio…
        </main>
      }
    >
      <Workspace key={session.user.id} session={session} />
    </Suspense>
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
                  ? "Confirma tu correo para aceptar la invitación a tu gimnasio."
                  : "Ingresa con el correo de tu cuenta para continuar."}
          </p>
          <ErrorMessage message={initialError} />
          {notice && (
            <p className="notice" role="status">
              {notice}
            </p>
          )}
          <DataForm
            key={
              confirm
                ? "confirm"
                : recover
                  ? "recover"
                  : register
                    ? "register"
                    : "login"
            }
            submit={
              confirm
                ? "Reenviar confirmación"
                : recover
                  ? "Enviar enlace"
                  : register
                    ? "Crear cuenta"
                    : "Ingresar"
            }
            onSubmit={async (f) => {
              setNotice("");
              const credentials = {
                email: String(f.get("email")).trim(),
                password: String(f.get("password")),
              };
              if (confirm) {
                check(
                  await db.auth.resend({
                    type: "signup",
                    email: credentials.email,
                    options: {
                      emailRedirectTo: window.location.origin + "/#panel",
                    },
                  }),
                );
                setNotice(
                  "Si tu cuenta está pendiente de confirmación, recibirás un nuevo enlace. Revisa también la carpeta de spam.",
                );
              } else if (recover) {
                check(
                  await db.auth.resetPasswordForEmail(credentials.email, {
                    redirectTo: window.location.origin + "/?auth=recovery",
                  }),
                );
                setNotice(
                  "Si existe una cuenta con este correo, recibirás un enlace para recuperar el acceso.",
                );
              } else if (register) {
                check(
                  await db.auth.signUp({
                    ...credentials,
                    options: {
                      emailRedirectTo: window.location.origin + "/#panel",
                    },
                  }),
                );
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
          <button
            className="text-button"
            onClick={() => {
              setConfirm(!confirm);
              setRegister(false);
              setRecover(false);
              setNotice("");
            }}
          >
            {confirm ? "Volver al login" : "Reenviar correo de confirmación"}
          </button>
          <p className="auth-note">
            <ShieldCheck size={16} /> Acceso para propietarios y colaboradores.
          </p>
        </div>
        <Footer />
      </main>
    </div>
  );
}
