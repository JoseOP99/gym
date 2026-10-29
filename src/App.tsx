import { check } from "./lib/check";
import { lazy, Suspense, useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import Auth from "./Auth";
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
