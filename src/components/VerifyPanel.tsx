
"use client";
import { useState, useEffect } from "react";
import { usePassport } from "@/hooks/usePassport";
import { ShieldCheck, Lock, Unlock, CheckCircle2 } from "lucide-react";
import { explainError } from "@/lib/passportClient";

interface Props {
  onToast: (m: string, t?: "success"|"error"|"info", sig?: string) => void;
  onRefresh: () => void;
}

export function VerifyPanel({ onToast, onRefresh }: Props) {
  const { verifyPersonhood, freezeIdentity, fetchAllEnrollments, connected, publicKey } = usePassport();
  const [commitment, setCommitment] = useState("");
  const [loading, setLoading] = useState(false);
  const [freezeLoading, setFreezeLoading] = useState(false);
  const [txSig, setTxSig] = useState<string | null>(null);

  // Prefill with this wallet's own enrollment (falls back to the last one enrolled in this browser).
  useEffect(() => {
    if (commitment || !publicKey) return;
    (async () => {
      try {
        const mine = (await fetchAllEnrollments()).find((e: any) => e.account.wallet.equals(publicKey));
        if (mine) { setCommitment(Buffer.from(mine.account.commitment).toString("hex")); return; }
      } catch { /* fall through */ }
      try { const saved = localStorage.getItem("passport:commitment"); if (saved) setCommitment(saved); } catch { /* optional */ }
    })();
  }, [publicKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const doVerify = async () => {
    if (!commitment.trim()) { onToast("Enter commitment hex", "error"); return; }
    setLoading(true);
    setTxSig(null);
    try {
      const sig = await verifyPersonhood(commitment.trim());
      setTxSig(sig);
      onToast("Personhood verified! Nullifier created.", "success", sig);
      onRefresh();
    } catch (e: any) {
      onToast(explainError(e), "error");
    } finally { setLoading(false); }
  };

  const doFreeze = async (frozen: boolean) => {
    if (!commitment.trim()) { onToast("Enter commitment hex first", "error"); return; }
    setFreezeLoading(true);
    try {
      const sig = await freezeIdentity(commitment.trim(), frozen);
      onToast(`Identity ${frozen ? "frozen" : "unfrozen"}!`, "success", sig);
      onRefresh();
    } catch (e: any) {
      onToast(explainError(e), "error");
    } finally { setFreezeLoading(false); }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div className="card" style={{ padding: 24 }}>
        <div className="section-title">
          <ShieldCheck size={20} /> Verify Personhood (CPI)
        </div>
        <p style={{ fontSize: 14, color: "var(--muted)", marginBottom: 24, lineHeight: 1.6 }}>
          Calls the mock_consumer program which gates an action behind <code>verify_personhood</code> via CPI.
          Creates a per-dApp nullifier — replays are rejected.
        </p>

        <label className="label">Your Commitment (hex, 64 chars)</label>
        <textarea
          className="input mono"
          value={commitment}
          onChange={e => setCommitment(e.target.value)}
          placeholder="Paste your 64-char commitment hex from enrollment..."
          rows={2}
          style={{ resize: "none", lineHeight: 1.6 }}
        />

        <div style={{ display: "flex", gap: 12, marginTop: 20, flexWrap: "wrap" }}>
          <button className="btn btn-primary" disabled={loading || !connected} onClick={doVerify} style={{ flexGrow: 1 }}>
            {loading ? <span className="spinner" /> : <ShieldCheck size={16} />} Verify Personhood
          </button>
        </div>
        <div className="divider" />
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <button className="btn btn-secondary" disabled={freezeLoading || !connected} onClick={() => doFreeze(true)}>
            {freezeLoading ? <span className="spinner" /> : <Lock size={16} />} Freeze Identity
          </button>
          <button className="btn btn-secondary" disabled={freezeLoading || !connected} onClick={() => doFreeze(false)}>
            {freezeLoading ? <span className="spinner" /> : <Unlock size={16} />} Unfreeze Identity
          </button>
        </div>
      </div>

      {txSig && (
        <div className="card" style={{ padding: 24, borderColor: "var(--success)", background: "var(--success-bg)" }}>
          <div className="section-title" style={{ color: "var(--success)", marginBottom: 12 }}>
            <CheckCircle2 size={20} /> Verified Successfully
          </div>
          <p style={{ fontSize: 13, color: "var(--text)", marginBottom: 16 }}>
            A nullifier PDA was created for mock_consumer + your commitment. Replaying this call will now fail.
          </p>
          <div className="label" style={{ color: "var(--success)" }}>Transaction</div>
          <a href={`https://explorer.solana.com/tx/${txSig}?cluster=devnet`} target="_blank" rel="noopener noreferrer"
            style={{ fontSize: 13, color: "var(--success)", textDecoration: "underline" }} className="mono">
            {txSig.slice(0, 40)}...
          </a>
        </div>
      )}
    </div>
  );
}
