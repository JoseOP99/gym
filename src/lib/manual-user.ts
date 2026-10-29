import { db } from "./supabase";

export function manualPassword(form: FormData) {
  const password = String(form.get("password") || "");
  if (password.length < 12 || password.length > 128) throw new Error("Usa una contraseña de entre 12 y 128 caracteres.");
  if (password !== form.get("confirm_password")) throw new Error("Las contraseñas no coinciden.");
  return password;
}

export async function createManualAccess(invitationId: string, password: string) {
  const { data, error } = await db.functions.invoke("create-manual-user", {
    body: { invitation_id: invitationId, password },
  });
  if (error) {
    let message = "La asignación quedó guardada, pero no se pudo crear la cuenta. Puedes reintentar desde la lista de invitaciones.";
    try { const body = await error.context?.json(); if (body?.message) message = body.message; } catch { /* Safe fallback. */ }
    throw new Error(message);
  }
  return String(data.message);
}

