import { useEffect, useState } from "react";
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
  return <div className="entry-client-picker">
    <label>Buscar cliente por nombre<input name="client_search" type="search" maxLength={100} value={search} placeholder="Escribe el nombre del cliente" onChange={e => { setLoading(true); onSearch(e.target.value); }} /></label>
    <label>Cliente<select name="client" value={value} required disabled={loading} onChange={e => onSelect(e.target.value)}>
      <option value="" disabled>{loading ? "Buscando clientes…" : "Selecciona un cliente"}</option>
      {clients.map(client => <option key={client.id} value={client.id}>{client.name}{client.phone ? " · " + client.phone : ""}</option>)}
    </select></label>
    {loading ? <p className="form-help" role="status">Buscando en los clientes de este gimnasio…</p> : <p className="form-help">{clients.length === 0 ? "No hay coincidencias. Prueba otro nombre o registra el cliente en Clientes." : clients.length === 20 ? "Mostrando 20 resultados. Escribe más letras para encontrar a la persona." : `${clients.length} cliente${clients.length === 1 ? "" : "s"} encontrado${clients.length === 1 ? "" : "s"}.`}</p>}
    <ErrorMessage message={error} />
  </div>;
}
