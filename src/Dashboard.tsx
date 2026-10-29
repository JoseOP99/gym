import { check } from "./lib/check";
import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import {
  Activity,
  ArrowUpRight,
  Building2,
  Dumbbell,
  LayoutDashboard,
  LogOut,
  Package,
  Receipt,
  ShoppingBag,
  Users,
  Wallet,
  ShieldCheck,
  Plus,
  Menu,
  X,
} from "lucide-react";
import Team from "./Team";
import FinanceSummary from "./FinanceSummary";
import EntryClientPicker from "./EntryClientPicker";
import { db } from "./lib/supabase";
import { money, localDate, membershipState, total, effectiveRole, membershipCoversDay } from "./lib/domain";
import type {
  Gym,
  Role,
  Client,
  Product,
  Machine,
  Sale,
  Item,
  Membership,
  Cash,
} from "./lib/domain";
import { exportSales } from "./lib/export";
import {
  DataForm,
  Field,
  Footer,
  ErrorMessage,
  Empty,
  Payment,
} from "./components";
const roleNames: Record<Role, string> = {
  owner: "Encargado",
  reception: "Operario",
  inventory: "Operario",
  instructor: "Operario",
};
const tabs = [
  {
    id: "overview",
    name: "Resumen",
    icon: LayoutDashboard,
    roles: ["owner", "reception", "inventory", "instructor"],
  },
  {
    id: "pos",
    name: "Ingresos y ventas",
    icon: ShoppingBag,
    roles: ["owner", "reception"],
  },
  {
    id: "clients",
    name: "Clientes",
    icon: Users,
    roles: ["owner", "reception", "instructor"],
  },
  {
    id: "products",
    name: "Productos",
    icon: Package,
    roles: ["owner", "reception"],
  },
  {
    id: "machines",
    name: "Máquinas",
    icon: Dumbbell,
    roles: ["owner", "reception"],
  },
  {
    id: "history",
    name: "Ventas",
    icon: Receipt,
    roles: ["owner", "reception"],
  },
  { id: "finance", name: "Gastos e ingresos", icon: Wallet, roles: ["owner"] },
  { id: "team", name: "Equipo", icon: ShieldCheck, roles: ["owner"] },
  { id: "settings", name: "Gimnasio", icon: Building2, roles: ["owner"] },
];
export default function Dashboard({
  gym,
  gyms,
  role: assignedRole,
  session,
  onSelect,
  onNew,
  onSignOut,
  onRefresh,
  platformAdmin = false,
  accessLabel,
}: {
  gym: Gym;
  gyms: Gym[];
  role: Role;
  session: Session;
  onSelect: (id: string) => void;
  onNew: () => void;
  onSignOut: () => void;
  onRefresh: () => Promise<void>;
  platformAdmin?: boolean;
  accessLabel?: string;
}) {
  const role = effectiveRole(assignedRole);
  const [menuOpen, setMenuOpen] = useState(false);
  const [tab, setTab] = useState("overview"),
    [version, setVersion] = useState(0),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true);
  const [clients, setClients] = useState<Client[]>([]),
    [products, setProducts] = useState<Product[]>([]),
    [machines, setMachines] = useState<Machine[]>([]),
    [sales, setSales] = useState<Sale[]>([]),
    [cash, setCash] = useState<Cash[]>([]),
    [memberships, setMemberships] = useState<Membership[]>([]);
  const [page, setPage] = useState(0),
    [search, setSearch] = useState(""),
    [from, setFrom] = useState(localDate().slice(0, 7) + "-01"),
    [to, setTo] = useState(localDate()),
    [activeSale, setActiveSale] = useState(""),
    [items, setItems] = useState<Item[]>([]),
    [itemsLoading, setItemsLoading] = useState(false),
    [edit, setEdit] = useState<Client | Product | Machine | null>(null);
  const [accountSearch, setAccountSearch] = useState("");
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [visitNotice, setVisitNotice] = useState("");
  useEffect(() => {
    if (!activeSale || !window.matchMedia("(max-width: 1050px)").matches) return;
    const frame = requestAnimationFrame(() => document.getElementById("active-ticket")?.scrollIntoView({ block: "start", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" }));
    return () => cancelAnimationFrame(frame);
  }, [activeSale]);
  const [entryClient, setEntryClient] = useState("");
  const [entrySearch, setEntrySearch] = useState("");
  const [entryKind, setEntryKind] = useState("visit");
  const [entryMembership, setEntryMembership] = useState<Membership | null>(null);
  const [entryChecking, setEntryChecking] = useState(false);
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      await Promise.resolve();
      if (cancelled) return;
      setEntryMembership(null);
      if (!entryClient || tab !== "pos" || entryKind === "products") { setEntryChecking(false); return; }
      setEntryChecking(true);
      const today = localDate();
      const result = await db.from("memberships").select("client_id,starts_on,expires_on")
        .eq("gym_id", gym.id).eq("client_id", entryClient).lte("starts_on", today).gt("expires_on", today)
        .order("expires_on", { ascending: false }).limit(1).maybeSingle();
      check(result);
      if (!cancelled) setEntryMembership(result.data);
    })().catch(e => { if (!cancelled) setError(e.message); }).finally(() => { if (!cancelled) setEntryChecking(false); });
    return () => { cancelled = true; };
  }, [entryClient, entryKind, tab, gym.id, version]);
  const [todayLabel] = useState(() =>
    new Intl.DateTimeFormat("es-CO", {
      dateStyle: "long",
      timeZone: "America/Bogota",
    }).format(new Date()),
  );
  const canSell = role === "owner" || role === "reception",
    refresh = () => setVersion((v) => v + 1);
  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (cancelled) return;
      setLoading(true);
      setError("");
      const queries: PromiseLike<unknown>[] = [];
      const read = async <T,>(
        query: PromiseLike<{
          data: T[] | null;
          error: { message: string } | null;
        }>,
        setter: (data: T[]) => void,
      ) => {
        const result = await query;
        check(result);
        if (!cancelled) setter(result.data || []);
      };
      if (
        ["overview", "clients"].includes(tab) &&
        role !== "inventory"
      ) {
        let query = db
          .from("clients")
          .select("*")
          .eq("gym_id", gym.id)
          .order("created_at", { ascending: false })
          .range(
            tab === "clients" ? page * 50 : 0,
            tab === "clients" ? page * 50 + 49 : 99,
          );
        if (search && tab === "clients")
          query = query.ilike("name", "%" + search.replace(/[%_]/g, "") + "%");
        queries.push(read(query, setClients));
        queries.push(
          read(
            db
              .from("memberships")
              .select("client_id,starts_on,expires_on")
              .eq("gym_id", gym.id)
              .order("expires_on", { ascending: false })
              .limit(1000),
            setMemberships,
          ),
        );
      }
      if (
        ["overview", "pos", "products"].includes(tab) &&
        role !== "instructor"
      )
        queries.push(
          read(
            db
              .from("products")
              .select("*")
              .eq("gym_id", gym.id)
              .order("name")
              .range(
                tab === "products" ? page * 50 : 0,
                tab === "products" ? page * 50 + 49 : 99,
              ),
            setProducts,
          ),
        );
      if (tab === "machines")
        queries.push(
          read(
            db
              .from("machines")
              .select("*")
              .eq("gym_id", gym.id)
              .order("name")
              .range(page * 50, page * 50 + 49),
            setMachines,
          ),
        );
      if (["overview", "pos", "history"].includes(tab) && canSell) {
        let query = db
          .from("sales")
          .select("*")
          .eq("gym_id", gym.id)
          .eq("status", tab === "history" ? "closed" : "open");
        query =
          tab === "history"
            ? query
                .gte("closed_at", from + "T00:00:00-05:00")
                .lte("closed_at", to + "T23:59:59.999999-05:00")
                .order("closed_at", { ascending: false })
                .order("id")
            : query.order("opened_at", { ascending: false });
        if (tab === "pos" && accountSearch.trim()) query = query.ilike("client_name", "%" + accountSearch.trim().replace(/[%_\\]/g, "") + "%");
        queries.push(
          read(
            query.range(
              ["history", "pos"].includes(tab) ? page * 50 : 0,
              ["history", "pos"].includes(tab) ? page * 50 + 49 : 99,
            ),
            setSales,
          ),
        );
      }
      if (tab === "finance")
        queries.push(
          read(
            db
              .from("cash_entries")
              .select("*")
              .eq("gym_id", gym.id)
              .order("created_at", { ascending: false })
              .range(page * 50, page * 50 + 49),
            setCash,
          ),
        );
      await Promise.all(queries);
    }
    void Promise.resolve()
      .then(load)
      .catch((e) => {
        if (!cancelled) setError(e.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [tab, gym.id, role, version, page, search, from, to, canSell, accountSearch]);
  useEffect(() => {
    let cancelled = false;
    void Promise.resolve()
      .then(() => {
        if (cancelled) return;
        setItems([]);
        setItemsLoading(Boolean(activeSale));
        if (activeSale)
          return db
            .from("sale_items")
            .select("*")
            .eq("gym_id", gym.id)
            .eq("sale_id", activeSale)
            .order("id")
            .then((result) => {
              if (cancelled) return;
              if (result.error) setError(result.error.message);
              else setItems(result.data || []);
              setItemsLoading(false);
            });
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e.message);
          setItemsLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [activeSale, gym.id, version]);
  async function act(fn: () => Promise<void>) {
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
  const expiry = (id: string) =>
    memberships.find((m) => m.client_id === id)?.expires_on;
  function navigate(id: string) {
    setEntryClient("");
    setEntrySearch("");
    setAccountSearch("");
    setMenuOpen(false);
    requestAnimationFrame(() => document.getElementById("page-title")?.focus());
    setTab(id);
    setPage(0);
    setSearch("");
    setEdit(null);
    setActiveSale("");
    setSelectedSale(null);
    setVisitNotice("");
    setSales([]);
    setError("");
  }
  const pageCount =
    tab === "clients"
      ? clients.length
      : tab === "products"
        ? products.length
        : tab === "machines"
          ? machines.length
          : tab === "finance"
            ? cash.length
            : sales.length;
  return (
    <div className="app-shell">
      <aside className={"sidebar" + (menuOpen ? " is-open" : "")}>
        <a href="/" className="brand">
          <span className="brand-mark">
            <Activity size={22} />
          </span>
          GYM<span className="brand-dot">.</span>
        </a>
        <button className="mobile-nav-toggle secondary" aria-expanded={menuOpen} aria-controls="gym-navigation" onClick={() => setMenuOpen(open => !open)}>{menuOpen ? <X size={18} /> : <Menu size={18} />}{menuOpen ? "Cerrar menú" : "Menú"}</button>
        <div className="sidebar-navigation" id="gym-navigation">
        <label className="gym-switch">
          Gimnasio
          <select
            aria-label="Gimnasio activo"
            value={gym.id}
            onChange={(e) => onSelect(e.target.value)}
          >
            {gyms.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        </label>
        <nav aria-label="Principal">
          {[
            { name: "", ids: ["overview", "pos", "clients", "history"] },
            { name: "Inventario", ids: ["products", "machines"] },
            { name: "Administración", ids: ["finance", "team", "settings"] },
          ].map(group => {
            const entries = tabs.filter(t => group.ids.includes(t.id) && t.roles.includes(role));
            if (!entries.length) return null;
            const links = entries.map((t) => (
              <button
                key={t.id}
                aria-current={tab === t.id ? "page" : undefined}
                className={tab === t.id ? "nav-item selected" : "nav-item"}
                onClick={() => navigate(t.id)}
              >
                <t.icon size={19} />
                {t.name}
                {tab === t.id && <span className="nav-dot" />}
              </button>
            ));
            return group.name ? <details className="nav-group" key={group.name} open={group.ids.includes(tab) || undefined}><summary>{group.name}</summary><div className="nav-group-content">{links}</div></details> : <div className="nav-primary" key="daily">{links}</div>;
          })}
        </nav>
        <div className="sidebar-bottom">
          {platformAdmin && (
            <button className="text-button" onClick={onNew}>
              <Plus size={16} /> Gestionar gimnasios
            </button>
          )}
          <div className="account">
            <span className="avatar">
              {session.user.email?.slice(0, 1).toUpperCase()}
            </span>
            <div>
              <strong>
                {platformAdmin ? "Superadministrador" : roleNames[role]}
              </strong>
              <small>{session.user.email}</small>
            </div>
            <button
              className="icon-button"
              aria-label="Cerrar sesión"
              onClick={onSignOut}
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <span>
            <span className="muted">{gym.name}</span>
            <span className="crumb">/</span>
            {tabs.find((t) => t.id === tab)?.name}
          </span>
          <span className="today">{todayLabel}</span>
        </header>
        <main className="content">
          <div className="page-heading">
            <div>
              <h1 id="page-title" tabIndex={-1}>
                {tab === "overview"
                  ? "Resumen del gimnasio"
                  : tabs.find((t) => t.id === tab)?.name}
              </h1>
              <p className="muted">
                {tab === "overview"
                  ? "El movimiento de tu gimnasio, de un vistazo."
                  : "Trabajando en " + gym.name + " · " + roleNames[role]}
              </p>
            </div>
            <span className="badge">
              <span className="status-dot" /> {accessLabel || "Espacio activo"}
            </span>
          </div>
          <ErrorMessage message={error} />
          {loading && (
            <p role="status" className="loading">
              Actualizando información…
            </p>
          )}
          {tab === "overview" && (
            <>
              {role === "owner" && <FinanceSummary gymId={gym.id} version={version} onExpense={() => navigate("finance")} />}
              <div className="stats">
                {role !== "inventory" && (
                  <Stat
                    label="Clientes en vista"
                    value={String(clients.filter((c) => c.active).length)}
                    note="Hasta 100 registros recientes"
                    icon={Users}
                  />
                )}{" "}
                {canSell && (
                  <Stat
                    label="Cuentas abiertas"
                    value={String(sales.length)}
                    note="Hasta 100 cuentas recientes"
                    icon={ShoppingBag}
                  />
                )}{" "}
                {role !== "instructor" && (
                  <Stat
                    label="Productos por reponer"
                    value={String(
                      products.filter((p) => p.active && p.stock <= 5).length,
                    )}
                    note="5 unidades o menos · catálogo en vista"
                    icon={Package}
                  />
                )}
              </div>
              <div className="overview-grid">
                <section className="panel welcome-panel">
                  <h2>
                    {canSell
                      ? "La próxima visita empieza aquí."
                      : "Un equipo bien organizado."}
                  </h2>
                  <p>
                    {canSell
                      ? "Abre una cuenta, agrega un pase o un producto y registra el pago al finalizar."
                      : "Mantén la información de tu área al día desde el menú de trabajo."}
                  </p>
                  <button
                    onClick={() =>
                      navigate(
                        canSell
                          ? "pos"
                          : role === "inventory"
                            ? "products"
                            : "clients",
                      )
                    }
                  >
                    {canSell ? "Abrir punto de venta" : "Ir a mi área"}
                    <ArrowUpRight size={18} />
                  </button>
                  <Dumbbell className="welcome-art" aria-hidden="true" />
                </section>
                <section className="panel">
                  <div className="panel-heading">
                    <h2>Tu operación</h2>
                    <span className="section-number">HOY</span>
                  </div>
                  <div className="operation-line">
                    <span>Pase diario</span>
                    <strong>{money(gym.daily_price)}</strong>
                  </div>
                  <div className="operation-line">
                    <span>Membresía · {gym.membership_days} días</span>
                    <strong>{money(gym.monthly_price)}</strong>
                  </div>
                  <div className="operation-line">
                    <span>Tu permiso</span>
                    <strong>{roleNames[role]}</strong>
                  </div>
                  <p className="muted small">
                    Los valores se conservan en cada venta al registrar sus
                    conceptos.
                  </p>
                </section>
              </div>
              {canSell && (
                <section className="panel">
                  <div className="panel-heading">
                    <h2>Cuentas en curso</h2>
                    <button
                      className="text-button"
                      onClick={() => navigate("pos")}
                    >
                      Ver punto de venta <ArrowUpRight size={16} />
                    </button>
                  </div>
                  {sales.length ? (
                    <div className="table-wrap">
                      <table>
                        <thead>
                          <tr>
                            <th>Cliente</th>
                            <th>Ingreso</th>
                            <th>Estado</th>
                          </tr>
                        </thead>
                        <tbody>
                          {sales.slice(0, 5).map((s) => (
                            <tr key={s.id}>
                              <td>{s.client_name}</td>
                              <td>
                                {new Date(s.opened_at).toLocaleString("es-CO", {
                                  timeZone: "America/Bogota",
                                })}
                              </td>
                              <td>
                                <span className="pill">Cuenta abierta</span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <Empty
                      title="Un nuevo día, nuevas visitas"
                      text="Las cuentas que abras aparecerán aquí."
                    />
                  )}
                </section>
              )}
            </>
          )}
          {tab === "pos" && (
            <div className={"two-columns pos-layout" + (activeSale ? " has-active-sale" : "")}>
              <div>
                <section className="panel">
                  <h2>Registrar atención</h2>
                  <p className="muted">Si regresa hoy, continúa su cuenta pendiente o abre otra para productos sin cobrar otro pase. Lo ya pagado se conserva.</p>
                  {visitNotice && <p className="notice" role="status">{visitNotice}</p>}
                  <DataForm
                    submit={entryKind === "products" ? "Abrir compra de productos" : "Registrar ingreso"}
                    resetOnSuccess
                    disabled={entryChecking}
                    onSubmit={async (f) => {
                      const requestId = crypto.randomUUID();
                      const { data, error } = await db.rpc(entryKind === "products" ? "open_product_sale" : "open_sale", {
                        g: gym.id, c: f.get("client"), request_id: requestId,
                        ...(entryKind === "visit" ? { charge_pass: f.get("pass") === "on" } : {}),
                      });
                      check({ error });
                      const result = await db.from("sales").select("*").eq("gym_id", gym.id).eq("id", data).single();
                      check(result);
                      setSelectedSale(result.data);
                      setVisitNotice(entryKind === "products" ? "Compra de productos abierta. No registra otro ingreso ni cobra pase diario." : result.data.kind === "products" ? "El ingreso de hoy ya está pagado. Se abrió una cuenta adicional para productos, sin cobrar otra entrada." : data !== requestId
                        ? `Esta persona ya tiene un ingreso registrado. Se abrió la cuenta del ${new Date(result.data.opened_at).toLocaleString("es-CO", { timeZone: "America/Bogota" })}. ${result.data.status === "closed" ? "Ya está pagada y solo puede consultarse." : "Puedes continuar editando esta cuenta."}`
                        : "Ingreso registrado. La cuenta está lista.");
                      setActiveSale(data);
                      setEntryClient("");
                      setEntrySearch("");
                      setEntryMembership(null);
                      refresh();
                    }}
                  >
                    <div className="entry-kind" role="group" aria-label="Tipo de atención">
                      <label><input type="radio" name="entry_kind" value="visit" checked={entryKind === "visit"} onChange={() => setEntryKind("visit")} />Ingreso al gimnasio</label>
                      <label><input type="radio" name="entry_kind" value="products" checked={entryKind === "products"} onChange={() => setEntryKind("products")} />Solo productos</label>
                    </div>
                    <EntryClientPicker gymId={gym.id} value={entryClient} search={entrySearch} onSearch={value => { setEntrySearch(value); setEntryClient(""); setEntryMembership(null); }} onSelect={id => { setEntryClient(id); setEntryMembership(null); setEntryChecking(entryKind === "visit"); }} />
                    {entryKind === "visit" && <>
                    {entryChecking ? <p role="status">Consultando membresía…</p> : membershipCoversDay(entryMembership) ? <p className="notice" role="status">Membresía activa hasta {entryMembership!.expires_on}. Este ingreso está incluido: pase diario {money(0)}. Los productos se cobran aparte.</p> : <label className="checkbox">
                      <input type="checkbox" name="pass" defaultChecked />{" "}
                      Incluir pase diario · {money(gym.daily_price)}
                    </label>}
                    </>}
                    {entryKind === "products" && <p className="form-help">Abre una compra independiente para este cliente. Su ingreso y las cuentas pagadas se conservan.</p>}
                  </DataForm>
                  <p className="small muted">
                    Busca entre todos los clientes activos. Registra clientes nuevos desde su módulo.
                  </p>
                </section>
                <section className="panel">
                  <h2>Cuentas abiertas</h2>
                  <label>Buscar cuenta por cliente<input type="search" value={accountSearch} maxLength={100} placeholder="Nombre del cliente con cuenta pendiente" onChange={e => { setAccountSearch(e.target.value); setPage(0); }} /></label>
                  <p className="form-help">Busca en todas las cuentas pendientes del gimnasio.</p>
                  {sales.length ? (
                    sales.map((s) => (
                      <button
                        key={s.id}
                        className={
                          "sale-select " + (activeSale === s.id ? "active" : "")
                        }
                        onClick={() => { setActiveSale(s.id); setSelectedSale(s); setVisitNotice(""); }}
                      >
                        <span>
                          {s.client_name}
                          <small>
                            {new Date(s.opened_at).toLocaleTimeString("es-CO", {
                              hour: "2-digit",
                              minute: "2-digit",
                              timeZone: "America/Bogota",
                            })}
                          </small>
                        </span>
                        <ArrowUpRight size={18} />
                      </button>
                    ))
                  ) : (
                    <Empty
                      title={accountSearch ? "No hay cuentas con ese nombre" : "No hay cuentas abiertas"}
                      text={accountSearch ? "Prueba otro nombre o limpia la búsqueda." : "Registra el ingreso de un cliente para comenzar."}
                    />
                  )}
                </section>
              </div>
              <section className="panel ticket" id="active-ticket">
                {activeSale ? (
                  <>
                    <p className="muted small">{selectedSale?.kind === "products" ? "Compra de productos" : "Cuenta del cliente"}</p>
                    <h2>
                      {selectedSale?.client_name || sales.find((s) => s.id === activeSale)?.client_name ||
                        "Cuenta seleccionada"}
                    </h2>
                    {selectedSale?.status === "closed" && <div className="closed-sale-actions"><p>Esta cuenta está pagada. Puedes abrir otra compra para la misma persona sin modificarla.</p><button className="secondary" disabled={busy || !selectedSale.client_id} onClick={() => act(async () => {
                      const opened = await db.rpc("open_product_sale", { g: gym.id, c: selectedSale.client_id, request_id: crypto.randomUUID() });
                      check(opened);
                      const result = await db.from("sales").select("*").eq("gym_id", gym.id).eq("id", opened.data).single();
                      check(result); setSelectedSale(result.data); setActiveSale(opened.data); setVisitNotice("Nueva compra de productos. La cuenta pagada se conserva.");
                    })}>Nueva compra para este cliente</button></div>}
                    {selectedSale?.status !== "closed" && <div className="ticket-products"><h3>Agregar productos</h3><p className="form-help">El inventario se descuenta al añadir, aunque quede pendiente de pago. Si quitas un producto, vuelve al inventario.</p>
                    <DataForm
                      key={activeSale}
                      disabled={selectedSale?.status === "closed"}
                      submit="Añadir a la cuenta"
                      submitVariant="secondary"
                      resetOnSuccess
                      onSubmit={async (f) => {
                        check(
                          await db.rpc("add_item", {
                            s: activeSale,
                            p: f.get("product"),
                            q: Number(f.get("quantity")),
                          }),
                        );
                        refresh();
                      }}
                    >
                      <label>
                        Producto
                        <select name="product" required defaultValue="">
                          <option value="" disabled>
                            Seleccionar producto
                          </option>
                          {products
                            .filter((p) => p.active)
                            .map((p) => (
                              <option value={p.id} key={p.id} disabled={p.stock === 0}>
                                {p.name} · {money(p.price)} · {p.stock}{" "}
                                disponibles
                              </option>
                            ))}
                        </select>
                      </label>
                      <Field
                        name="quantity"
                        label="Cantidad"
                        type="number"
                        min={1}
                        max={1000}
                        defaultValue={1}
                        required
                      />
                    </DataForm>
                    </div>}
                    {itemsLoading ? (
                      <p role="status">Cargando conceptos…</p>
                    ) : (
                      items.map((i) => (
                        <div className="ticket-line" key={i.id}>
                          <span>
                            {i.description}
                            <small>
                              {i.quantity} × {money(i.unit_price)}
                            </small>
                          </span>
                          <strong>{money(i.quantity * i.unit_price)}</strong>
                          {selectedSale?.status !== "closed" && <button
                            className="text-button"
                            disabled={busy}
                            onClick={() =>
                              act(async () => {
                                check(await db.rpc("remove_item", { i: i.id }));
                              })
                            }
                          >
                            Quitar
                          </button>}
                        </div>
                      ))
                    )}
                    <div className="ticket-total">
                      <span>Total</span>
                      <strong>{money(total(items))}</strong>
                    </div>
                    {selectedSale?.status !== "closed" && <div className="ticket-checkout"><h3>Cobro final</h3>
                    <DataForm
                      submit={total(items) === 0 ? (selectedSale?.kind === "products" ? "Finalizar compra sin cobro" : "Finalizar ingreso sin cobro") : "Cerrar cuenta y cobrar"}
                      disabled={itemsLoading || !items.length || selectedSale?.status === "closed"}
                      onSubmit={async (f) => {
                        check(
                          await db.rpc("close_sale", {
                            s: activeSale,
                            method: f.get("method") || "cash",
                          }),
                        );
                        setSelectedSale(current => current ? { ...current, status: "closed", total: total(items) } : current);
                        refresh();
                      }}
                    >
                      {total(items) > 0 ? <Payment /> : <p className="muted">Esta cuenta no tiene un importe por cobrar.</p>}
                    </DataForm>
                    <p className="small muted">
                      Al cerrar, esta cuenta queda pagada y no se modifica. Las compras posteriores se registran aparte.
                    </p>
                    </div>}
                  </>
                ) : (
                  <Empty
                    title="Selecciona una cuenta"
                    text="Aquí aparecerán los conceptos y el total del cliente."
                  />
                )}
              </section>
            </div>
          )}
          {tab === "clients" && (
            <>
              <div className="toolbar">
                <label>
                  Buscar cliente
                  <input
                    value={search}
                    onChange={(e) => {
                      setSearch(e.target.value);
                      setPage(0);
                    }}
                    placeholder="Nombre del cliente"
                  />
                </label>
              </div>
              {canSell && (
                <section className="panel">
                  <h2>{edit ? "Editar cliente" : "Nuevo cliente"}</h2>
                  <DataForm
                    key={edit?.id || "new"}
                    submit={edit ? "Guardar cambios" : "Registrar cliente"}
                    resetOnSuccess={!edit}
                    onSubmit={async (f) => {
                      const values = {
                        name: String(f.get("name")).trim(),
                        email: String(f.get("email")).trim() || null,
                        phone: String(f.get("phone")).trim() || null,
                      };
                      check(
                        edit
                          ? await db
                              .from("clients")
                              .update(values)
                              .eq("id", edit.id)
                              .eq("gym_id", gym.id)
                          : await db
                              .from("clients")
                              .insert({ ...values, gym_id: gym.id }),
                      );
                      setEdit(null);
                      refresh();
                    }}
                  >
                    <div className="form-grid">
                      <Field
                        name="name"
                        label="Nombre completo"
                        defaultValue={edit?.name}
                        minLength={2}
                        maxLength={100}
                        required
                      />
                      <Field
                        name="email"
                        label="Correo (opcional)"
                        type="email"
                        maxLength={254}
                        defaultValue={(edit as Client)?.email || ""}
                      />
                      <Field
                        name="phone"
                        label="Teléfono (opcional)"
                        type="tel"
                        maxLength={30}
                        defaultValue={(edit as Client)?.phone || ""}
                      />
                    </div>
                  </DataForm>
                  {edit && (
                    <button
                      className="text-button"
                      onClick={() => setEdit(null)}
                    >
                      Cancelar edición
                    </button>
                  )}
                </section>
              )}
              <section className="panel">
                <h2>Directorio de clientes</h2>
                {clients.length ? (
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Cliente</th>
                          <th>Membresía</th>
                          <th>Vence</th>
                          <th>Acciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {clients.map((c) => (
                          <tr key={c.id}>
                            <td>
                              <strong>{c.name}</strong>
                              <small>
                                {c.email || c.phone || "Sin contacto"}
                                {!c.active ? " · Archivado" : ""}
                              </small>
                            </td>
                            <td>
                              <span className="pill">
                                {membershipState(expiry(c.id))}
                              </span>
                            </td>
                            <td>{expiry(c.id) || "—"}</td>
                            <td>
                              {canSell && (
                                <div className="actions">
                                  <button
                                    className="secondary"
                                    onClick={() => setEdit(c)}
                                  >
                                    Editar
                                  </button>
                                  {role === "owner" && (
                                    <button
                                      className="text-button"
                                      disabled={busy}
                                      onClick={() =>
                                        act(async () => {
                                          check(
                                            await db
                                              .from("clients")
                                              .update({ active: !c.active })
                                              .eq("id", c.id)
                                              .eq("gym_id", gym.id),
                                          );
                                        })
                                      }
                                    >
                                      {c.active ? "Archivar" : "Activar"}
                                    </button>
                                  )}
                                </div>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <Empty
                    title="Tu comunidad empieza aquí"
                    text="Registra el primer cliente para abrir cuentas y membresías."
                  />
                )}
              </section>
              {canSell && (
                <section className="panel">
                  <h2>Registrar membresía · {gym.membership_days} días</h2>
                  <p className="muted">
                    Valor: {money(gym.monthly_price)}. Una renovación anticipada
                    conserva los días restantes.
                  </p>
                  <DataForm
                    submit="Registrar pago y membresía"
                    resetOnSuccess
                    onSubmit={async (f) => {
                      check(
                        await db.rpc("renew_membership", {
                          g: gym.id,
                          c: f.get("client"),
                          method: f.get("method"),
                          request_id: crypto.randomUUID(),
                        }),
                      );
                      refresh();
                    }}
                  >
                    <div className="form-grid">
                      <label>
                        Cliente
                        <select name="client" required defaultValue="">
                          <option value="" disabled>
                            Selecciona un cliente
                          </option>
                          {clients
                            .filter((c) => c.active)
                            .map((c) => (
                              <option value={c.id} key={c.id}>
                                {c.name}
                              </option>
                            ))}
                        </select>
                      </label>
                      <Payment />
                    </div>
                  </DataForm>
                </section>
              )}
            </>
          )}
          {tab === "products" && (
            <>
              <p className="notice">Los productos son artículos que vendes en recepción, como agua o bebidas. Aquí defines precio de venta y existencias. El encargado registra el costo de las compras en Gastos e ingresos.</p>
              <section className="panel">
                <h2>{edit ? "Editar producto" : "Agregar producto"}</h2>
                <DataForm
                  key={edit?.id || "new"}
                  submit="Guardar producto"
                  resetOnSuccess={!edit}
                  onSubmit={async (f) => {
                    const values = {
                      name: String(f.get("name")).trim(),
                      price: Math.round(Number(f.get("price")) * 100),
                      stock: Number(f.get("stock")),
                    };
                    check(
                      edit
                        ? await db
                            .from("products")
                            .update(values)
                            .eq("id", edit.id)
                            .eq("gym_id", gym.id)
                        : await db
                            .from("products")
                            .insert({ ...values, gym_id: gym.id }),
                    );
                    setEdit(null);
                    refresh();
                  }}
                >
                  <div className="form-grid">
                    <Field
                      name="name"
                      label="Nombre"
                      minLength={2}
                      maxLength={100}
                      required
                      defaultValue={edit?.name}
                    />
                    <Field
                      name="price"
                      label="Precio (COP)"
                      type="number"
                      min={0}
                      max={100000000}
                      step="0.01"
                      required
                      defaultValue={
                        edit ? (edit as Product).price / 100 : undefined
                      }
                    />
                    <Field
                      name="stock"
                      label="Existencias"
                      type="number"
                      min={0}
                      max={1000000}
                      required
                      defaultValue={edit ? (edit as Product).stock : 0}
                    />
                  </div>
                </DataForm>
                {edit && (
                  <button className="text-button" onClick={() => setEdit(null)}>
                    Cancelar edición
                  </button>
                )}
              </section>
              <section className="panel">
                <h2>Catálogo</h2>
                {products.length ? (
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Producto</th>
                          <th>Precio</th>
                          <th>Existencias</th>
                          <th>Acciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {products.map((p) => (
                          <tr key={p.id}>
                            <td>
                              {p.name}
                              {!p.active && <small>Archivado</small>}
                            </td>
                            <td>{money(p.price)}</td>
                            <td>
                              <span
                                className={
                                  "pill " + (p.stock <= 5 ? "warning" : "")
                                }
                              >
                                {p.stock} unidades
                              </span>
                            </td>
                            <td>
                              <div className="actions">
                                <button
                                  className="secondary"
                                  onClick={() => setEdit(p)}
                                >
                                  Editar
                                </button>
                                {role === "owner" && (
                                  <button
                                    className="text-button"
                                    disabled={busy}
                                    onClick={() =>
                                      act(async () => {
                                        check(
                                          await db
                                            .from("products")
                                            .update({ active: !p.active })
                                            .eq("gym_id", gym.id)
                                            .eq("id", p.id),
                                        );
                                      })
                                    }
                                  >
                                    {p.active ? "Archivar" : "Activar"}
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <Empty
                    title="Prepara tu catálogo"
                    text="Agrega agua, bebidas y otros productos disponibles en recepción."
                  />
                )}
              </section>
            </>
          )}
          {tab === "machines" && (
            <>
              <section className="panel">
                <h2>{edit ? "Editar máquina" : "Registrar máquina"}</h2>
                <DataForm
                  key={edit?.id || "new"}
                  submit="Guardar máquina"
                  resetOnSuccess={!edit}
                  onSubmit={async (f) => {
                    const values = {
                      name: String(f.get("name")).trim(),
                      status: String(f.get("status")),
                      notes: String(f.get("notes")),
                      asset_value: String(f.get("asset_value")).trim() === "" ? null : Math.round(Number(f.get("asset_value")) * 100),
                    };
                    check(
                      edit
                        ? await db
                            .from("machines")
                            .update(values)
                            .eq("id", edit.id)
                            .eq("gym_id", gym.id)
                        : await db
                            .from("machines")
                            .insert({ ...values, gym_id: gym.id }),
                    );
                    setEdit(null);
                    refresh();
                  }}
                >
                  <div className="form-grid">
                    <Field
                      name="name"
                      label="Nombre o referencia"
                      minLength={2}
                      maxLength={100}
                      defaultValue={edit?.name}
                      required
                    />
                    <label>
                      Estado
                      <select
                        name="status"
                        defaultValue={(edit as Machine)?.status || "available"}
                      >
                        <option value="available">Disponible</option>
                        <option value="maintenance">En mantenimiento</option>
                        {role === "owner" && (
                          <option value="retired">Retirada</option>
                        )}
                      </select>
                    </label>
                    <Field
                      name="notes"
                      label="Notas"
                      maxLength={1000}
                      defaultValue={(edit as Machine)?.notes}
                    />
                    <Field name="asset_value" label="Valor de la máquina (COP)" type="number" min={0} max={100000000} step="0.01" defaultValue={(edit as Machine)?.asset_value == null ? "" : (edit as Machine).asset_value! / 100} />
                  </div>
                  <p className="small muted">Registra el precio de compra o valor estimado. Déjalo vacío si todavía no lo conoces. Se suma a los activos; no registra un gasto automáticamente.</p>
                </DataForm>
                {edit && (
                  <button className="text-button" onClick={() => setEdit(null)}>
                    Cancelar edición
                  </button>
                )}
              </section>
              <div className="machine-grid">
                {machines.map((m) => (
                  <section className="panel machine" key={m.id}>
                    <Dumbbell size={28} />
                    <h2>{m.name}</h2>
                    <span className="pill">
                      {
                        {
                          available: "Disponible",
                          maintenance: "En mantenimiento",
                          retired: "Retirada",
                        }[m.status]
                      }
                    </span>
                    <p className="muted">{m.notes || "Sin observaciones"}</p>
                    <p>Valor: <strong>{m.asset_value == null ? "Sin valorar" : money(m.asset_value)}</strong></p>
                    <button
                      className="secondary"
                      disabled={role !== "owner" && m.status === "retired"}
                      onClick={() => setEdit(m)}
                    >
                      Actualizar estado
                    </button>
                  </section>
                ))}
              </div>
              {!machines.length && (
                <Empty
                  title="El equipo de tu gimnasio"
                  text="Registra las máquinas y controla su disponibilidad."
                />
              )}
            </>
          )}
          {tab === "history" && (
            <section className="panel">
              <div className="panel-heading">
                <h2>Historial de ventas</h2>
                <button
                  className="secondary"
                  disabled={busy || !from || !to || from > to}
                  onClick={() => act(() => exportSales(gym.id, from, to))}
                >
                  Descargar CSV
                </button>
              </div>
              <div className="form-grid">
                <label>
                  Desde
                  <input
                    type="date"
                    value={from}
                    onChange={(e) => {
                      setFrom(e.target.value);
                      setPage(0);
                    }}
                    required
                  />
                </label>
                <label>
                  Hasta
                  <input
                    type="date"
                    value={to}
                    onChange={(e) => {
                      setTo(e.target.value);
                      setPage(0);
                    }}
                    required
                  />
                </label>
              </div>
              <p className="muted small">
                Ventas cerradas · 50 por página · horario de Bogotá.
              </p>
              {sales.length ? (
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Cliente</th>
                        <th>Fecha</th>
                        <th>Pago</th>
                        <th>Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sales.map((s) => (
                        <tr key={s.id}>
                          <td>
                            {s.client_name}
                            <small>
                              {s.kind === "membership" ? "Membresía" : s.kind === "products" ? "Compra de productos" : "Visita"}
                            </small>
                          </td>
                          <td>
                            {s.closed_at &&
                              new Date(s.closed_at).toLocaleString("es-CO", {
                                timeZone: "America/Bogota",
                              })}
                          </td>
                          <td>
                            {
                              {
                                cash: "Efectivo",
                                transfer: "Transferencia",
                                card: "Tarjeta",
                              }[s.payment_method || ""]
                            }
                          </td>
                          <td>
                            <strong>{money(s.total)}</strong>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <Empty
                  title="Sin ventas en este período"
                  text="Las cuentas cerradas aparecerán en tu historial."
                />
              )}
            </section>
          )}
          {tab === "finance" && (
            <>
              <section className="panel">
                <h2>Registrar un gasto o ingreso adicional</h2>
                <p className="muted">
                  Las ventas se registran automáticamente en su historial. Aquí
                  registra otros ingresos o gastos. Por ejemplo: compra de un paquete de agua, artículos de aseo, arriendo o servicios.
                </p>
                <DataForm
                  submit="Registrar movimiento"
                  resetOnSuccess
                  onSubmit={async (f) => {
                    check(
                      await db.from("cash_entries").insert({
                        gym_id: gym.id,
                        description: String(f.get("description")).trim(),
                        direction: f.get("direction"),
                        amount: Math.round(Number(f.get("amount")) * 100),
                      }),
                    );
                    refresh();
                  }}
                >
                  <div className="form-grid">
                    <Field
                      name="description"
                      label="¿En qué gastaste o de dónde viene el ingreso?"
                      placeholder="Ej. Compra de un paquete de agua"
                      minLength={2}
                      maxLength={300}
                      required
                    />
                    <label>
                      Tipo
                      <select name="direction">
                        <option value="expense">Gasto / egreso</option>
                        <option value="income">Ingreso adicional</option>
                      </select>
                    </label>
                    <Field
                      name="amount"
                      label="Importe (COP)"
                      type="number"
                      min="0.01"
                      max={100000000}
                      step="0.01"
                      required
                    />
                  </div>
                </DataForm>
              </section>
              <section className="panel">
                <h2>Movimientos</h2>
                {cash.length ? (
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Concepto</th>
                          <th>Tipo</th>
                          <th>Fecha</th>
                          <th>Importe</th>
                        </tr>
                      </thead>
                      <tbody>
                        {cash.map((c) => (
                          <tr key={c.id}>
                            <td>{c.description}</td>
                            <td>
                              {c.direction === "income" ? "Ingreso" : "Egreso"}
                            </td>
                            <td>
                              {new Date(c.created_at).toLocaleDateString(
                                "es-CO",
                                { timeZone: "America/Bogota" },
                              )}
                            </td>
                            <td>{money(c.amount)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <Empty
                    title="Tus movimientos, organizados"
                    text="Los ingresos y egresos adicionales aparecerán aquí."
                  />
                )}
              </section>
            </>
          )}
          {tab === "team" && <Team gymId={gym.id} />}
          {tab === "settings" && (
            <section className="panel">
              <h2>Identidad y tarifas</h2>
              <DataForm
                submit="Guardar configuración"
                onSubmit={async (f) => {
                  check(
                    await db
                      .from("gyms")
                      .update({
                        name: String(f.get("name")).trim(),
                        membership_days: Number(f.get("membership_days")),
                        daily_price: Math.round(Number(f.get("daily")) * 100),
                        monthly_price: Math.round(
                          Number(f.get("monthly")) * 100,
                        ),
                      })
                      .eq("id", gym.id),
                  );
                  await onRefresh();
                  refresh();
                }}
              >
                <div className="form-grid">
                  <Field
                    name="name"
                    label="Nombre del gimnasio"
                    minLength={2}
                    maxLength={100}
                    defaultValue={gym.name}
                    required
                  />
                  <Field
                    name="daily"
                    label="Pase diario (COP)"
                    type="number"
                    min={0}
                    max={100000000}
                    step="0.01"
                    defaultValue={gym.daily_price / 100}
                    required
                  />
                  <Field
                    name="monthly"
                    label="Precio de la membresía (COP)"
                    type="number"
                    min={0}
                    max={100000000}
                    step="0.01"
                    defaultValue={gym.monthly_price / 100}
                    required
                  />
                  <Field
                    name="membership_days"
                    label="Días de vigencia"
                    type="number"
                    min={1}
                    max={365}
                    defaultValue={gym.membership_days}
                    required
                  />
                </div>
              </DataForm>
              <p className="small muted">
                Los cambios se aplican a conceptos nuevos. Las ventas anteriores
                conservan su valor.
              </p>
            </section>
          )}
          {["pos", "clients", "products", "machines", "history", "finance"].includes(
            tab,
          ) && (
            <div className="pagination">
              <button
                className="secondary"
                disabled={page === 0 || loading}
                onClick={() => setPage((p) => p - 1)}
              >
                Anterior
              </button>
              <span>Página {page + 1}</span>
              <button
                className="secondary"
                disabled={pageCount < 50 || loading}
                onClick={() => setPage((p) => p + 1)}
              >
                Siguiente
              </button>
            </div>
          )}
        </main>
        <Footer />
      </div>
    </div>
  );
}
function Stat({
  label,
  value,
  note,
  icon: Icon,
}: {
  label: string;
  value: string;
  note: string;
  icon: typeof Users;
}) {
  return (
    <section className="stat">
      <div>
        <span>{label}</span>
        <Icon size={20} />
      </div>
      <strong>{value}</strong>
      <small>{note}</small>
    </section>
  );
}
