
"use client";
import { useState } from "react";
import { usePassport } from "@/hooks/usePassport";
import { Database, Lock, Unlock, Play } from "lucide-react";
import { explainError } from "@/lib/passportClient";

interface Props {
  registry: any;
  onRefresh: () => void;
  onToast: (m: string, t?: "success"|"error"|"info", sig?: string) => void;
}

export function RegistryPanel({ registry, onRefresh, onToast }: Props) {
  const { initializeRegistry, setRegistryFrozen, connected } = usePassport();
  const [loading, setLoading] = useState(false);

  const doInit = async () => {
    setLoading(true);
    try {
      const sig = await initializeRegistry();
      onToast("Registry initialized!", "success", sig);
      onRefresh();
    } catch (e: any) {
      onToast(explainError(e), "error");
    } finally { setLoading(false); }
  };

  const doFreeze = async (frozen: boolean) => {
    setLoading(true);
    try {
      const sig = await setRegistryFrozen(frozen);
      onToast(frozen ? "Registry frozen!" : "Registry unfrozen!", "success", sig);
      onRefresh();
    } catch (e: any) {
      onToast(explainError(e), "error");
    } finally { setLoading(false); }
  };

  const merkleRootHex = registry ? Buffer.from(registry.merkleRoot).toString("hex") : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {registry ? (
        <div className="card" style={{ padding: 24 }}>
          <div className="section-title">
            <Database size={20} /> Registry State
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
            <StatItem label="Admin" value={registry.admin.toBase58()} mono truncate />
            <StatItem label="Status" value={
              <span className={`badge ${registry.isFrozen ? "badge-red" : "badge-green"}`}>
                {registry.isFrozen ? "Frozen" : "Active"}
              </span>
            } />
            <StatItem label="Merkle Root" value={merkleRootHex!} mono truncate />
            <StatItem label="Next Leaf Index" value={String(registry.nextLeafIndex)} />
          </div>
          <div className="divider" />
          <div style={{ display: "flex", gap: 12 }}>
            {!registry.isFrozen ? (
              <button className="btn btn-danger" disabled={loading || !connected} onClick={() => doFreeze(true)}>
                {loading ? <span className="spinner" /> : <Lock size={16} />} Freeze Registry
              </button>
            ) : (
              <button className="btn btn-success" disabled={loading || !connected} onClick={() => doFreeze(false)}>
                {loading ? <span className="spinner" /> : <Unlock size={16} />} Unfreeze Registry
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="card" style={{ padding: 32, textAlign: "center" }}>
          <Database size={48} style={{ color: "var(--border)", margin: "0 auto 16px" }} />
          <p style={{ color: "var(--muted)", marginBottom: 24, fontSize: 15 }}>Registry not initialized yet</p>
          <button className="btn btn-primary" disabled={loading || !connected} onClick={doInit}>
            {loading ? <span className="spinner" /> : <Play size={16}/>} Initialize Registry
          </button>
        </div>
      )}
    </div>
  );
}

function StatItem({ label, value, mono, truncate }: { label: string; value: any; mono?: boolean; truncate?: boolean }) {
  return (
    <div>
      <div className="label">{label}</div>
      <div className={mono ? "mono" : ""} style={{
        fontSize: 13, color: "var(--text)",
        overflow: truncate ? "hidden" : undefined, textOverflow: truncate ? "ellipsis" : undefined, whiteSpace: truncate ? "nowrap" : undefined,
      }}>
        {value}
      </div>
    </div>
  );
}
