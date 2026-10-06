
"use client";
import { useState, useEffect, useCallback } from "react";
import dynamic from "next/dynamic";
import { useWallet } from "@solana/wallet-adapter-react";
import { usePassport } from "@/hooks/usePassport";
import { RegistryPanel } from "@/components/RegistryPanel";
import { VerifierPanel } from "@/components/VerifierPanel";
import { EnrollPanel } from "@/components/EnrollPanel";
import { VerifyPanel } from "@/components/VerifyPanel";
import { EnrollmentsTable } from "@/components/EnrollmentsTable";
import { NullifiersTable } from "@/components/NullifiersTable";
import { Toast, ToastType } from "@/components/Toast";
import { LayoutDashboard, Settings, Fingerprint, ShieldCheck, Database, RefreshCcw, Activity } from "lucide-react";

const WalletMultiButton = dynamic(
  () => import("@solana/wallet-adapter-react-ui").then(m => m.WalletMultiButton),
  { ssr: false }
);

const TABS = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "admin",    label: "Admin",    icon: Settings },
  { id: "enroll",   label: "Enroll",   icon: Fingerprint },
  { id: "verify",   label: "Verify",   icon: ShieldCheck },
  { id: "data",     label: "Explorer", icon: Database },
];

interface ToastState { id: number; message: string; type: ToastType; sig?: string; }

