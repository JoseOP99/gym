import { createClient } from "npm:@supabase/supabase-js@2.118.0";
import { manualUserHandler } from "./handler.ts";

const options = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, options);
Deno.serve(manualUserHandler({
  async authenticate(token) {
    const { data, error } = await admin.auth.getUser(token);
    return error ? null : data.user;
  },
  async context(token, invitationId) {
    const caller = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      ...options, global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const [access, invitation] = await Promise.all([
      caller.rpc("platform_access"),
      caller.from("staff_invitations").select("id,gym_id,email,kind,role,accepted_at,revoked_at,expires_at").eq("id", invitationId).maybeSingle(),
    ]);
    if (access.error || invitation.error) throw new Error("Permission lookup failed");
    if (!invitation.data) return null;
    const gym = await caller.from("gyms").select("owner_id,lifecycle,trial_ends_at").eq("id", invitation.data.gym_id).maybeSingle();
    if (gym.error) throw new Error("Gym lookup failed");
    return gym.data ? { invitation: invitation.data, gym: gym.data, platform: access.data === true } : null;
  },
  async createAccount(email, password, invitation) {
    const { error } = await admin.auth.admin.createUser({
      email, password, email_confirm: true,
      // Server-controlled scope. No role or privilege comes from editable metadata.
      app_metadata: { manual_invitation_id: invitation.id, manual_gym_id: invitation.gym_id },
    });
    return { ok: !error, code: error?.code };
  },
}));
