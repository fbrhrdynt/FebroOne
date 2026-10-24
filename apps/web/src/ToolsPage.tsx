import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Calculator, Save, Printer } from "lucide-react";
import {
  calculators,
  calculate,
  conversions,
  localDay,
} from "../../../packages/shared/domain";
import * as store from "./store";
import { Button, PageHeader, Field, ErrorText } from "./ui";
export default function ToolsPage() {
  const [tab, setTab] = useState("calc");
  const [key, setKey] = useState("cylinder");
  const [inputs, setInputs] = useState<Record<string, number>>({});
  const [result, setResult] = useState<any>();
  const [error, setError] = useState<unknown>();
  const [group, setGroup] = useState<keyof typeof conversions>("pressure");
  const [from, setFrom] = useState("Pa");
  const [to, setTo] = useState("bar");
  const [value, setValue] = useState("1");
  const q = useQueryClient();
  const c = calculators.find((c) => c.key === key)!;
  const units = conversions[group] as Record<string, number>;
  return (
    <>
      <PageHeader
        eyebrow="Tools"
        title="Engineering desk"
        description="Rumus yang terlihat. Satuan yang jelas. Hasil yang dapat ditelusuri."
      />
      <div className="tabs page-tabs">
        <button
          className={tab === "calc" ? "active" : ""}
          onClick={() => setTab("calc")}
        >
          Calculators
        </button>
        <button
          className={tab === "convert" ? "active" : ""}
          onClick={() => setTab("convert")}
        >
          Unit converter
        </button>
        <Link to="/records/calculations">Riwayat tersimpan</Link>
        <Link to="/records/integrations">App launcher</Link>
      </div>
      <ErrorText error={error} />
      {tab === "calc" ? (
        <div className="tools-layout">
          <div className="tool-menu">
            {calculators.map((x) => (
              <button
                className={x.key === key ? "active" : ""}
                key={x.key}
                onClick={() => {
                  setKey(x.key);
                  setInputs({});
                  setResult(null);
                  setError(null);
                }}
              >
                <Calculator size={17} />
                {x.name}
              </button>
            ))}
          </div>
          <section className="panel">
            <h2>{c.name}</h2>
            <div className="formula">{c.formula}</div>
            <form
              className="form-stack"
              onSubmit={(e) => {
                e.preventDefault();
                try {
                  setResult(calculate(key, inputs));
                  setError(null);
                } catch (e) {
                  setError(e);
                }
              }}
            >
              {c.inputs.map((f) => (
                <Field key={f.key} label={f.label + " (" + f.unit + ")"}>
                  <input
                    type="number"
                    step="any"
                    min={f.min}
                    required
                    value={inputs[f.key] ?? ""}
                    onChange={(e) =>
                      setInputs({ ...inputs, [f.key]: Number(e.target.value) })
                    }
                  />
                </Field>
              ))}
              <Button type="submit">Hitung</Button>
            </form>
            <p className="hint">Asumsi: {c.assumptions}</p>
            {result && (
              <div className="calculation-result">
                <span>Hasil</span>
                <strong>
                  {result.result.toPrecision(8)} <small>{result.unit}</small>
                </strong>
                <ol>
                  {result.steps.map((s: string) => (
                    <li key={s}>{s}</li>
                  ))}
                </ol>
                <div className="row-actions">
                  <Button
                    variant="outline"
                    onClick={async () => {
                      await store.saveRecord({
                        kind: "calculations",
                        title: c.name,
                        tags: [],
                        data: {
                          date: localDay(),
                          formula: result.formula,
                          inputs: result.steps.join("\n"),
                          result: result.result + " " + result.unit,
                          assumptions: result.assumptions,
                        },
                      });
                      await q.invalidateQueries();
                      setError("Perhitungan disimpan di riwayat.");
                    }}
                  >
                    <Save size={16} />
                    Simpan
                  </Button>
                  <Button variant="outline" onClick={() => window.print()}>
                    <Printer size={16} />
                    PDF / cetak
                  </Button>
                </div>
              </div>
            )}
          </section>
        </div>
      ) : (
        <section className="panel narrow">
          <div className="form-stack">
            <Field label="Besaran">
              <select
                value={group}
                onChange={(e) => {
                  const g = e.target.value as keyof typeof conversions;
                  setGroup(g);
                  setFrom(Object.keys(conversions[g])[0]);
                  setTo(Object.keys(conversions[g])[1]);
                }}
              >
                {Object.keys(conversions).map((g) => (
                  <option key={g}>{g}</option>
                ))}
              </select>
            </Field>
            <Field label="Nilai">
              <input
                type="number"
                step="any"
                value={value}
                onChange={(e) => setValue(e.target.value)}
              />
            </Field>
            <div className="form-grid">
              <Field label="Dari">
                <select value={from} onChange={(e) => setFrom(e.target.value)}>
                  {Object.keys(units).map((u) => (
                    <option key={u}>{u}</option>
                  ))}
                </select>
              </Field>
              <Field label="Ke">
                <select value={to} onChange={(e) => setTo(e.target.value)}>
                  {Object.keys(units).map((u) => (
                    <option key={u}>{u}</option>
                  ))}
                </select>
              </Field>
            </div>
            <div className="calculation-result">
              <span>Hasil konversi</span>
              <strong>
                {((Number(value) * units[from]) / units[to]).toPrecision(9)}{" "}
                <small>{to}</small>
              </strong>
              <p>
                {value} × {units[from]} ÷ {units[to]}
              </p>
            </div>
            <p className="hint">
              Faktor SI; galon adalah US gallon dan bbl = 42 US gallon. Konversi
              densitas tidak mengasumsikan jenis fluida.
            </p>
          </div>
        </section>
      )}
      <p className="hint">
        Referensi: NIST SP 811 untuk konversi SI; hukum Ohm, daya AC tiga-fasa,
        dan definisi mekanika dasar. Verifikasi input dan kondisi lapangan
        sebelum menggunakan hasil.
      </p>
    </>
  );
}
