import { check } from "./lib/check";
import { useEffect, useState } from "react";
import { db } from "./lib/supabase";
import { DataForm, Empty, ErrorMessage, Field } from "./components";
import type { Role, Staff } from "./lib/domain";
import ManualUser from "./ManualUser";
type Invitation = {
  id: string;
  name: string;
  email: string;
  role: Role;
  expires_at: string;
  accepted_at: string | null;
  revoked_at: string | null;
};
const names: Record<Role, string> = {
  owner: "Encargado",
  reception: "Operario",
  inventory: "Operario",
  instructor: "Operario",
};
export default function Team({ gymId }: { gymId: string }) {
  const [staff, setStaff] = useState<Staff[]>([]),
    [invites, setInvites] = useState<Invitation[]>([]),
    [version, setVersion] = useState(0),
    [notice, setNotice] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const refresh = () => setVersion((v) => v + 1);
  const [manualInvite, setManualInvite] = useState<Invitation | undefined>();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    let alive = true;
    Promise.all([
      db.from("staff").select("user_id,name,role,active").eq("gym_id", gymId).order("name"),
      db
        .from("staff_invitations")
        .select("id,name,email,role,expires_at,accepted_at,revoked_at")
        .eq("gym_id", gymId)
        .eq("kind", "staff")
        .order("created_at", { ascending: false })
        .limit(100),
    ])
      .then((results) => {
        results.forEach(check);
        if (alive) {
          setStaff(results[0].data || []);
          setInvites(results[1].data || []);
          setNow(Date.now());
        }
      })
      .catch((e) => {
        if (alive) setError(e.message);
      });
    return () => {
      alive = false;
    };
  }, [gymId, version]);
  async function send(id: string) {
    const { data, error } = await db.functions.invoke("invite-staff", {
      body: { invitation_id: id },
    });
    if (error) {
      let message =
        "Invitación guardada. No se pudo enviar el correo; puedes reintentarlo desde la lista.";
      try {
        const body = await error.context?.json();
        if (body?.message) message = body.message;
      } catch {
        /* Keep safe fallback. */
      }
      throw new Error(message);
    }
    setNotice(data.message);
  }
  async function action(fn: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await fn();
      refresh();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "No se pudo completar la acción",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <ErrorMessage message={error} />
      <ManualUser gymId={gymId} invitation={manualInvite} onCreated={refresh} onCancel={manualInvite ? () => setManualInvite(undefined) : undefined} />
      {notice && (
        <p role="status" className="notice">
          {notice}
        </p>
      )}
      <details className="panel email-invite-panel">
        <summary>Invitar por correo como alternativa</summary>
        <h2>Invita a tu equipo</h2>
        <p className="muted">
          Todos los colaboradores reciben el permiso Operario. Tú conservas la administración completa del gimnasio.
        </p>
        <DataForm
          submit="Crear invitación y enviar correo"
          resetOnSuccess
          onSubmit={async (f) => {
            setNotice("");
            const { data, error } = await db
              .from("staff_invitations")
              .insert({
                gym_id: gymId,
                email: String(f.get("email")).trim().toLowerCase(),
                name: String(f.get("name")).trim(),
                role: "reception",
              })
              .select("id")
              .single();
            if (error?.code === "23505")
              throw new Error(
                "Ya existe una invitación pendiente para este correo. Puedes reenviarla o revocarla en la lista.",
              );
            check({ error });
            refresh();
            await send(data!.id);
          }}
        >
          <div className="form-grid">
            <Field
              label="Nombre"
              name="name"
              required
              minLength={2}
              maxLength={100}
            />
            <Field
              label="Correo electrónico"
              name="email"
              type="email"
              required
              maxLength={254}
            />
            <div className="access-scope"><strong>Permiso: Operario</strong><p>Ingresos, clientes, ventas, productos y máquinas. Sin archivar registros ni administrar accesos o tarifas del gimnasio.</p></div>
          </div>
        </DataForm>
        <p className="small muted">
          Las invitaciones duran 7 días. Los operarios no pueden archivar registros, gestionar el equipo ni consultar las finanzas.
        </p>
      </details>
      <section className="panel">
        <h2>Personal con acceso</h2>
        {staff.length ? (
          <div className="table-wrap">
            <table className="team-table">
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Permiso</th>
                  <th>Acceso</th>
                </tr>
              </thead>
              <tbody>
                {staff.map((s) => (
                  <tr key={s.user_id}>
                    <td data-label="Nombre">{s.name}</td>
                    <td data-label="Permiso">{names[s.role]}</td>
                    <td data-label="Acceso">
                      <button
                        className="secondary"
                        disabled={busy}
                        onClick={() =>
                          action(async () => {
                            check(
                              await db
                                .from("staff")
                                .update({ active: !s.active })
                                .eq("gym_id", gymId)
                                .eq("user_id", s.user_id),
                            );
                          })
                        }
                      >
                        {s.active ? "Desactivar" : "Activar"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty
            title="Tu equipo empieza aquí"
            text="Quienes acepten la invitación aparecerán en esta lista."
          />
        )}
      </section>
      <section className="panel">
        <h2>Invitaciones</h2>
        {invites.length ? (
          <div className="table-wrap">
            <table className="team-table">
              <thead>
                <tr>
                  <th>Persona</th>
                  <th>Permiso</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {invites.map((i) => (
                  <tr key={i.id}>
                    <td data-label="Persona"><div>
                      {i.name}
                      <small>{i.email}</small>
                    </div></td>
                    <td data-label="Permiso">{names[i.role]}</td>
                    <td data-label="Estado">
                      {i.accepted_at
                        ? "Aceptada"
                        : i.revoked_at
                          ? "Revocada"
                          : "Pendiente · vence " + i.expires_at.slice(0, 10)}
                    </td>
                    <td data-label="Acciones">
                      {!i.accepted_at && !i.revoked_at && (
                        <div className="actions">
                          <button className="secondary" disabled={busy || Date.parse(i.expires_at) <= now} onClick={() => { setManualInvite(i); window.scrollTo({ top: 0, behavior: "instant" }); }}>Crear acceso sin correo</button>
                          <button
                            className="secondary"
                            disabled={busy}
                            onClick={() => action(() => send(i.id))}
                          >
                            Reenviar
                          </button>
                          <button
                            className="text-button"
                            disabled={busy}
                            onClick={() =>
                              action(async () => {
                                check(
                                  await db
                                    .from("staff_invitations")
                                    .update({
                                      revoked_at: new Date().toISOString(),
                                    })
                                    .eq("id", i.id)
                                    .eq("gym_id", gymId),
                                );
                              })
                            }
                          >
                            Revocar
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="muted">Todavía no has enviado invitaciones.</p>
        )}
      </section>
    </>
  );
}
