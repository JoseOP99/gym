export type Role = "owner" | "reception" | "inventory" | "instructor";
// Preserve legacy database values while exposing one combined operational role.
export function effectiveRole(role: Role): Role {
  return role === "owner" ? "owner" : "reception";
}
export type Gym = {
  id: string;
  name: string;
  owner_id: string;
  daily_price: number;
  monthly_price: number;
  membership_days: number;
  lifecycle: "pending" | "trial" | "active" | "suspended";
  trial_started_at: string | null;
  trial_ends_at: string | null;
  created_by: string;
};
export type Client = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  active: boolean;
};
export type Product = {
  id: string;
  name: string;
  price: number;
  stock: number;
  active: boolean;
};
export type Machine = {
  id: string;
  name: string;
  status: string;
  notes: string;
  asset_value: number | null;
};
export type Staff = {
  user_id: string;
  name: string;
  role: Role;
  active: boolean;
};
export type Sale = {
  id: string;
  client_id: string | null;
  client_name: string;
  total: number;
  status: string;
  opened_at: string;
  closed_at: string | null;
  payment_method: string | null;
  kind: string;
};
export type Item = {
  id: string;
  description: string;
  quantity: number;
  unit_price: number;
};
export type Membership = {
  client_id: string;
  starts_on: string;
  expires_on: string;
};
export function membershipCoversDay(membership: Pick<Membership, "starts_on" | "expires_on"> | null, today = localDate()) {
  return Boolean(membership && membership.starts_on <= today && today < membership.expires_on);
}
export type Cash = {
  id: string;
  description: string;
  direction: string;
  amount: number;
  created_at: string;
};
export const money = (cents: number) =>
  new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(cents / 100);
export const localDate = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Bogota",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
export function total(items: Pick<Item, "quantity" | "unit_price">[]) {
  return items.reduce((sum, item) => {
    if (
      !Number.isSafeInteger(item.quantity) ||
      item.quantity < 1 ||
      !Number.isSafeInteger(item.unit_price) ||
      item.unit_price < 0
    )
      throw new Error("Importe inválido");
    const result = sum + item.quantity * item.unit_price;
    if (!Number.isSafeInteger(result))
      throw new Error("Importe fuera de rango");
    return result;
  }, 0);
}
export function csvCell(value: unknown) {
  let text = String(value ?? "");
  if (/^[\s]*[=+@-]/.test(text) || /^[\t\r\n]/.test(text)) text = "'" + text;
  return '"' + text.replaceAll('"', '""') + '"';
}
export function salesCsv(sales: Sale[]) {
  return (
    "\uFEFF" +
    [
      ["ID", "Cliente", "Fecha UTC", "Método", "Tipo", "Total COP"],
      ...sales.map((s) => [
        s.id,
        s.client_name,
        s.closed_at,
        s.payment_method,
        s.kind,
        (s.total / 100).toFixed(2),
      ]),
    ]
      .map((row) => row.map(csvCell).join(";"))
      .join("\r\n")
  );
}
export function membershipState(
  expiry: string | undefined,
  today = localDate(),
) {
  if (!expiry) return "Sin membresía";
  if (expiry <= today) return "Vencida";
  const days =
    (Date.parse(expiry + "T00:00:00Z") - Date.parse(today + "T00:00:00Z")) /
    86400000;
  return days <= 3 ? "Por vencer" : "Activa";
}
