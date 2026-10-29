export const allowedOrigins = [
  "https://gymtuchin.vercel.app", "http://127.0.0.1:5173",
  "http://localhost:5173", "http://localhost:3000",
];
type Invitation = {
  id: string; gym_id: string; email: string; kind: string; role: string;
  accepted_at: string | null; revoked_at: string | null; expires_at: string;
};
type Context = {
  invitation: Invitation;
  gym: { owner_id: string; lifecycle: string; trial_ends_at: string | null };
  platform: boolean;
};
export type Dependencies = {
  authenticate: (token: string) => Promise<{ id: string } | null>;
  context: (token: string, invitationId: string) => Promise<Context | null>;
  createAccount: (email: string, password: string, invitation: Invitation) => Promise<{ code?: string; ok: boolean }>;
};

export function manualUserHandler(deps: Dependencies) {
  return async (req: Request): Promise<Response> => {
    const origin = req.headers.get("origin");
    const headers = {
      "Content-Type": "application/json", "Cache-Control": "no-store",
      "Access-Control-Allow-Origin": origin && allowedOrigins.includes(origin) ? origin : allowedOrigins[0],
      "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
      "Access-Control-Allow-Methods": "POST, OPTIONS", Vary: "Origin",
    };
    const reply = (status: number, message: string) => new Response(JSON.stringify({ message }), { status, headers });
    if (origin && !allowedOrigins.includes(origin)) return reply(403, "Origen no autorizado");
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers });
    if (req.method !== "POST") return reply(405, "Método no permitido");
    const token = req.headers.get("authorization")?.match(/^Bearer (.+)$/i)?.[1];
    if (!token) return reply(401, "Inicia sesión");
    try {
      const caller = await deps.authenticate(token);
      if (!caller) return reply(401, "Sesión no válida");
      const raw = await req.text();
      if (raw.length > 4096) return reply(400, "Solicitud demasiado grande");
      let body;
      try { body = JSON.parse(raw); } catch { return reply(400, "Solicitud inválida"); }
      if (!body || typeof body.invitation_id !== "string" ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(body.invitation_id))
        return reply(400, "Asignación inválida");
      if (typeof body.password !== "string" || body.password.length < 12 || body.password.length > 128)
        return reply(400, "Usa una contraseña de entre 12 y 128 caracteres");
      // The context is read with the caller's JWT: PostgreSQL RLS is enforced.
      const context = await deps.context(token, body.invitation_id);
      if (!context) return reply(404, "Asignación no disponible o sin permiso");
      const { invitation: invite, gym, platform } = context;
      if (!platform && gym.owner_id !== caller.id) return reply(403, "Solo el encargado puede crear colaboradores de su gimnasio");
      if (invite.kind !== "staff" && invite.kind !== "manager") return reply(400, "Tipo de asignación inválido");
      if (invite.kind === "manager" && !platform) return reply(403, "Solo José puede crear encargados");
      if (invite.kind === "staff" && !["reception", "inventory", "instructor"].includes(invite.role))
        return reply(400, "Permiso de colaborador inválido");
      if (!platform && gym.lifecycle !== "active" &&
        !(gym.lifecycle === "trial" && gym.trial_ends_at && Date.parse(gym.trial_ends_at) > Date.now()))
        return reply(403, "El gimnasio no tiene acceso activo");
      if (invite.accepted_at || invite.revoked_at || !Number.isFinite(Date.parse(invite.expires_at)) || Date.parse(invite.expires_at) <= Date.now())
        return reply(409, "La asignación fue aceptada, revocada o venció. Crea una nueva.");
      const result = await deps.createAccount(invite.email, body.password, invite);
      if (!result.ok) {
        if (["email_exists", "user_already_exists"].includes(result.code || ""))
          return reply(409, "Este correo ya tiene una cuenta. No se cambió su contraseña. La persona debe entrar con sus credenciales existentes; si su cuenta fue creada manualmente para otro gimnasio, contacta a José.");
        if (result.code === "weak_password") return reply(400, "La contraseña no cumple los requisitos de seguridad. Elige otra.");
        return reply(502, "No se pudo crear la cuenta. La asignación sigue guardada y puedes reintentar.");
      }
      return reply(201, "Usuario creado sin enviar correo. Comparte el correo y la contraseña de forma privada. Debe entrar antes de que venza la asignación; al iniciar sesión se asignará su acceso y, si es un encargado nuevo, comenzará la prueba de siete días.");
    } catch {
      // Never log request bodies, passwords or Auth responses.
      return reply(503, "No se pudo completar la operación. Revisa la lista antes de reintentar.");
    }
  };
}
