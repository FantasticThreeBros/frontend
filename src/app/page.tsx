"use client";
import { useState, useEffect, useCallback } from "react";
import dynamic from "next/dynamic";
import { useWallet } from "@solana/wallet-adapter-react";
import { usePassport } from "@/hooks/usePassport";
import { GetVerified } from "@/components/GetVerified";
import { AdminTab } from "@/components/AdminTab";
import { EnrollmentsTable } from "@/components/EnrollmentsTable";
import { NullifiersTable } from "@/components/NullifiersTable";
import { Toast, ToastType } from "@/components/Toast";
import { Fingerprint, ShieldCheck, Settings, Database, RefreshCcw } from "lucide-react";

const WalletMultiButton = dynamic(
  () => import("@solana/wallet-adapter-react-ui").then((m) => m.WalletMultiButton),
  { ssr: false }
);

const TABS = [
  { id: "verify", label: "Get verified", icon: ShieldCheck },
  { id: "admin", label: "Admin", icon: Settings },
  { id: "data", label: "Explorer", icon: Database },
];

interface ToastState { id: number; message: string; type: ToastType; sig?: string }

export default function Home() {
  const { connected } = useWallet();
  const { fetchRegistry, fetchAllEnrollments, fetchAllNullifiers } = usePassport();

  const [tab, setTab] = useState("verify");
  const [registry, setRegistry] = useState<any>(null);
  const [enrollments, setEnrollments] = useState<any[]>([]);
  const [nullifiers, setNullifiers] = useState<any[]>([]);
  const [toasts, setToasts] = useState<ToastState[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const toast = useCallback((message: string, type: ToastType = "info", sig?: string) => {
    setToasts((prev) => [...prev, { id: Date.now() + Math.random(), message, type, sig }]);
  }, []);

  const refresh = useCallback(async () => {
    if (!connected) return;
    setRefreshing(true);
    try {
      const [reg, en, nu] = await Promise.all([fetchRegistry(), fetchAllEnrollments(), fetchAllNullifiers()]);
      setRegistry(reg); setEnrollments(en); setNullifiers(nu);
    } catch (e) { console.error("Refresh error:", e); } finally { setRefreshing(false); }
  }, [connected, fetchRegistry, fetchAllEnrollments, fetchAllNullifiers]);

  useEffect(() => { if (connected) refresh(); }, [connected, refresh]);

  return (
    <div style={{ minHeight: "100vh", paddingBottom: 64 }}>
      <header style={{ background: "var(--surface)", borderBottom: "1px solid var(--border)", position: "sticky", top: 0, zIndex: 100, padding: "0 24px" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", height: 64 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: "var(--accent)", color: "var(--accent-text)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Fingerprint size={20} />
            </div>
            <div style={{ fontSize: 16, fontWeight: 600 }}>Solana Passport</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {connected && (
              <button onClick={refresh} disabled={refreshing} className="btn btn-secondary" style={{ padding: "7px 12px", height: 36 }} title="Refresh">
                {refreshing ? <span className="spinner" /> : <RefreshCcw size={16} />}
              </button>
            )}
            <WalletMultiButton />
          </div>
        </div>
      </header>

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "32px 24px" }}>
        {!connected ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 28, minHeight: "60vh", justifyContent: "center", textAlign: "center" }}>
            <div>
              <h1 style={{ fontSize: 40, fontWeight: 700, letterSpacing: "-0.03em", marginBottom: 12 }}>Prove you're one real person</h1>
              <p style={{ color: "var(--muted)", fontSize: 18, maxWidth: 520, lineHeight: 1.6, margin: "0 auto" }}>
                Apps on Solana can check you're a unique human, without collecting your ID.
              </p>
            </div>
            <div style={{ display: "flex", gap: 24, flexWrap: "wrap", justifyContent: "center", fontSize: 15, color: "var(--muted)" }}>
              <span><b style={{ color: "var(--text)" }}>1</b> Connect</span>
              <span><b style={{ color: "var(--text)" }}>2</b> Get a pass</span>
              <span><b style={{ color: "var(--text)" }}>3</b> Join</span>
              <span><b style={{ color: "var(--text)" }}>4</b> Verify</span>
            </div>
            <WalletMultiButton />
            <p style={{ fontSize: 13, color: "var(--muted)" }}>Runs on Solana devnet. Pseudonymous: your wallet stays visible, your ID never is.</p>
          </div>
        ) : (
          <>
            <div style={{ display: "flex", gap: 8, marginBottom: 28, borderBottom: "1px solid var(--border)" }}>
              {TABS.map((t) => (
                <button key={t.id} className={`tab ${tab === t.id ? "active" : ""}`} onClick={() => { setTab(t.id); if (t.id !== "verify") refresh(); }}>
                  <t.icon size={16} /> {t.label}
                </button>
              ))}
            </div>

            {tab === "verify" && <GetVerified onToast={toast} onGoAdmin={() => { setTab("admin"); refresh(); }} onChanged={refresh} />}
            {tab === "admin" && <AdminTab registry={registry} onRefresh={refresh} onToast={toast} />}
            {tab === "data" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
                <p style={{ color: "var(--muted)", fontSize: 15 }}>
                  Everything below is public on-chain data: who joined and which apps they've used.
                  {registry && ` ${enrollments.length} joined, ${nullifiers.length} app uses.`}
                </p>
                <EnrollmentsTable enrollments={enrollments} />
                <NullifiersTable nullifiers={nullifiers} />
              </div>
            )}
          </>
        )}
      </div>

      <div style={{ position: "fixed", bottom: 24, right: 24, zIndex: 9999, display: "flex", flexDirection: "column", gap: 12 }}>
        {toasts.map((t) => (
          <Toast key={t.id} message={t.message} type={t.type} txSig={t.sig} onClose={() => setToasts((prev) => prev.filter((x) => x.id !== t.id))} />
        ))}
      </div>
    </div>
  );
}
