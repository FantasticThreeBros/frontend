
"use client";
import { useState } from "react";
import { usePassport } from "@/hooks/usePassport";
import { KeyRound, Check, Ban, AlertCircle } from "lucide-react";

interface Props {
  onToast: (m: string, t?: "success"|"error"|"info", sig?: string) => void;
}

export function VerifierPanel({ onToast }: Props) {
  const { registerVerifier, connected } = usePassport();
  const [verifierKey, setVerifierKey] = useState("");
  const [loading, setLoading] = useState(false);

  const doRegister = async (isActive: boolean) => {
    if (!verifierKey.trim()) { onToast("Enter a verifier public key", "error"); return; }
    setLoading(true);
    try {
      const sig = await registerVerifier(verifierKey.trim(), isActive);
      onToast(`Verifier ${isActive ? "activated" : "deactivated"}!`, "success", sig);
      setVerifierKey("");
    } catch (e: any) {
      onToast(e?.message ?? "Failed", "error");
    } finally { setLoading(false); }
  };

  return (
    <div className="card" style={{ padding: 24 }}>
      <div className="section-title">
        <KeyRound size={20} /> Manage Verifier
      </div>
      <p style={{ fontSize: 14, color: "var(--muted)", marginBottom: 24 }}>
        Trusted verifier programs own the credential accounts that users enroll with.
      </p>
      <label className="label">Verifier Program Address</label>
      <input
        className="input mono"
        value={verifierKey}
        onChange={e => setVerifierKey(e.target.value)}
        placeholder="Base58 public key..."
        spellCheck={false}
      />
      <div style={{ display: "flex", gap: 12, marginTop: 20 }}>
        <button className="btn btn-primary" disabled={loading || !connected} onClick={() => doRegister(true)}>
          {loading ? <span className="spinner" /> : <Check size={16} />} Register Active
        </button>
        <button className="btn btn-secondary" disabled={loading || !connected} onClick={() => doRegister(false)}>
          {loading ? <span className="spinner" /> : <Ban size={16} />} Deactivate
        </button>
      </div>
      <div style={{ marginTop: 24, padding: "12px 16px", background: "var(--surface-hover)", borderRadius: 8, border: "1px solid var(--border)", display: "flex", gap: 12 }}>
        <AlertCircle size={18} color="var(--muted)" style={{ flexShrink: 0 }} />
        <p style={{ fontSize: 13, color: "var(--text)", lineHeight: 1.5 }}>
          Only the registry admin can register verifiers. The verifier key must be the program ID that owns credential accounts.
        </p>
      </div>
    </div>
  );
}
