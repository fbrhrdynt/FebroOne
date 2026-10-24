import { txSchema } from "../../../packages/shared/domain";
export async function parseFinanceFile(file: File) {
  if (file.size > 1048576) throw new Error("File maksimal 1 MB");
  if (file.name.toLowerCase().endsWith(".xlsx")) {
    const { default: ExcelJS } = await import("exceljs");
    const w = new ExcelJS.Workbook();
    await w.xlsx.load(await file.arrayBuffer());
    const sheet = w.worksheets[0];
    if (!sheet || sheet.rowCount > 1001) throw new Error("Maksimal 1000 baris");
    const headers = (sheet.getRow(1).values as any[]).slice(1).map(String);
    const result: any[] = [];
    sheet.eachRow((r, i) => {
      if (i === 1) return;
      const obj: any = {};
      headers.forEach((h, j) => {
        const c = r.getCell(j + 1);
        if (c.type === ExcelJS.ValueType.Formula)
          throw new Error("Formula Excel tidak didukung; gunakan nilai biasa");
        obj[h] =
          c.value instanceof Date ? c.value.toISOString().slice(0, 10) : c.text;
      });
      result.push(obj);
    });
    return result;
  }
  const Papa = (await import("papaparse")).default;
  const parsed = Papa.parse<any>(await file.text(), {
    header: true,
    skipEmptyLines: true,
  });
  if (parsed.errors.length) throw new Error("Format CSV tidak valid");
  if (parsed.data.length > 1000) throw new Error("Maksimal 1000 baris");
  return parsed.data;
}
export async function prepareImport(rows: any[]) {
  return Promise.all(
    rows.map(async (raw) => {
      const canonical = {
        kind: raw.kind,
        accountId: raw.accountId,
        ...(raw.toAccountId ? { toAccountId: raw.toAccountId } : {}),
        amount: String(raw.amount),
        category: raw.category || "Uncategorized",
        date: raw.date,
        description: raw.description || "",
      };
      if (!crypto.subtle)
        throw new Error(
          "Impor membutuhkan HTTPS (tersedia pada web trial yang diterbitkan).",
        );
      const hash = Array.from(
        new Uint8Array(
          await crypto.subtle.digest(
            "SHA-256",
            new TextEncoder().encode(
              JSON.stringify({ ...canonical, reference: raw.reference || "" }),
            ),
          ),
        ),
      )
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("")
        .slice(0, 32);
      const key =
        hash.slice(0, 8) +
        "-" +
        hash.slice(8, 12) +
        "-4" +
        hash.slice(13, 16) +
        "-8" +
        hash.slice(17, 20) +
        "-" +
        hash.slice(20, 32);
      return txSchema.parse({ ...canonical, key });
    }),
  );
}
export async function exportExcel(rows: any[]) {
  const { default: ExcelJS } = await import("exceljs");
  const w = new ExcelJS.Workbook();
  const s = w.addWorksheet("Transactions");
  s.columns = [
    "kind",
    "accountId",
    "toAccountId",
    "amount",
    "category",
    "date",
    "description",
    "reference",
  ].map((key) => ({
    header: key,
    key,
    width: key === "description" ? 40 : 24,
  }));
  for (const r of rows.filter(
    (r) => ["income", "expense", "transfer"].includes(r.kind) && !r.reversed,
  ))
    s.addRow({ ...r, reference: r.id });
  s.getRow(1).font = { bold: true };
  const bytes = await w.xlsx.writeBuffer();
  const url = URL.createObjectURL(
    new Blob([bytes as BlobPart], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = "febro-one-transactions.xlsx";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
