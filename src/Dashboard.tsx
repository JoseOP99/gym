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
} from "lucide-react";
import Team from "./Team";
import { db } from "./lib/supabase";
import { money, localDate, membershipState, total } from "./lib/domain";
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
  inventory: "Inventario",
  instructor: "Instructor",
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
    name: "Punto de venta",
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
    roles: ["owner", "inventory"],
  },
  {
    id: "machines",
    name: "Máquinas",
    icon: Dumbbell,
    roles: ["owner", "inventory"],
  },
  {
    id: "history",
    name: "Ventas",
    icon: Receipt,
    roles: ["owner", "reception"],
  },
  { id: "finance", name: "Finanzas", icon: Wallet, roles: ["owner"] },
  { id: "team", name: "Equipo", icon: ShieldCheck, roles: ["owner"] },
  { id: "settings", name: "Gimnasio", icon: Building2, roles: ["owner"] },
];
export default function Dashboard({
  gym,
  gyms,
  role,
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
        ["overview", "clients", "pos"].includes(tab) &&
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
        queries.push(
          read(
            query.range(
              tab === "history" ? page * 50 : 0,
              tab === "history" ? page * 50 + 49 : 99,
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
  }, [tab, gym.id, role, version, page, search, from, to, canSell]);
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
    setTab(id);
    setPage(0);
    setSearch("");
    setEdit(null);
    setActiveSale("");
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
      <aside className="sidebar">
        <a href="/" className="brand">
          <span className="brand-mark">
            <Activity size={22} />
          </span>
          GYM<span className="brand-dot">.</span>
        </a>
        <label className="gym-switch">
          TU GIMNASIO
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
        <p className="nav-label">ESPACIO DE TRABAJO</p>
        <nav aria-label="Principal">
          {tabs
            .filter((t) => t.roles.includes(role))
            .map((t) => (
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
            ))}
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
              <p className="eyebrow">
                {tab === "overview"
                  ? "CADA DÍA CUENTA"
                  : "GESTIÓN DEL GIMNASIO"}
              </p>
              <h1>
                {tab === "overview"
                  ? "Todo listo para un gran día."
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
                  <span className="eyebrow">A TU RITMO</span>
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
            <div className="two-columns">
              <div>
                <section className="panel">
                  <h2>Abrir cuenta</h2>
                  <DataForm
                    submit="Registrar ingreso"
                    onSubmit={async (f) => {
                      const { data, error } = await db.rpc("open_sale", {
                        g: gym.id,
                        c: f.get("client"),
                        charge_pass: f.get("pass") === "on",
                        request_id: crypto.randomUUID(),
                      });
                      check({ error });
                      setActiveSale(data);
                      refresh();
                    }}
                  >
                    <label>
                      Cliente
                      <select name="client" required defaultValue="">
                        <option value="" disabled>
                          Selecciona un cliente
                        </option>
                        {clients
                          .filter((c) => c.active)
                          .map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name}
                            </option>
                          ))}
                      </select>
                    </label>
                    <label className="checkbox">
                      <input type="checkbox" name="pass" defaultChecked />{" "}
                      Incluir pase diario · {money(gym.daily_price)}
                    </label>
                  </DataForm>
                  <p className="small muted">
                    Hasta 100 clientes recientes. Registra clientes desde su
                    módulo.
                  </p>
                </section>
                <section className="panel">
                  <h2>Cuentas abiertas</h2>
                  {sales.length ? (
                    sales.map((s) => (
                      <button
                        key={s.id}
                        className={
                          "sale-select " + (activeSale === s.id ? "active" : "")
                        }
                        onClick={() => setActiveSale(s.id)}
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
                      title="No hay cuentas abiertas"
                      text="Registra el ingreso de un cliente para comenzar."
                    />
                  )}
                </section>
              </div>
              <section className="panel ticket">
                {activeSale ? (
                  <>
                    <span className="eyebrow">CUENTA ACTUAL</span>
                    <h2>
                      {sales.find((s) => s.id === activeSale)?.client_name ||
                        "Cuenta seleccionada"}
                    </h2>
                    <DataForm
                      key={activeSale}
                      submit="Añadir producto"
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
                              <option value={p.id} key={p.id}>
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
                          <button
                            className="text-button"
                            disabled={busy}
                            onClick={() =>
                              act(async () => {
                                check(await db.rpc("remove_item", { i: i.id }));
                              })
                            }
                          >
                            Quitar
                          </button>
                        </div>
                      ))
                    )}
                    <div className="ticket-total">
                      <span>Total</span>
                      <strong>{money(total(items))}</strong>
                    </div>
                    <DataForm
                      submit="Cerrar venta y registrar pago"
                      disabled={itemsLoading || !items.length}
                      onSubmit={async (f) => {
                        check(
                          await db.rpc("close_sale", {
                            s: activeSale,
                            method: f.get("method"),
                          }),
                        );
                        setActiveSale("");
                        refresh();
                      }}
                    >
                      <Payment />
                    </DataForm>
                    <p className="small muted">
                      Al cerrar, los importes quedan registrados y no se pueden
                      editar.
                    </p>
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
              <section className="panel">
                <h2>{edit ? "Editar producto" : "Agregar producto"}</h2>
                <DataForm
                  key={edit?.id || "new"}
                  submit="Guardar producto"
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
                  onSubmit={async (f) => {
                    const values = {
                      name: String(f.get("name")).trim(),
                      status: String(f.get("status")),
                      notes: String(f.get("notes")),
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
                  </div>
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
                              {s.kind === "membership" ? "Membresía" : "Visita"}
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
                <h2>Registrar movimiento adicional</h2>
                <p className="muted">
                  Las ventas se registran automáticamente en su historial. Aquí
                  registra otros ingresos o gastos.
                </p>
                <DataForm
                  submit="Registrar movimiento"
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
                      label="Concepto"
                      minLength={2}
                      maxLength={300}
                      required
                    />
                    <label>
                      Tipo
                      <select name="direction">
                        <option value="expense">Egreso</option>
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
          {["clients", "products", "machines", "history", "finance"].includes(
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
