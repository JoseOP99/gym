import { useState } from "react";
import { db } from "./lib/supabase";
import { check } from "./lib/check";
import { manualPassword, createManualAccess } from "./lib/manual-user";
import { DataForm, Field } from "./components";

export function PasswordFields() {
  return <>
    <Field name="password" label="Contraseña inicial" type="password" autoComplete="new-password" minLength={12} maxLength={128} required />
    <Field name="confirm_password" label="Repetir contraseña inicial" type="password" autoComplete="new-password" minLength={12} maxLength={128} required />
    <p className="form-help">Mínimo 12 caracteres. Comparte las credenciales de forma privada; no se enviará correo. La contraseña se limpia al terminar el intento.</p>
  </>;
}

export default function ManualUser({ gymId, manager = false, invitation, onCreated, onCancel }: {
  gymId: string; manager?: boolean;
  invitation?: { id: string; name: string; email: string };
  onCreated: () => Promise<void> | void;
  onCancel?: () => void;
}) {
  const [notice, setNotice] = useState("");
  return <section className="panel manual-user-panel">
    <h2>{manager ? "Crear encargado sin correo" : "Crear usuario manual"}</h2>
    <p className="muted">Define las credenciales de una cuenta nueva. La persona entra con su correo y contraseña desde Ingresar. Las cuentas existentes conservan su contraseña.</p>
    {manager && <p className="small muted">Al entrar aceptará el gimnasio. Una prueba nueva empieza entonces y dura siete días; reemplazar al encargado no reinicia una prueba anterior.</p>}
    {notice && <p className="notice" role="status">{notice}</p>}
    <DataForm key={invitation?.id || gymId} submit="Crear usuario sin enviar correo" clearPasswords
      resetOnSuccess={!invitation}
      secondaryAction={onCancel && <button type="button" className="secondary" onClick={onCancel}>{manager ? "Cerrar creación manual" : "Cancelar selección de invitación"}</button>}
      onSubmit={async form => {
      setNotice("");
      const password = manualPassword(form);
      let id = invitation?.id;
      if (!id) {
        const name = String(form.get("name")).trim();
        const email = String(form.get("email")).trim().toLowerCase();
        if (manager) {
          const result = await db.rpc("invite_gym_manager", { g: gymId, manager_name: name, manager_email: email });
          check(result); id = result.data;
        } else {
          const result = await db.from("staff_invitations").insert({
            gym_id: gymId, name, email, role: "reception",
          }).select("id").single();
          if (result.error?.code === "23505") throw new Error("Ya hay una invitación pendiente para este correo. Usa Crear acceso sin correo en esa invitación.");
          check(result); id = result.data!.id;
        }
      }
      // Refresh even when Auth fails so the saved assignment remains recoverable.
      try { setNotice(await createManualAccess(id!, password)); }
      finally { await onCreated(); }
    }}>
      <div className="form-grid">
        <Field label="Nombre de la persona" name="name" minLength={2} maxLength={100} defaultValue={invitation?.name} readOnly={Boolean(invitation)} required />
        <Field label="Correo para iniciar sesión" name="email" type="email" maxLength={254} defaultValue={invitation?.email} readOnly={Boolean(invitation)} required />
        {!manager && <div className="access-scope"><strong>Permiso: Operario</strong><p>Ingresos, clientes, ventas, productos y máquinas. Sin archivar registros ni administrar accesos o tarifas del gimnasio.</p></div>}
        <PasswordFields />
      </div>
    </DataForm>
    <p className="panel-footnote">El acceso queda pendiente hasta su primer inicio de sesión, dentro de los 7 días de la asignación. Esta cuenta manual solo acepta esta asignación.</p>
  </section>;
}
