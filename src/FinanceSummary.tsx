import { useEffect, useState } from "react";
import { db } from "./lib/supabase";
import { check } from "./lib/check";
import { money } from "./lib/domain";
import { ErrorMessage } from "./components";

type Summary = {
  starts_on: string; ends_on: string; sales: number; income: number; expenses: number;
  assets: number; unvalued: number;
  days: { day: string; income: number; expenses: number }[];
};
export default function FinanceSummary({ gymId, version, onExpense }: {
  gymId: string; version: number; onExpense: () => void;
}) {
  const [period, setPeriod] = useState("month");
  const [data, setData] = useState<Summary | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let alive = true;
    void (async () => {
      await Promise.resolve();
      if (!alive) return;
      setData(null);
      setError("");
      const result = await db.rpc("finance_summary", { g: gymId, period });
      check(result);
      if (alive) setData(result.data);
    })().catch((e) => { if (alive) setError(e.message); });
    return () => { alive = false; };
  }, [gymId, period, version]);
  const max = Math.max(1, ...(data?.days.flatMap(d => [d.income, d.expenses]) || []));
  return <section className="panel finance-summary">
    <div className="panel-heading">
      <h2>Ingresos y gastos</h2>
      <button className="secondary" onClick={onExpense}>Registrar gasto</button>
    </div>
    <label>Período
      <select value={period} onChange={e => setPeriod(e.target.value)}>
        <option value="day">Hoy</option><option value="week">Esta semana</option><option value="month">Este mes</option>
      </select>
    </label>
    <ErrorMessage message={error} />
    {!data && !error && <p role="status">Cargando resumen financiero…</p>}
    {data && <>
      <p className="muted small">{data.starts_on} a {data.ends_on} · horario de Bogotá</p>
      <div className="stats">
        <div className="stat"><span>Ingresos</span><strong>{money(data.sales + data.income)}</strong><small>Ventas cobradas + ingresos adicionales</small></div>
        <div className="stat"><span>Gastos</span><strong>{money(data.expenses)}</strong><small>Compras y otros egresos registrados</small></div>
        <div className="stat"><span>Balance del período</span><strong>{money(data.sales + data.income - data.expenses)}</strong><small>Ingresos menos gastos</small></div>
        <div className="stat"><span>Valor de las máquinas</span><strong>{money(data.assets)}</strong><small>Activos registrados · excluye retiradas · {data.unvalued} sin valorar</small></div>
      </div>
      <p className="small">Gráfica diaria: <span className="chart-key income-key" /> Ingresos <span className="chart-key expense-key" /> Gastos</p>
      <div className="finance-chart" role="img" aria-label="Comparación diaria de ingresos y gastos. Los valores exactos están en la tabla siguiente.">
        {data.days.map(d => <div className="chart-day" key={d.day} title={`${d.day}: ingresos ${money(d.income)}, gastos ${money(d.expenses)}`}>
          <div className="chart-bars"><i className="income-bar" style={{ height: `${d.income / max * 100}%` }} /><i className="expense-bar" style={{ height: `${d.expenses / max * 100}%` }} /></div>
          <small>{d.day.slice(8)}</small>
        </div>)}
      </div>
      <details><summary>Ver valores por día</summary><div className="table-wrap"><table><thead><tr><th>Fecha</th><th>Ingresos</th><th>Gastos</th></tr></thead><tbody>{data.days.map(d => <tr key={d.day}><td>{d.day}</td><td>{money(d.income)}</td><td>{money(d.expenses)}</td></tr>)}</tbody></table></div></details>
      <p className="muted small">El valor de las máquinas es una estimación registrada por el gimnasio y se muestra aparte del balance de caja.</p>
    </>}
  </section>;
}
