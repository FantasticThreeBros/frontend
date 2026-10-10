"use client";
import { useState } from "react";
import { usePassport } from "@/hooks/usePassport";
import { explainError } from "@/lib/passportClient";
import { Lock, Unlock } from "lucide-react";

export function FreezePanel({ onToast, onRefresh }: { onToast: (m: string, t?: "success" | "error" | "info", sig?: string) => void; onRefresh: () => void }) {
  const { freezeIdentity, connected } = usePassport();
  const [commitment, setCommitment] = useState("");
  const [busy, setBusy] = useState(false);
  const run = async (frozen: boolean) => {
    if (commitment.trim().length !== 64) { onToast("Paste the 64-character identity hash (see the Explorer tab)", "error"); return; }
    setBusy(true);
    try { onToast(`Identity ${frozen ? "frozen" : "unfrozen"}`, "success", await freezeIdentity(commitment.trim(), frozen)); onRefresh(); }
    catch (e: any) { onToast(explainError(e), "error"); } finally { setBusy(false); }
  };
  return (
    <div className="card" style={{ padding: 24 }}>
      <div className="section-title"><Lock size={20} /> Freeze one identity</div>
      <p style={{ fontSize: 14, color: "var(--muted)", marginBottom: 16 }}>A frozen identity can no longer pass verification. Copy its hash from the Explorer tab.</p>
      <input className="input mono" value={commitment} onChange={(e) => setCommitment(e.target.value)} placeholder="64-character identity hash" spellCheck={false} />
      <div style={{ display: "flex", gap: 12, marginTop: 16 }}>
        <button className="btn btn-secondary" disabled={busy || !connected} onClick={() => run(true)}><Lock size={16} /> Freeze</button>
        <button className="btn btn-secondary" disabled={busy || !connected} onClick={() => run(false)}><Unlock size={16} /> Unfreeze</button>
      </div>
    </div>
  );
}
