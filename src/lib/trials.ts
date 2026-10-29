export type AccessWindow = {
  lifecycle: string;
  trial_ends_at: string | null;
};
export function gymAccess(
  window: AccessWindow,
  now: number,
  platformAdmin = false,
) {
  if (platformAdmin) return { enabled: true, label: "Superadministración" };
  if (window.lifecycle === "active") return { enabled: true, label: "Activo" };
  if (window.lifecycle === "pending")
    return { enabled: false, label: "Invitación pendiente" };
  if (window.lifecycle === "suspended")
    return { enabled: false, label: "Acceso suspendido" };
  const end = window.trial_ends_at ? Date.parse(window.trial_ends_at) : NaN;
  if (window.lifecycle === "trial" && Number.isFinite(end) && end > now) {
    const days = Math.ceil((end - now) / 86400000);
    return {
      enabled: true,
      label:
        "Prueba · " + days + (days === 1 ? " día restante" : " días restantes"),
    };
  }
  return { enabled: false, label: "Prueba finalizada" };
}
