import { useCallback, useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { Activity, LockKeyhole } from "lucide-react";
import { db } from "./lib/supabase";
import { check } from "./lib/check";
import { gymAccess } from "./lib/trials";
import type { Gym, Role } from "./lib/domain";
import { ErrorMessage, Footer } from "./components";
import Dashboard from "./Dashboard";
import Platform from "./Platform";

export default function Workspace({ session }: { session: Session }) {
  const [gyms, setGyms] = useState<Gym[]>([]),
    [selected, setSelected] = useState("");
  const [roles, setRoles] = useState<Record<string, Role>>({});
  const [platform, setPlatform] = useState(false),
    [inGym, setInGym] = useState(false);
  const [error, setError] = useState(""),
    [loaded, setLoaded] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const load = useCallback(async () => {
    check(await db.rpc("accept_staff_invitations"));
    const [gymResult, staffResult, platformResult] = await Promise.all([
      db.from("gyms").select("*").order("created_at"),
      db
        .from("staff")
        .select("gym_id,role")
        .eq("user_id", session.user.id)
        .eq("active", true),
      db.rpc("platform_access"),
    ]);
    [gymResult, staffResult, platformResult].forEach(check);
    setGyms(gymResult.data || []);
    setRoles(
      Object.fromEntries(
        (staffResult.data || []).map((s) => [s.gym_id, s.role]),
      ),
    );
    setPlatform(platformResult.data === true);
    setSelected((prev) =>
      (gymResult.data || []).some((g) => g.id === prev)
        ? prev
        : gymResult.data?.[0]?.id || "",
    );
    setError("");
    setLoaded(true);
    setNow(Date.now());
  }, [session.user.id]);
  useEffect(() => {
    let alive = true;
    void Promise.resolve()
      .then(() => {
        if (alive) return load();
      })
      .catch((e) => {
        if (alive) {
          setError(e.message);
          setLoaded(true);
        }
      });
    return () => {
      alive = false;
    };
  }, [load]);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 15000);
    return () => clearInterval(timer);
  }, []);
  async function signOut() {
    const result = await db.auth.signOut();
    if (result.error) setError(result.error.message);
  }
  if (!loaded)
    return (
      <main className="setup" aria-busy="true">
        Cargando tus espacios…
      </main>
    );
  if (error)
    return (
      <main className="setup">
        <h1>No pudimos abrir tu espacio</h1>
        <ErrorMessage message={error} />
        <div className="actions">
          <button onClick={() => load().catch((e) => setError(e.message))}>
            Reintentar
          </button>
          <button className="secondary" onClick={signOut}>
            Cerrar sesión
          </button>
        </div>
      </main>
    );
  if (platform && !inGym)
    return (
      <Platform
        gyms={gyms}
        onRefresh={load}
        onSignOut={signOut}
        onOpen={(id) => {
          setSelected(id);
          setInGym(true);
        }}
      />
    );
  const gym = gyms.find((g) => g.id === selected);
  if (!gym)
    return (
      <main className="onboarding">
        <div className="topline">
          <span className="brand">
            <Activity />
            GYM.
          </span>
          <button className="secondary" onClick={signOut}>
            Cerrar sesión
          </button>
        </div>
        <div className="onboarding-card">
          <p className="eyebrow">TU CUENTA ESTÁ LISTA</p>
          <h1>Esperamos tu invitación.</h1>
          <p className="muted">
            El administrador de la plataforma o el encargado debe invitar este
            mismo correo a un gimnasio. Si ya lo hizo, confirma tu correo y
            actualiza el acceso.
          </p>
          <button onClick={() => load().catch((e) => setError(e.message))}>
            Actualizar acceso
          </button>
        </div>
        <Footer />
      </main>
    );
  const access = gymAccess(gym, now, platform);
  if (!access.enabled)
    return (
      <main className="access-locked">
        <span className="brand">
          <Activity /> GYM.
        </span>
        <LockKeyhole size={35} />
        <h1>{access.label}</h1>
        <p>
          El panel de <strong>{gym.name}</strong> está bloqueado. Contacta a
          José, administrador de la plataforma, para reactivarlo. La información
          del gimnasio se conserva.
        </p>
        {gyms.length > 1 && (
          <label>
            Otro gimnasio
            <select
              value={gym.id}
              onChange={(e) => setSelected(e.target.value)}
            >
              {gyms.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <div className="actions">
          <button onClick={() => load().catch((e) => setError(e.message))}>
            Actualizar acceso
          </button>
          <button className="secondary" onClick={signOut}>
            Cerrar sesión
          </button>
        </div>
        <Footer />
      </main>
    );
  const role: Role | undefined =
    platform || gym.owner_id === session.user.id ? "owner" : roles[gym.id];
  if (!role)
    return (
      <main className="setup">
        <h1>No tienes un rol activo</h1>
        <button onClick={signOut}>Cerrar sesión</button>
      </main>
    );
  return (
    <Dashboard
      key={gym.id}
      gym={gym}
      gyms={gyms}
      role={role}
      session={session}
      platformAdmin={platform}
      accessLabel={access.label}
      onSelect={setSelected}
      onNew={() => setInGym(false)}
      onSignOut={signOut}
      onRefresh={load}
    />
  );
}
