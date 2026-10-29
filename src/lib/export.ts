import { db } from "./supabase";
import { salesCsv } from "./domain";
import type { Sale } from "./domain";
export async function exportSales(gymId: string, from: string, to: string) {
  const rows: Sale[] = [];
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await db
      .from("sales")
      .select("*")
      .eq("gym_id", gymId)
      .eq("status", "closed")
      .gte("closed_at", from + "T00:00:00-05:00")
      .lte("closed_at", to + "T23:59:59.999999-05:00")
      .order("closed_at")
      .order("id")
      .range(offset, offset + 499);
    if (error) throw error;
    rows.push(...data);
    if (rows.length > 50000)
      throw new Error(
        "El rango supera 50.000 ventas. Exporta un período menor.",
      );
    if (data.length < 500) break;
  }
  const url = URL.createObjectURL(
    new Blob([salesCsv(rows)], { type: "text/csv;charset=utf-8" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = "ventas-" + from + "-" + to + ".csv";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
