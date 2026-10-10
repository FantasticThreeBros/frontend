"use client";
import { useState } from "react";
import { usePassport } from "@/hooks/usePassport";
import { explainError } from "@/lib/passportClient";
import { Wand2, Check } from "lucide-react";
import { RegistryPanel } from "./RegistryPanel";
import { VerifierPanel } from "./VerifierPanel";
import { FreezePanel } from "./FreezePanel";

interface Props { registry: any; onRefresh: () => void; onToast: (m: string, t?: "success" | "error" | "info", sig?: string) => void; }

export function AdminTab({ registry, onRefresh, onToast }: Props) {
  const { runQuickSetup, publicKey, connected } = usePassport();
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState<string[]>([]);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const isAdmin = !!registry && !!publicKey && registry.admin.equals(publicKey);
  const canSetup = !registry || isAdmin; // anyone can create the registry; only the admin can configure it

  const run = async () => {
    setBusy(true); setLog([]);
    try {
      const done = await runQuickSetup((m) => setLog((l) => [...l, m]));
      setLog(done.length ? done.map((d) => `Trusted: ${d}`) : ["Everything was already set up."]);
      onToast("Setup complete", "success");
      onRefresh();
    } catch (e: any) { onToast(explainError(e), "error"); } finally { setBusy(false); }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20, maxWidth: 720 }}>
      <div>
        <h1 style={{ fontSize: 28, fontWeight: 700, letterSpacing: "-0.02em", marginBottom: 6 }}>Admin</h1>
        <p style={{ color: "var(--muted)", fontSize: 15 }}>
          {registry ? <>Only the registry admin (<span className="mono">{registry.admin.toBase58().slice(0, 6)}...</span>) can change settings.</> : "The registry hasn't been created yet."}
          {registry && !isAdmin && " You are not the admin, so these buttons will be refused."}
        </p>
      </div>

      <div className="card" style={{ padding: 24 }}>
        <div className="section-title"><Wand2 size={20} /> Quick setup</div>
        <p style={{ fontSize: 15, lineHeight: 1.6, marginBottom: 16 }}>
          One click to switch the app on for everyone: create the registry if needed, and trust <b>Civic passes</b> and the <b>demo pass</b> on
          the devnet test network and the Uniqueness network. Safe to press again.
        </p>
        <button className="btn btn-primary" style={{ width: "100%" }} disabled={busy || !connected || !canSetup} onClick={run}>
          {busy ? <><span className="spinner" /> Working... approve each request in your wallet</> : "Run Quick setup"}
        </button>
        {!canSetup && <p style={{ fontSize: 13, color: "var(--danger)", marginTop: 10 }}>Connect the admin wallet to run this.</p>}
        {log.length > 0 && (
          <ul style={{ marginTop: 16, fontSize: 14, lineHeight: 1.8, listStyle: "none" }}>
            {log.map((l, i) => <li key={i} style={{ display: "flex", gap: 8, alignItems: "center" }}><Check size={14} style={{ color: "var(--success)", flexShrink: 0 }} /> {l}</li>)}
          </ul>
        )}
      </div>

      <RegistryPanel registry={registry} onRefresh={onRefresh} onToast={onToast} />
      <FreezePanel onToast={onToast} onRefresh={onRefresh} />

      <div>
        <button className="btn btn-secondary" onClick={() => setShowAdvanced(!showAdvanced)}>{showAdvanced ? "Hide" : "Show"} advanced: manage trusted issuers</button>
        {showAdvanced && <div style={{ marginTop: 16 }}><VerifierPanel onToast={onToast} /></div>}
      </div>
    </div>
  );
}
