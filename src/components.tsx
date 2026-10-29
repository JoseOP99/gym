import { useRef, useState } from "react";
import type { InputHTMLAttributes, ReactNode } from "react";
import { ArrowRight, Inbox } from "lucide-react";
export function DataForm({
  children,
  onSubmit,
  submit,
  disabled = false,
}: {
  children: ReactNode;
  onSubmit: (form: FormData) => Promise<void>;
  submit: string;
  disabled?: boolean;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [success, setSuccess] = useState(false);
  const lock = useRef(false);
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        if (lock.current || disabled) return;
        const data = new FormData(e.currentTarget);
        lock.current = true;
        setBusy(true);
        setError("");
        setSuccess(false);
        try {
          await onSubmit(data);
          setSuccess(true);
        } catch (e) {
          setError(
            e instanceof Error
              ? e.message
              : "No se pudo guardar. Intenta de nuevo.",
          );
        } finally {
          setBusy(false);
          lock.current = false;
        }
      }}
    >
      <fieldset disabled={busy || disabled}>
        {children}
        <ErrorMessage message={error} />
        <button type="submit">
          {busy ? "Guardando…" : submit}
          <ArrowRight size={17} />
        </button>
        {success && (
          <span className="form-success" role="status">
            Operación completada.
          </span>
        )}
      </fieldset>
    </form>
  );
}
export function Field({
  label,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label>
      {label}
      <input {...props} />
    </label>
  );
}
export function ErrorMessage({ message }: { message: string }) {
  return message ? (
    <p role="alert" className="error">
      {message}
    </p>
  ) : null;
}
export function Empty({ title, text }: { title: string; text: string }) {
  return (
    <div className="empty">
      <Inbox size={28} />
      <h3>{title}</h3>
      <p>{text}</p>
    </div>
  );
}
export function Footer() {
  return (
    <footer>
      Creado por{" "}
      <a href="https://zenubit.com" target="_blank" rel="noreferrer">
        Zenubit ↗
      </a>
    </footer>
  );
}
export function Payment() {
  return (
    <label>
      Medio de pago
      <select name="method">
        <option value="cash">Efectivo</option>
        <option value="transfer">Transferencia</option>
        <option value="card">Tarjeta</option>
      </select>
    </label>
  );
}
