"use client";
import { useState, useEffect } from "react";
import { usePassport } from "@/hooks/usePassport";
import { KeyRound, Check, Ban, AlertCircle } from "lucide-react";
import { explainError } from "@/lib/passportClient";
import { MOCK_CONSUMER_ID, CIVIC_GATEWAY_ID, UNIQUENESS_NETWORK } from "@/lib/pdas";

interface Props {
  onToast: (m: string, t?: "success"|"error"|"info", sig?: string) => void;
}

export function VerifierPanel({ onToast }: Props) {
  const { registerVerifier, fetchAllVerifiers, connected, passport } = usePassport();
  const [verifierKey, setVerifierKey] = useState("");
  const [network, setNetwork] = useState(UNIQUENESS_NETWORK);
  const [loading, setLoading] = useState(false);
  const [configs, setConfigs] = useState<any[]>([]);

  const load = async () => { try { setConfigs(await fetchAllVerifiers()); } catch { /* none yet */ } };
  useEffect(() => { if (passport) load(); }, [passport]); // eslint-disable-line react-hooks/exhaustive-deps

  const doRegister = async (isActive: boolean) => {
    if (!verifierKey.trim() || !network.trim()) { onToast("Enter the verifier program and the network", "error"); return; }
    setLoading(true);
    try {
      const sig = await registerVerifier(verifierKey.trim(), network.trim(), isActive);
      onToast(`Verifier ${isActive ? "activated" : "deactivated"}!`, "success", sig);
      await load();
    } catch (e: any) {
      onToast(explainError(e), "error");
    } finally { setLoading(false); }
  };

  return (
    <div className="card" style={{ padding: 24 }}>
      <div className="section-title">
        <KeyRound size={20} /> Manage Verifier
      </div>
      <p style={{ fontSize: 14, color: "var(--muted)", marginBottom: 24 }}>
        Trust a credential issuer: the program that owns the pass accounts <b>and</b> the one issuing network.
        Pinning the network matters, since anyone can create their own network and mint a pass on it.
      </p>

      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        <button className="btn btn-secondary" onClick={() => { setVerifierKey(CIVIC_GATEWAY_ID.toBase58()); setNetwork(UNIQUENESS_NETWORK); }}>
          Preset: Civic gateway + Uniqueness
        </button>
        <button className="btn btn-secondary" onClick={() => { setVerifierKey(MOCK_CONSUMER_ID.toBase58()); setNetwork(UNIQUENESS_NETWORK); }}>
          Preset: Demo issuer
        </button>
      </div>

      <label className="label">Verifier Program Address</label>
      <input className="input mono" value={verifierKey} onChange={e => setVerifierKey(e.target.value)}
        placeholder="Program that owns the pass accounts..." spellCheck={false} />
      <label className="label" style={{ marginTop: 16 }}>Gatekeeper Network (issuing network)</label>
      <input className="input mono" value={network} onChange={e => setNetwork(e.target.value)}
        placeholder="Network address to trust..." spellCheck={false} />

      <div style={{ display: "flex", gap: 12, marginTop: 20 }}>
        <button className="btn btn-primary" disabled={loading || !connected} onClick={() => doRegister(true)}>
          {loading ? <span className="spinner" /> : <Check size={16} />} Register Active
        </button>
        <button className="btn btn-secondary" disabled={loading || !connected} onClick={() => doRegister(false)}>
          {loading ? <span className="spinner" /> : <Ban size={16} />} Deactivate
        </button>
      </div>

      {configs.length > 0 && (
        <div style={{ marginTop: 24 }}>
          <div className="label">Registered ({configs.length})</div>
          {configs.map((c, i) => (
            <div key={i} className="mono" style={{ fontSize: 12, color: "var(--text)", padding: "6px 0", borderBottom: "1px solid var(--border)" }}>
              {c.account.verifierKey.toBase58().slice(0, 10)}... / {c.account.gatekeeperNetwork.toBase58().slice(0, 10)}...{" "}
              <span className={`badge ${c.account.isActive ? "badge-green" : "badge-red"}`}>{c.account.isActive ? "Active" : "Inactive"}</span>
            </div>
          ))}
        </div>
      )}

      <div style={{ marginTop: 24, padding: "12px 16px", background: "var(--surface-hover)", borderRadius: 8, border: "1px solid var(--border)", display: "flex", gap: 12 }}>
        <AlertCircle size={18} color="var(--muted)" style={{ flexShrink: 0 }} />
        <p style={{ fontSize: 13, color: "var(--text)", lineHeight: 1.5 }}>
          Only the registry admin can register verifiers.
        </p>
      </div>
    </div>
  );
}
