import { useEffect, useRef, useState } from "react";
import { Activity, ArrowLeft, ShieldCheck } from "lucide-react";
import { db } from "./lib/supabase";
import { check } from "./lib/check";
import { DataForm, ErrorMessage, Field, Footer } from "./components";

type Mode = "login" | "recover" | "register" | "confirm";
const content: Record<Mode, { title: string; description: string; action: string }> = {
  login: { title: "Entrar al panel", description: "Usa el correo y la contraseña de tu cuenta.", action: "Entrar al panel" },
  recover: { title: "Recuperar contraseña", description: "Escribe tu correo para solicitar un enlace de recuperación.", action: "Enviar enlace de recuperación" },
  register: { title: "Crear tu cuenta", description: "Si te invitaron por correo, regístrate con esa misma dirección y confírmala para acceder.", action: "Crear mi cuenta" },
  confirm: { title: "Confirmar tu correo", description: "Solicita un nuevo enlace si aún no confirmaste tu cuenta.", action: "Reenviar confirmación" },
};
export default function Auth({ initialError }: { initialError: string }) {
  const [mode, setMode] = useState<Mode>("login");
  const [notice, setNotice] = useState("");
  const title = useRef<HTMLHeadingElement>(null);
  useEffect(() => { title.current?.focus(); }, [mode]);
  function changeMode(next: Mode) { setMode(next); setNotice(""); }
  const current = content[mode];
  return <div className="auth-layout">
    <header className="auth-brand-header"><a className="brand" href="#inicio"><span className="brand-mark"><Activity aria-hidden="true" /></span>GYM.</a><span>Gestión de gimnasios</span></header>
    <main className="auth-main">
      <div className="auth-card">
        <a className="auth-home-link" href="#inicio"><ArrowLeft size={18} aria-hidden="true" />Volver al inicio</a>
        <header className="auth-heading"><h1 ref={title} tabIndex={-1}>{current.title}</h1><p>{current.description}</p></header>
        <ErrorMessage message={initialError} />
        {notice && <p className="notice" role="status">{notice}</p>}
        <DataForm key={mode} submit={current.action} clearPasswords showSuccess={false} onSubmit={async form => {
          setNotice("");
          const email = String(form.get("email")).trim();
          const password = String(form.get("password") || "");
          if (mode === "confirm") {
            check(await db.auth.resend({ type: "signup", email, options: { emailRedirectTo: window.location.origin + "/#panel" } }));
            setNotice("Si tu cuenta está pendiente de confirmación, recibirás un nuevo enlace. Revisa también la carpeta de spam.");
          } else if (mode === "recover") {
            check(await db.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin + "/?auth=recovery" }));
            setNotice("Si existe una cuenta con este correo, recibirás un enlace para recuperar el acceso. Revisa también la carpeta de spam.");
          } else if (mode === "register") {
            check(await db.auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin + "/#panel" } }));
            setNotice("Revisa tu correo para confirmar la cuenta. Si ya existe, entra con tu contraseña.");
          } else {
            check(await db.auth.signInWithPassword({ email, password }));
            window.location.hash = "panel";
          }
        }} secondaryAction={mode !== "login" && <button type="button" className="secondary" onClick={() => changeMode("login")}><ArrowLeft size={17} aria-hidden="true" />Volver a entrar</button>}>
          <Field name="email" label="Correo electrónico" type="email" autoComplete="email" required />
          {(mode === "login" || mode === "register") && <Field name="password" label="Contraseña" type="password" autoComplete={mode === "register" ? "new-password" : "current-password"} minLength={mode === "register" ? 12 : 1} aria-describedby={mode === "register" ? "signup-password-help" : undefined} required />}
          {mode === "register" && <p className="form-help" id="signup-password-help">Usa al menos 12 caracteres.</p>}
        </DataForm>
        {mode === "login" && <div className="auth-support">
          <button className="auth-recover-button" onClick={() => changeMode("recover")}>¿Olvidaste tu contraseña?</button>
          <details className="auth-help">
            <summary>¿Es tu primer acceso?</summary>
            <p>Si el encargado creó tu usuario manualmente, usa las credenciales que te compartió.</p>
            <div className="auth-help-actions">
              <button className="secondary" onClick={() => changeMode("register")}>Crear cuenta con invitación</button>
              <button className="text-button" onClick={() => changeMode("confirm")}>Reenviar confirmación de correo</button>
            </div>
          </details>
        </div>}
        <p className="auth-note"><ShieldCheck size={17} aria-hidden="true" />Acceso para encargados y operarios.</p>
      </div>
      <Footer />
    </main>
  </div>;
}