export default function Home() {
  const { connected } = useWallet();
  const { fetchRegistry, fetchAllEnrollments, fetchAllNullifiers } = usePassport();

  const [activeTab, setActiveTab] = useState("overview");
  const [registry, setRegistry] = useState<any>(null);
  const [enrollments, setEnrollments] = useState<any[]>([]);
  const [nullifiers, setNullifiers] = useState<any[]>([]);
  const [toasts, setToasts] = useState<ToastState[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const toast = useCallback((message: string, type: ToastType = "info", sig?: string) => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type, sig }]);
  }, []);

  const refresh = useCallback(async () => {
    if (!connected) return;
    setRefreshing(true);
    try {
      const [reg, enrols, nulls] = await Promise.all([
        fetchRegistry(),
        fetchAllEnrollments(),
        fetchAllNullifiers(),
      ]);
      setRegistry(reg);
      setEnrollments(enrols);
      setNullifiers(nulls);
    } catch (e: any) {
      console.error("Refresh error:", e);
    } finally { setRefreshing(false); }
  }, [connected, fetchRegistry, fetchAllEnrollments, fetchAllNullifiers]);

  useEffect(() => { if (connected) refresh(); }, [connected, refresh]);

  return (
    <div style={{ minHeight: "100vh", position: "relative", zIndex: 1, paddingBottom: 64 }}>
      {/* Header */}
      <header style={{
        background: "var(--surface)",
        borderBottom: "1px solid var(--border)",
        position: "sticky", top: 0, zIndex: 100,
        padding: "0 32px",
      }}>
        <div style={{ maxWidth: 1280, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", height: 64 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 8,
              background: "var(--accent)", color: "var(--accent-text)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <Fingerprint size={20} />
            </div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 600, letterSpacing: "-0.01em" }}>Passport Protocol</div>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {connected && (
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginRight: 8 }}>
                <Activity size={14} color="var(--success)" />
                <span style={{ fontSize: 13, color: "var(--muted)", fontWeight: 500 }}>Devnet</span>
              </div>
            )}
            <button
              onClick={refresh}
              disabled={!connected || refreshing}
              className="btn btn-secondary"
              style={{ padding: "7px 12px", height: 36 }}
            >
              {refreshing ? <span className="spinner" /> : <RefreshCcw size={16} />}
            </button>
            <WalletMultiButton />
          </div>
        </div>
      </header>

      {/* Stats bar */}
      {connected && registry && (
        <div style={{ background: "var(--bg)", borderBottom: "1px solid var(--border)", padding: "16px 32px" }}>
          <div style={{ maxWidth: 1280, margin: "0 auto", display: "flex", gap: 48, overflowX: "auto" }}>
            {[
              { label: "Enrolled Identities", value: enrollments.length },
              { label: "Nullifiers Used",      value: nullifiers.length },
              { label: "Next Leaf Index",      value: registry.nextLeafIndex },
              { label: "Registry Status",      value: registry.isFrozen ? "Frozen" : "Active" },
            ].map(s => (
              <div key={s.label} style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: "max-content" }}>
                <div style={{ fontSize: 12, color: "var(--muted)", fontWeight: 500 }}>{s.label}</div>
                <div style={{ fontSize: 20, fontWeight: 600, color: "var(--text)" }}>{s.value}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ maxWidth: 1280, margin: "0 auto", padding: "32px 32px" }}>
        {!connected ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "60vh", gap: 24 }}>
            <div style={{ textAlign: "center" }}>
              <h1 style={{ fontSize: 40, fontWeight: 700, letterSpacing: "-0.03em", marginBottom: 16 }}>
                Proof-of-Personhood for Solana apps
              </h1>
              <p style={{ color: "var(--muted)", fontSize: 18, maxWidth: 600, lineHeight: 1.6, margin: "0 auto" }}>
                One human, one identity. Connect your wallet to interact with the on-chain registry.
              </p>
            </div>
            <WalletMultiButton style={{ marginTop: 8 }} />
            
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 24, marginTop: 48, width: "100%", maxWidth: 900 }}>
              {[
                { icon: Fingerprint, title: "Enroll Once", desc: "Commit a hash of your Civic Pass to the Merkle tree. No personal data on-chain." },
                { icon: ShieldCheck, title: "Prove Personhood", desc: "dApps verify you're human via CPI; per-app nullifiers prevent replay." },
                { icon: Activity, title: "Pseudonymous", desc: "Only a sha256 commitment is stored. Zero-knowledge proofs are the planned next step." },
              ].map(f => (
                <div key={f.title} className="card" style={{ padding: 24 }}>
                  <f.icon size={24} style={{ marginBottom: 16, color: "var(--text)" }} />
                  <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 8 }}>{f.title}</div>
                  <div style={{ fontSize: 14, color: "var(--muted)", lineHeight: 1.6 }}>{f.desc}</div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <>
            {/* Tab bar */}
            <div style={{ display: "flex", gap: 8, marginBottom: 32, borderBottom: "1px solid var(--border)", paddingBottom: 0 }}>
              {TABS.map(t => (
                <button key={t.id} className={`tab ${activeTab === t.id ? "active" : ""}`} onClick={() => setActiveTab(t.id)}>
                  <t.icon size={16} /> {t.label}
                </button>
              ))}
            </div>

            {/* Tab content */}
            {activeTab === "overview" && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
                <RegistryPanel registry={registry} onRefresh={refresh} onToast={toast} />
                <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
                  <div className="card" style={{ padding: 24 }}>
                    <div className="section-title"><Database size={20}/> How it Works</div>
                    <ol style={{ fontSize: 14, color: "var(--muted)", lineHeight: 2.2, paddingLeft: 16 }}>
                      <li><b style={{ color: "var(--text)" }}>Admin</b> initializes the registry and trusts a verifier program and its Civic network</li>
                      <li><b style={{ color: "var(--text)" }}>User</b> holds a Civic Pass; commitment = sha256(pass address)</li>
                      <li><b style={{ color: "var(--text)" }}>Enroll</b>: pass checked (owner, network, active, expiry, your wallet), commitment added to the Merkle tree</li>
                      <li><b style={{ color: "var(--text)" }}>dApp</b> calls <code>verify_personhood</code> via CPI → creates nullifier</li>
                      <li><b style={{ color: "var(--text)" }}>Replay</b> fails with <code>NullifierAlreadyUsed</code></li>
                    </ol>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "admin" && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
                <RegistryPanel registry={registry} onRefresh={refresh} onToast={toast} />
                <VerifierPanel onToast={toast} />
              </div>
            )}

            {activeTab === "enroll" && (
              <div style={{ maxWidth: 640 }}>
                <EnrollPanel onToast={toast} onRefresh={refresh} />
              </div>
            )}

            {activeTab === "verify" && (
              <div style={{ maxWidth: 640 }}>
                <VerifyPanel onToast={toast} onRefresh={refresh} />
              </div>
            )}

            {activeTab === "data" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
                <EnrollmentsTable enrollments={enrollments} />
                <NullifiersTable nullifiers={nullifiers} />
              </div>
            )}
          </>
        )}
      </div>

      {/* Toasts */}
      <div style={{ position: "fixed", bottom: 24, right: 24, zIndex: 9999, display: "flex", flexDirection: "column", gap: 12 }}>
        {toasts.map(t => (
          <Toast key={t.id} message={t.message} type={t.type} txSig={t.sig}
            onClose={() => setToasts(prev => prev.filter(x => x.id !== t.id))} />
        ))}
      </div>
    </div>
  );
}
