import { useEffect, useRef, useState } from "react";
import {
  Activity,
  ArrowUpRight,
  Building2,
  Clock3,
  Mail,
  Plus,
  ShieldCheck,
} from "lucide-react";
import { db } from "./lib/supabase";
import { check } from "./lib/check";
import { gymAccess } from "./lib/trials";
import type { Gym } from "./lib/domain";
import { DataForm, Empty, ErrorMessage, Field, Footer } from "./components";
import "./Platform.css";
import ManualUser, { PasswordFields } from "./ManualUser";
import { manualPassword, createManualAccess } from "./lib/manual-user";

type ManagerInvitation = {
  id: string;
  gym_id: string;
  name: string;
  email: string;
  accepted_at: string | null;
  revoked_at: string | null;
  expires_at: string;
};
export default function Platform({
  gyms,
  onOpen,
  onRefresh,
  onSignOut,
}: {
  gyms: Gym[];
  onOpen: (id: string) => void;
  onRefresh: () => Promise<void>;
  onSignOut: () => void;
}) {
  const [invites, setInvites] = useState<ManagerInvitation[]>([]);
  const [version, setVersion] = useState(0);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [inviteFor, setInviteFor] = useState("");
  const [manualFor, setManualFor] = useState("");
  const [delivery, setDelivery] = useState("manual");
  const [now, setNow] = useState(() => Date.now());
  const request = useRef({ fingerprint: "", id: "" });
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    let alive = true;
    db.from("staff_invitations")
      .select("id,gym_id,name,email,accepted_at,revoked_at,expires_at")
      .eq("kind", "manager")
      .order("created_at", { ascending: false })
      .limit(1000)
      .then((result) => {
        if (!alive) return;
        if (result.error) setError(result.error.message);
        else setInvites(result.data || []);
      });
    return () => {
      alive = false;
    };
  }, [version]);
  async function refresh() {
    await onRefresh();
    setVersion((v) => v + 1);
  }
  async function send(id: string) {
    const { data, error } = await db.functions.invoke("invite-staff", {
      body: { invitation_id: id },
    });
    if (error) {
      let message =
        "El gimnasio está creado, pero no pudimos enviar la invitación. Puedes reenviarla desde su tarjeta.";
      try {
        const body = await error.context?.json();
        if (body?.message) message = body.message;
      } catch {
        /* Keep fallback without exposing response details. */
      }
      throw new Error(message);
    }
    setNotice(data.message);
  }
  async function action(fn: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await fn();
      await refresh();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "No se pudo completar la operación",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="platform-shell">
      <header className="platform-header">
        <a href="/" className="brand">
          <span className="brand-mark">
            <Activity />
          </span>
          GYM.
        </a>
        <span className="platform-label">
          <ShieldCheck size={17} /> Superadministración
        </span>
        <button className="secondary" onClick={onSignOut}>
          Cerrar sesión
        </button>
      </header>
      <main className="platform-content">
        <div className="page-heading">
          <div>
            <p className="eyebrow">TU PLATAFORMA, TUS GIMNASIOS</p>
            <h1>Un nuevo espacio para cada negocio.</h1>
            <p className="muted">
              Crea una prueba, invita al encargado y acompaña sus primeros siete
              días.
            </p>
          </div>
        </div>
        <ErrorMessage message={error} />
        {notice && (
          <p className="notice" role="status">
            {notice}
          </p>
        )}
        <div className="platform-stats">
          <section>
            <Building2 />
            <strong>{gyms.length}</strong>
            <span>Gimnasios</span>
          </section>
          <section>
            <Clock3 />
            <strong>
              {
                gyms.filter(
                  (g) => g.lifecycle === "trial" && gymAccess(g, now).enabled,
                ).length
              }
            </strong>
            <span>Pruebas vigentes</span>
          </section>
          <section>
            <Mail />
            <strong>
              {gyms.filter((g) => g.lifecycle === "pending").length}
            </strong>
            <span>Esperando al encargado</span>
          </section>
        </div>
        <section className="panel platform-create">
          <div>
            <span className="eyebrow">NUEVO GIMNASIO</span>
            <h2>Invita a su encargado.</h2>
            <p className="muted small">
              La semana gratis empieza cuando acepte la invitación. El encargado
              podrá definir sus tarifas y agregar operarios.
            </p>
          </div>
          <DataForm
            submit={delivery === "manual" ? "Crear gimnasio y usuario manual" : "Crear gimnasio e invitar"}
            resetOnSuccess
            clearPasswords
            onSubmit={async (f) => {
              setError("");
              setNotice("");
              const password = delivery === "manual" ? manualPassword(f) : "";
              const values = {
                gym_name: String(f.get("gym_name")).trim(),
                manager_name: String(f.get("manager_name")).trim(),
                manager_email: String(f.get("manager_email"))
                  .trim()
                  .toLowerCase(),
              };
              const fingerprint = JSON.stringify(values);
              if (request.current.fingerprint !== fingerprint)
                request.current = { fingerprint, id: crypto.randomUUID() };
              const { data, error } = await db.rpc("create_trial_gym", {
                ...values,
                request_id: request.current.id,
              });
              check({ error });
              await refresh();
              if (data?.invitation_id) {
                if (delivery === "manual") setNotice(await createManualAccess(data.invitation_id, password));
                else await send(data.invitation_id);
              }
            }}
          >
            <div className="form-grid">
              <label>Cómo crear el acceso<select value={delivery} onChange={e => setDelivery(e.target.value)}><option value="manual">Usuario manual · sin enviar correo</option><option value="email">Invitación por correo</option></select></label>
              <Field
                name="gym_name"
                label="Nombre del gimnasio"
                minLength={2}
                maxLength={100}
                required
              />
              <Field
                name="manager_name"
                label="Nombre del encargado"
                minLength={2}
                maxLength={100}
                required
              />
              <Field
                name="manager_email"
                label="Correo del encargado"
                type="email"
                maxLength={254}
                required
              />
            </div>
            {delivery === "manual" && <PasswordFields />}
          </DataForm>
        </section>
        {manualFor && <>
          <ManualUser key={manualFor} gymId={manualFor} manager invitation={invites.find(i => i.gym_id === manualFor && !i.accepted_at && !i.revoked_at && Date.parse(i.expires_at) > now)} onCreated={refresh} onCancel={() => setManualFor("")} />
        </>}
        {inviteFor && (
          <section className="panel">
            <h2>
              Invitar un encargado a{" "}
              {gyms.find((g) => g.id === inviteFor)?.name}
            </h2>
            <p className="muted small">
              Al aceptar será el encargado de este gimnasio. La prueba anterior
              no se reinicia.
            </p>
            <DataForm
              key={inviteFor}
              submit="Enviar invitación del encargado"
              resetOnSuccess
              onSubmit={async (f) => {
                const { data, error } = await db.rpc("invite_gym_manager", {
                  g: inviteFor,
                  manager_name: String(f.get("name")).trim(),
                  manager_email: String(f.get("email")).trim().toLowerCase(),
                });
                check({ error });
                await refresh();
                setInviteFor("");
                await send(data);
              }}
            >
              <div className="form-grid">
                <Field
                  label="Nombre"
                  name="name"
                  minLength={2}
                  maxLength={100}
                  required
                />
                <Field
                  label="Correo"
                  name="email"
                  type="email"
                  maxLength={254}
                  required
                />
              </div>
            </DataForm>
            <button className="text-button" onClick={() => setInviteFor("")}>
              Cancelar
            </button>
          </section>
        )}
        <div className="platform-list-heading">
          <h2>Gimnasios y pruebas</h2>
          <button
            className="text-button"
            disabled={busy}
            onClick={() => action(async () => {})}
          >
            Actualizar
          </button>
        </div>
        <div className="platform-grid">
          {gyms.map((g) => {
            const invitation = invites.find(
              (i) => i.gym_id === g.id && !i.revoked_at,
            );
            const access = gymAccess(g, now);
            return (
              <article className="panel gym-card" key={g.id}>
                <div className="gym-card-title">
                  <span className="gym-card-icon">
                    <Building2 />
                  </span>
                  <span
                    className={"pill " + (!access.enabled ? "warning" : "")}
                  >
                    {access.label}
                  </span>
                </div>
                <h2>{g.name}</h2>
                <p className="muted">
                  {invitation?.name || "Espacio administrado por ti"}
                  <small>
                    {invitation?.email || "Puedes asignar un encargado"}
                  </small>
                </p>
                <div className="trial-date">
                  {g.trial_ends_at
                    ? "Fin de prueba: " +
                      new Date(g.trial_ends_at).toLocaleString("es-CO", {
                        timeZone: "America/Bogota",
                        dateStyle: "medium",
                        timeStyle: "short",
                      })
                    : g.lifecycle === "pending"
                      ? "La prueba comienza al aceptar la invitación"
                      : "Sin fecha de vencimiento"}
                </div>
                <button className="gym-open" onClick={() => onOpen(g.id)}>
                  Abrir gimnasio <ArrowUpRight size={18} />
                </button>
                <div className="gym-actions">
                  <button className="text-button" onClick={() => { setManualFor(g.id); setInviteFor(""); window.scrollTo({ top: 0, behavior: "instant" }); }}>Crear usuario manual</button>
                  <button
                    className="text-button"
                    onClick={() => setInviteFor(g.id)}
                  >
                    <Plus size={14} /> Encargado
                  </button>
                  {invitation && !invitation.accepted_at && (
                    <button
                      className="text-button"
                      disabled={busy}
                      onClick={() => action(() => send(invitation.id))}
                    >
                      Reenviar invitación
                    </button>
                  )}
                </div>
                <div className="trial-controls">
                  <button
                    className="secondary"
                    disabled={busy || g.lifecycle === "active"}
                    onClick={() =>
                      action(async () => {
                        check(
                          await db.rpc("set_gym_lifecycle", {
                            g: g.id,
                            action: "activate",
                          }),
                        );
                      })
                    }
                  >
                    Activar
                  </button>
                  <button
                    className="secondary"
                    disabled={busy}
                    onClick={() =>
                      action(async () => {
                        check(
                          await db.rpc("set_gym_lifecycle", {
                            g: g.id,
                            action: "trial7",
                          }),
                        );
                      })
                    }
                  >
                    Dar 7 días
                  </button>
                  <button
                    className="text-button"
                    disabled={busy || g.lifecycle === "suspended"}
                    onClick={() =>
                      action(async () => {
                        check(
                          await db.rpc("set_gym_lifecycle", {
                            g: g.id,
                            action: "suspend",
                          }),
                        );
                      })
                    }
                  >
                    Suspender
                  </button>
                </div>
              </article>
            );
          })}
        </div>
        {!gyms.length && (
          <Empty
            title="Tu primer gimnasio empieza aquí"
            text="Crea el espacio y envía la invitación a quien lo va a administrar."
          />
        )}
      </main>
      <Footer />
    </div>
  );
}
