import { useEffect, useId, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { db } from "./lib/supabase";
import { check } from "./lib/check";
import { ErrorMessage } from "./components";
import type { Client } from "./lib/domain";

export default function EntryClientPicker({ gymId, value, search, onSearch, onSelect }: {
  gymId: string; value: string; search: string; onSearch: (search: string) => void; onSelect: (id: string) => void;
}) {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const container = useRef<HTMLDivElement>(null);
  const id = useId();
  useEffect(() => {
    input.current?.setCustomValidity(value ? "" : "Selecciona un cliente de la lista.");
  }, [value]);
  useEffect(() => {
    if (!open) return;
    const dismiss = (event: PointerEvent) => {
      if (!container.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", dismiss);
    return () => document.removeEventListener("pointerdown", dismiss);
  }, [open]);
  useEffect(() => {
    if (open) document.getElementById(`${id}-${highlighted}`)?.scrollIntoView({ block: "nearest" });
  }, [id, highlighted, open]);
  function select(client: Client) {
    onSelect(client.id);
    setOpen(false);
  }
  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(() => {
      setLoading(true); setError("");
      void (async () => {
        let query = db.from("clients").select("id,name,email,phone,active").eq("gym_id", gymId).eq("active", true);
        const term = search.trim().replace(/[%_\\]/g, "");
        if (term) query = query.ilike("name", "%" + term + "%");
        const result = await query.order("name").order("id").limit(20);
        check(result);
        if (!cancelled) setClients(result.data || []);
      })().catch(e => { if (!cancelled) { setError(e.message); setClients([]); } }).finally(() => { if (!cancelled) setLoading(false); });
    }, 250);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [gymId, search]);
  return <div ref={container} className="entry-client-picker" onBlur={e => { if (!e.currentTarget.contains(e.relatedTarget)) setOpen(false); }}>
    <input type="hidden" name="client" value={value} />
    <label htmlFor={id}>Cliente</label>
    <div className="client-combobox">
      <div className="client-combobox-field">
        <input ref={input} id={id} role="combobox" aria-autocomplete="list" aria-expanded={open} aria-controls={`${id}-options`} aria-activedescendant={open && !loading && clients[highlighted] ? `${id}-${highlighted}` : undefined} autoComplete="off" required maxLength={100}
          value={value ? clients.find(client => client.id === value)?.name || search : search}
          placeholder="Selecciona o busca un cliente"
          onFocus={() => setOpen(true)} onClick={() => setOpen(true)}
          onChange={e => { setLoading(true); setOpen(true); setHighlighted(0); onSearch(e.target.value); }}
          onKeyDown={e => {
            if (e.key === "Escape") { e.preventDefault(); setOpen(false); }
            if (e.key === "ArrowDown" || e.key === "ArrowUp") {
              e.preventDefault(); setOpen(true);
              setHighlighted(index => Math.max(0, Math.min(clients.length - 1, index + (e.key === "ArrowDown" ? 1 : -1))));
            }
            if (e.key === "Enter" && open) { e.preventDefault(); if (!loading && clients[highlighted]) select(clients[highlighted]); }
          }} />
        <ChevronDown size={18} aria-hidden="true" />
      </div>
      {open && <div className="client-combobox-popup">
        <div id={`${id}-options`} role="listbox" aria-label="Clientes" aria-busy={loading}>
          {!loading && clients.map((client, index) => <button type="button" role="option" id={`${id}-${index}`} aria-selected={value === client.id} className={highlighted === index ? "highlighted" : ""} key={client.id}
            onMouseDown={e => e.preventDefault()} onMouseEnter={() => setHighlighted(index)} onClick={() => select(client)}>
            <span>{client.name}</span>{client.phone && <small>{client.phone}</small>}
          </button>)}
        </div>
        <p className="form-help" role="status">{loading ? "Buscando clientes…" : clients.length === 0 ? "No hay coincidencias. Prueba otro nombre." : clients.length === 20 ? "Escribe más letras para afinar los resultados." : `${clients.length} resultados`}</p>
      </div>}
    </div>
    <ErrorMessage message={error} />
  </div>;
}
