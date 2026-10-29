import { check } from "./lib/check";
import { useEffect, useState } from "react";
import { db } from "./lib/supabase";
import { DataForm, Empty, ErrorMessage, Field } from "./components";
import { money } from "./lib/domain";
import type { Role, Staff } from "./lib/domain";
type Invitation = {
  id: string;
  name: string;
  email: string;
  role: Role;
  rate: number;
  expires_at: string;
  accepted_at: string | null;
  revoked_at: string | null;
};
const names: Record<Role, string> = {
  owner: "Propietario",
  reception: "Recepción",
  inventory: "Inventario",
  instructor: "Instructor",
};
export default function Team({ gymId }: { gymId: string }) {
  const [staff, setStaff] = useState<Staff[]>([]),
    [invites, setInvites] = useState<Invitation[]>([]),
    [version, setVersion] = useState(0),
    [notice, setNotice] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const refresh = () => setVersion((v) => v + 1);
  useEffect(() => {
    let alive = true;
    Promise.all([
      db.from("staff").select("*").eq("gym_id", gymId).order("name"),
      db
        .from("staff_invitations")
        .select("*")
        .eq("gym_id", gymId)
        .order("created_at", { ascending: false })
        .limit(100),
    ])
      .then((results) => {
        results.forEach(check);
        if (alive) {
          setStaff(results[0].data || []);
          setInvites(results[1].data || []);
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
      {notice && (
        <p role="status" className="notice">
          {notice}
        </p>
      )}
      <section className="panel">
        <h2>Invita a tu equipo</h2>
        <p className="muted">
          Elige qué puede hacer cada persona. Tú, como propietario, tienes
          acceso a todos los módulos de este gimnasio.
        </p>
        <DataForm
          submit="Crear invitación y enviar correo"
          onSubmit={async (f) => {
            setNotice("");
            const { data, error } = await db
              .from("staff_invitations")
              .insert({
                gym_id: gymId,
                email: String(f.get("email")).trim().toLowerCase(),
                name: String(f.get("name")).trim(),
                role: f.get("role"),
                rate: Math.round(Number(f.get("rate")) * 100),
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
            <label>
              Permiso
              <select name="role">
                <option value="inventory">
                  Inventario · productos y máquinas
                </option>
                <option value="reception">Recepción · clientes y ventas</option>
                <option value="instructor">
                  Instructor · consulta de clientes
                </option>
              </select>
            </label>
            <Field
              label="Tarifa por hora (COP)"
              name="rate"
              type="number"
              min={0}
              max={100000000}
              step="0.01"
              defaultValue={0}
              required
            />
          </div>
        </DataForm>
        <p className="small muted">
          Las invitaciones duran 7 días. El personal de inventario no puede
          borrar registros ni ver ventas o finanzas.
        </p>
      </section>
      <section className="panel">
        <h2>Personal con acceso</h2>
        {staff.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Permiso</th>
                  <th>Tarifa / hora</th>
                  <th>Acceso</th>
                </tr>
              </thead>
              <tbody>
                {staff.map((s) => (
                  <tr key={s.user_id}>
                    <td>{s.name}</td>
                    <td>{names[s.role]}</td>
                    <td>{money(s.rate)}</td>
                    <td>
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
            <table>
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
                    <td>
                      {i.name}
                      <small>{i.email}</small>
                    </td>
                    <td>{names[i.role]}</td>
                    <td>
                      {i.accepted_at
                        ? "Aceptada"
                        : i.revoked_at
                          ? "Revocada"
                          : "Pendiente · vence " + i.expires_at.slice(0, 10)}
                    </td>
                    <td>
                      {!i.accepted_at && !i.revoked_at && (
                        <div className="actions">
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
