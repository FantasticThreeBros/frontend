
"use client";
import { ShieldCheck } from "lucide-react";

interface Props { nullifiers: any[]; }

export function NullifiersTable({ nullifiers }: Props) {
  if (!nullifiers.length) {
    return (
      <div className="card" style={{ padding: 48, textAlign: "center" }}>
        <ShieldCheck size={32} style={{ color: "var(--border)", margin: "0 auto 16px" }} />
        <p style={{ color: "var(--muted)", fontSize: 14 }}>No nullifiers yet</p>
      </div>
    );
  }

  return (
    <div className="card" style={{ overflow: "hidden" }}>
      <div className="section-title" style={{ padding: "20px 24px", marginBottom: 0, borderBottom: "1px solid var(--border)" }}>
        Nullifiers ({nullifiers.length})
      </div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
          <thead>
            <tr style={{ background: "var(--table-header)", borderBottom: "1px solid var(--border)" }}>
              {["PDA", "Created At"].map(h => (
                <th key={h} style={{ textAlign: "left", padding: "12px 24px", color: "var(--muted)", fontSize: 12, fontWeight: 600 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {nullifiers.map((n, i) => {
              const ts = new Date(n.account.createdAt.toNumber() * 1000).toLocaleString();
              return (
                <tr key={i} style={{ borderBottom: "1px solid var(--border)", background: "var(--surface)" }}>
                  <td style={{ padding: "16px 24px" }}><span className="mono" style={{ fontSize: 13 }}>{n.publicKey.toBase58()}</span></td>
                  <td style={{ padding: "16px 24px", color: "var(--muted)" }}>{ts}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
