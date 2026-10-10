
"use client";
import { useState, useEffect } from "react";
import { usePassport } from "@/hooks/usePassport";
import { Fingerprint, CheckCircle2, ArrowUpRight, Copy } from "lucide-react";
import { explainError, PassMode } from "@/lib/passportClient";
import { UNIQUENESS_NETWORK } from "@/lib/pdas";

interface Props {
  onToast: (m: string, t?: "success"|"error"|"info", sig?: string) => void;
  onRefresh: () => void;
}

export function EnrollPanel({ onToast, onRefresh }: Props) {
  const { enrollIdentity, verifierStatus, connected } = usePassport();
  const [status, setStatus] = useState<"active" | "inactive" | "missing" | null>(null);
  const [mode, setMode] = useState<PassMode>("demo");
  const [network, setNetwork] = useState(UNIQUENESS_NETWORK);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ commitment: string; leafIndex: number; sig: string } | null>(null);

  // Tell the user up front whether the registry trusts this pass source (admin must register it).
  useEffect(() => {
    let live = true;
    verifierStatus(mode, network.trim()).then((st) => { if (live) setStatus(st); });
    return () => { live = false; };
  }, [mode, network, verifierStatus]);

  const doEnroll = async () => {
    if (!network.trim()) { onToast("Enter the Civic network", "error"); return; }
    setLoading(true);
    setResult(null);
    try {
      const r = await enrollIdentity(mode, network.trim());
      try { localStorage.setItem("passport:commitment", r.commitment); } catch { /* optional */ }
      setResult(r);
      onToast(`Enrolled successfully`, "success", r.sig);
      onRefresh();
    } catch (e: any) {
      onToast(explainError(e), "error");
    } finally { setLoading(false); }
  };

  const copyHex = () => {
    if(result) {
      navigator.clipboard.writeText(result.commitment);
      onToast("Copied to clipboard", "success");
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div className="card" style={{ padding: 24 }}>
        <div className="section-title">
          <Fingerprint size={20} /> Enroll Identity
        </div>
        <p style={{ fontSize: 14, color: "var(--muted)", marginBottom: 20, lineHeight: 1.6 }}>
          Reads a Civic Pass issued to <b>your wallet</b>, derives your commitment (sha256 of the pass address)
          and adds it to the on-chain Merkle tree. The registry checks the pass owner, issuing network,
          active state, expiry, and that the pass is yours.
        </p>
        <label className="label">Pass source</label>
        <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
          <button className={`btn ${mode === "demo" ? "btn-primary" : "btn-secondary"}`} onClick={() => setMode("demo")}>
            Demo pass (mock issuer)
          </button>
          <button className={`btn ${mode === "civic" ? "btn-primary" : "btn-secondary"}`} onClick={() => setMode("civic")}>
            My real Civic Pass
          </button>
        </div>
        <p style={{ fontSize: 13, color: "var(--muted)", marginBottom: 16, lineHeight: 1.5 }}>
          {mode === "demo"
            ? "A demo issuer writes a pass in Civic's exact layout for your wallet. Requires the demo issuer to be registered in the Admin tab."
            : "Uses the Civic Pass already held by your wallet on this network. Requires the Civic gateway to be registered in the Admin tab."}
        </p>
        <label className="label">Gatekeeper Network</label>
        <input className="input mono" value={network} onChange={e => setNetwork(e.target.value)} spellCheck={false} />
        {status && (
          <p style={{ fontSize: 13, marginTop: 12, color: status === "active" ? "var(--success)" : "var(--danger, #dc2626)" }}>
            {status === "active" && "Registered: the registry trusts this pass source."}
            {status === "inactive" && "This pass source is registered but deactivated."}
            {status === "missing" && "Not registered yet. Ask the registry admin to register it in the Admin tab first."}
          </p>
        )}
        <button className="btn btn-primary" disabled={loading || !connected || status === "missing" || status === "inactive"} onClick={doEnroll} style={{ marginTop: 20, width: "100%" }}>
          {loading ? <><span className="spinner" /> Enrolling...</> : "Enroll My Identity"}
        </button>
      </div>

      {result && (
        <div className="card" style={{ padding: 24, borderColor: "var(--success)", background: "var(--success-bg)" }}>
          <div className="section-title" style={{ color: "var(--success)" }}>
            <CheckCircle2 size={20} /> Enrollment Successful
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div>
              <div className="label" style={{ color: "var(--success)" }}>Commitment (sha256 of credential)</div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <div className="input mono" style={{ fontSize: 13, background: "var(--surface)", borderColor: "var(--success)", color: "var(--text)" }}>{result.commitment}</div>
                <button className="btn btn-secondary" onClick={copyHex} style={{ padding: "10px", borderColor: "var(--success)" }}><Copy size={16}/></button>
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <div>
                <div className="label" style={{ color: "var(--success)" }}>Leaf Index</div>
                <div className="badge badge-gray" style={{ background: "var(--surface)", border: "1px solid #a7f3d0" }}># {result.leafIndex}</div>
              </div>
              <div>
                <div className="label" style={{ color: "var(--success)" }}>Transaction</div>
                <a href={`https://explorer.solana.com/tx/${result.sig}?cluster=devnet`} target="_blank" rel="noopener noreferrer"
                  style={{ fontSize: 13, color: "var(--success)", display: "flex", alignItems: "center", gap: 4, textDecoration: "underline" }} className="mono">
                  View on Explorer <ArrowUpRight size={14} />
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
