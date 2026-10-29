import { useRef, useState } from "react";
import type { InputHTMLAttributes, ReactNode } from "react";
import { ArrowRight, Inbox } from "lucide-react";
export function DataForm({
  children,
  onSubmit,
  submit,
  disabled = false,
  clearPasswords = false,
  secondaryAction,
  showSuccess = true,
  resetOnSuccess = false,
  submitVariant = "primary",
}: {
  children: ReactNode;
  onSubmit: (form: FormData) => Promise<void>;
  submit: string;
  disabled?: boolean;
  clearPasswords?: boolean;
  secondaryAction?: ReactNode;
  showSuccess?: boolean;
  resetOnSuccess?: boolean;
  submitVariant?: "primary" | "secondary";
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [success, setSuccess] = useState(false);
  const lock = useRef(false);
  return (
    <form
      className="data-form"
      onSubmit={async (e) => {
        e.preventDefault();
        if (lock.current || disabled) return;
        const form = e.currentTarget;
        const data = new FormData(form);
        lock.current = true;
        setBusy(true);
        setError("");
        setSuccess(false);
        try {
          await onSubmit(data);
          if (resetOnSuccess) form.reset();
          setSuccess(true);
        } catch (e) {
          setError(
            e instanceof Error
              ? e.message
              : "No se pudo guardar. Intenta de nuevo.",
          );
        } finally {
          if (clearPasswords) {
            form.querySelectorAll<HTMLInputElement>('input[type="password"]').forEach(input => { input.value = ""; });
            data.delete("password");
            data.delete("confirm_password");
          }
          setBusy(false);
          lock.current = false;
        }
      }}
    >
      <fieldset disabled={busy || disabled}>
        <div className="form-content">{children}</div>
        <ErrorMessage message={error} />
        <div className="form-actions">
        <button type="submit" className={submitVariant === "secondary" ? "secondary" : undefined}>
          {busy ? "Guardando…" : submit}
          <ArrowRight size={17} />
        </button>
        {secondaryAction}
        </div>
        {success && showSuccess && (
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
