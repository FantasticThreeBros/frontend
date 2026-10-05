
"use client";
import { Database } from "lucide-react";

interface Props { enrollments: any[]; }

export function EnrollmentsTable({ enrollments }: Props) {
  if (!enrollments.length) {
    return (
      <div className="card" style={{ padding: 48, textAlign: "center" }}>
        <Database size={32} style={{ color: "var(--border)", margin: "0 auto 16px" }} />
        <p style={{ color: "var(--muted)", fontSize: 14 }}>No enrollments yet</p>
      </div>
    );
  }

  return (
    <div className="card" style={{ overflow: "hidden" }}>
      <div className="section-title" style={{ padding: "20px 24px", marginBottom: 0, borderBottom: "1px solid var(--border)" }}>
        Enrolled Identities ({enrollments.length})
      </div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
          <thead>
            <tr style={{ background: "var(--table-header)", borderBottom: "1px solid var(--border)" }}>
              {["Leaf #", "Commitment (hex)", "Wallet", "Status"].map(h => (
                <th key={h} style={{ textAlign: "left", padding: "12px 24px", color: "var(--muted)", fontSize: 12, fontWeight: 600 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {enrollments.map((e, i) => {
              const hex = Buffer.from(e.account.commitment).toString("hex");
              return (
                <tr key={i} style={{ borderBottom: "1px solid var(--border)", background: "var(--surface)" }}>
                  <td style={{ padding: "16px 24px" }}><span className="badge badge-gray">#{e.account.leafIndex}</span></td>
                  <td style={{ padding: "16px 24px" }}><span className="mono" style={{ fontSize: 13 }} title={hex}>{hex.slice(0, 16)}...{hex.slice(-8)}</span></td>
                  <td style={{ padding: "16px 24px" }}><span className="mono" style={{ fontSize: 13 }} title={e.account.wallet.toBase58()}>{e.account.wallet.toBase58().slice(0, 12)}...</span></td>
                  <td style={{ padding: "16px 24px" }}>
                    <span className={`badge ${e.account.isFrozen ? "badge-red" : "badge-green"}`}>
                      {e.account.isFrozen ? "Frozen" : "Active"}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
