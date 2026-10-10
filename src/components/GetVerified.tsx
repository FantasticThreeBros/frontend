"use client";
import { useState, useEffect, useCallback, ReactNode } from "react";
import { usePassport } from "@/hooks/usePassport";
import { MyStatus, explainError, PassMode } from "@/lib/passportClient";
import { DEFAULT_NETWORK, CIVIC_PASS_URL } from "@/lib/networks";
import { Check, ExternalLink, Copy, RefreshCcw, Lock, ShieldCheck } from "lucide-react";

interface Props { onToast: (m: string, t?: "success" | "error" | "info", sig?: string) => void; onGoAdmin: () => void; onChanged?: () => void; }
type StepState = "done" | "active" | "locked";

const short = (s: string) => `${s.slice(0, 4)}...${s.slice(-4)}`;
const network = DEFAULT_NETWORK.toBase58();

function Step({ n, title, state, children }: { n: number; title: string; state: StepState; children?: ReactNode }) {
  const done = state === "done", locked = state === "locked";
  return (
    <div className="card" style={{ padding: 24, opacity: locked ? 0.55 : 1, borderColor: state === "active" ? "var(--accent)" : undefined }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: children && !locked ? 18 : 0 }}>
        <div style={{
          width: 32, height: 32, borderRadius: "50%", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center",
          background: done ? "var(--success)" : state === "active" ? "var(--accent)" : "var(--surface-hover)",
          color: done || state === "active" ? "#fff" : "var(--muted)", fontWeight: 700, fontSize: 14,
        }}>{done ? <Check size={18} /> : locked ? <Lock size={14} /> : n}</div>
        <div style={{ fontSize: 18, fontWeight: 600 }}>{title}</div>
      </div>
      {!locked && children}
    </div>
  );
}

const P = ({ children, muted }: { children: ReactNode; muted?: boolean }) => (
  <p style={{ fontSize: 15, lineHeight: 1.6, color: muted ? "var(--muted)" : "var(--text)", marginBottom: 12 }}>{children}</p>
);
const Notice = ({ kind, children }: { kind: "ok" | "warn" | "info"; children: ReactNode }) => (
  <div style={{
    padding: "12px 16px", borderRadius: 10, fontSize: 14, lineHeight: 1.5, marginBottom: 12, display: "flex", gap: 8, alignItems: "flex-start",
    background: kind === "ok" ? "var(--success-bg)" : kind === "warn" ? "var(--danger-bg)" : "var(--surface-hover)",
    color: kind === "ok" ? "var(--success)" : kind === "warn" ? "var(--danger)" : "var(--text)",
  }}><div>{children}</div></div>
);

export function GetVerified({ onToast, onGoAdmin, onChanged }: Props) {
  const { loadStatus, enrollIdentity, verifyPersonhood, publicKey } = usePassport();
  const [status, setStatus] = useState<MyStatus | null>(null);
  const [mode, setMode] = useState<PassMode | null>(null);
  const [busy, setBusy] = useState<"" | "enroll" | "verify" | "replay" | "check">("");
  const [replayMsg, setReplayMsg] = useState("");
  const [showDetails, setShowDetails] = useState(false);

  const refresh = useCallback(async (quiet = true) => {
    if (!quiet) setBusy("check");
    try { setStatus(await loadStatus(network)); } catch (e) { console.error(e); } finally { if (!quiet) setBusy(""); }
  }, [loadStatus]);

  useEffect(() => { refresh(); }, [refresh]);
  // While someone is getting a Civic pass in another tab, look again every few seconds.
  useEffect(() => {
    if (!status || status.enrollment || status.civicPass === "valid" || mode !== "civic") return;
    const t = setInterval(() => refresh(), 8000);
    return () => clearInterval(t);
  }, [status, mode, refresh]);
  useEffect(() => { if (status?.civicPass === "valid" && mode === null) setMode("civic"); }, [status, mode]);

  if (!status) return <p style={{ color: "var(--muted)", padding: 24 }}>Loading your status...</p>;

  const wallet = publicKey!.toBase58();
  const trusted = mode ? status.trust[mode] === "active" : false;
  const passReady = !!status.enrollment || (mode === "demo" && trusted) || (mode === "civic" && status.civicPass === "valid" && trusted);
  const enrolled = !!status.enrollment;
  const stepStates: StepState[] = [
    "done",
    enrolled ? "done" : "active",
    enrolled ? "done" : passReady ? "active" : "locked",
    status.verified ? "done" : enrolled ? "active" : "locked",
  ];

  const doEnroll = async () => {
    if (!mode) return;
    setBusy("enroll");
    try {
      const r = await enrollIdentity(mode, network);
      onToast("You're in the registry!", "success", r.sig);
      await refresh(); onChanged?.();
    } catch (e: any) { onToast(explainError(e), "error"); } finally { setBusy(""); }
  };
  const doVerify = async () => {
    if (!status.enrollment) return;
    setBusy("verify");
    try {
      const sig = await verifyPersonhood(status.enrollment.commitment);
      onToast("Verified: the demo app let you in", "success", sig);
      await refresh(); onChanged?.();
    } catch (e: any) { onToast(explainError(e), "error"); } finally { setBusy(""); }
  };
  const doReplay = async () => {
    if (!status.enrollment) return;
    setBusy("replay"); setReplayMsg("");
    try { await verifyPersonhood(status.enrollment.commitment); setReplayMsg("Unexpected: the second attempt went through."); }
    catch (e: any) { setReplayMsg(explainError(e)); } finally { setBusy(""); }
  };
  const copy = () => { navigator.clipboard.writeText(wallet); onToast("Wallet address copied", "success"); };

  const adminHint = (
    <Notice kind="warn">
      The registry doesn't trust this yet. The registry admin needs to open the <b>Admin</b> tab and press <b>Quick setup</b> once.{" "}
      <button className="btn btn-secondary" style={{ padding: "4px 10px", marginLeft: 6 }} onClick={onGoAdmin}>Go to Admin</button>
    </Notice>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 720 }}>
      <div>
        <h1 style={{ fontSize: 28, fontWeight: 700, letterSpacing: "-0.02em", marginBottom: 6 }}>Prove you're one real person</h1>
        <p style={{ color: "var(--muted)", fontSize: 15 }}>Four short steps. No ID is stored, only a hash of your pass.</p>
      </div>

      {status.registry === "missing" && <Notice kind="warn">The registry hasn't been created yet. The admin needs to run <b>Quick setup</b> in the Admin tab first.</Notice>}
      {status.registry === "frozen" && <Notice kind="warn">The registry is paused by the admin. Try again later.</Notice>}

      <Step n={1} title="Connect your wallet" state={stepStates[0]}>
        <P muted>Connected as <span className="mono">{short(wallet)}</span></P>
      </Step>

      <Step n={2} title="Get a pass" state={stepStates[1]}>
        {enrolled ? <P muted>Pass accepted.</P> : (
          <>
            <P muted>A pass is proof that something trusted has checked you. Pick one:</P>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <div className="card" style={{ flex: "1 1 280px", padding: 18, borderColor: mode === "demo" ? "var(--accent)" : undefined }}>
                <div style={{ fontWeight: 600, marginBottom: 4 }}>Demo pass <span className="badge badge-gray">quickest</span></div>
                <P muted>For trying the app. A demo issuer gives your wallet a test pass instantly.</P>
                {status.trust.demo === "active"
                  ? <button className="btn btn-primary" style={{ width: "100%" }} onClick={() => setMode("demo")}>{mode === "demo" ? "Selected" : "Use demo pass"}</button>
                  : <Notice kind="info">Demo mode isn't switched on yet (admin: Quick setup).</Notice>}
              </div>
              <div className="card" style={{ flex: "1 1 280px", padding: 18, borderColor: mode === "civic" ? "var(--accent)" : undefined }}>
                <div style={{ fontWeight: 600, marginBottom: 4 }}>My Civic Pass <span className="badge badge-green">real</span></div>
                <P muted>A real Civic Pass already issued to this wallet.</P>
                {status.civicPass === "valid"
                  ? <><Notice kind="ok">Pass found on this wallet.</Notice>
                      <button className="btn btn-primary" style={{ width: "100%" }} onClick={() => setMode("civic")}>{mode === "civic" ? "Selected" : "Use my Civic Pass"}</button></>
                  : <button className="btn btn-secondary" style={{ width: "100%" }} onClick={() => setMode("civic")}>{mode === "civic" ? "Selected: see steps below" : "I have / want a Civic Pass"}</button>}
              </div>
            </div>

            {mode === "civic" && status.civicPass !== "valid" && (
              <div style={{ marginTop: 16 }}>
                {status.civicPass === "none" && <Notice kind="info">No Civic Pass found for this wallet yet. That's normal if you haven't got one. Here's how to get one:</Notice>}
                {status.civicPass === "expired" && <Notice kind="warn">Your Civic Pass has expired. Get a fresh one:</Notice>}
                {(status.civicPass === "revoked" || status.civicPass === "frozen") && <Notice kind="warn">Your Civic Pass was {status.civicPass}. Get a new one:</Notice>}
                {(status.civicPass === "other-wallet" || status.civicPass === "wrong-network" || status.civicPass === "unreadable") && <Notice kind="warn">That pass can't be used here ({status.civicPass.replace("-", " ")}). Get a new one for this wallet:</Notice>}
                <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 16 }}>
                  {[
                    <>Open Civic and start a pass for <b>this wallet</b>:{" "}
                      <a href={CIVIC_PASS_URL} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "underline" }}>Get a Civic Pass <ExternalLink size={13} style={{ display: "inline", verticalAlign: "-2px" }} /></a></>,
                    <>Connect the same wallet there: <span className="mono">{short(wallet)}</span>{" "}
                      <button className="btn btn-secondary" style={{ padding: "2px 8px" }} onClick={copy}><Copy size={13} /></button></>,
                    <>Finish Civic's check (it may ask for a CAPTCHA or selfie, and a signature).</>,
                    <>Come back here. We check automatically, or press the button below.</>,
                  ].map((t, i) => (
                    <div key={i} style={{ display: "flex", gap: 12, alignItems: "flex-start", fontSize: 15, lineHeight: 1.6 }}>
                      <div style={{ width: 24, height: 24, borderRadius: "50%", background: "var(--surface-hover)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, flexShrink: 0 }}>{i + 1}</div>
                      <div>{t}</div>
                    </div>
                  ))}
                </div>
                <button className="btn btn-secondary" disabled={busy === "check"} onClick={() => refresh(false)}>
                  {busy === "check" ? <span className="spinner" /> : <RefreshCcw size={16} />} Check again
                </button>
                <P muted><span style={{ display: "block", marginTop: 12 }}>
                  Testing on devnet? This app trusts Civic's <b>devnet test network</b>, so the pass must be issued on that network. If Civic doesn't offer it to you, use the demo pass instead.</span></P>
              </div>
            )}
            {mode && !trusted && adminHint}
          </>
        )}
      </Step>

      <Step n={3} title="Join the registry" state={stepStates[2]}>
        {enrolled ? (
          <Notice kind="ok">You're in. Your spot: <b>#{status.enrollment!.leafIndex}</b>{status.enrollment!.frozen ? " (currently frozen by the admin)" : ""}.</Notice>
        ) : (
          <>
            <P muted>This adds a hash of your pass to the registry. One pass, one spot, so nobody can join twice.</P>
            <button className="btn btn-primary" style={{ width: "100%" }} disabled={busy === "enroll" || !passReady || status.registry !== "ready"} onClick={doEnroll}>
              {busy === "enroll" ? <><span className="spinner" /> Joining... approve in your wallet</> : "Join the registry"}
            </button>
          </>
        )}
      </Step>

      <Step n={4} title="Try it in an app" state={stepStates[3]}>
        {status.verified ? (
          <>
            <Notice kind="ok"><ShieldCheck size={16} style={{ display: "inline", verticalAlign: "-3px" }} /> Verified. The demo app let you in, and recorded that you've used it.</Notice>
            <P muted>Now try the same thing again. A second go with the same identity should be refused:</P>
            <button className="btn btn-secondary" disabled={busy === "replay"} onClick={doReplay}>{busy === "replay" ? <span className="spinner" /> : null} Try again (should be blocked)</button>
            {replayMsg && <div style={{ marginTop: 12 }}><Notice kind="info">Blocked as expected: {replayMsg}</Notice></div>}
          </>
        ) : (
          <>
            <P muted>A demo app asks the registry: "is this wallet a real person?" You approve, and it lets you in.</P>
            <button className="btn btn-primary" style={{ width: "100%" }} disabled={busy === "verify" || !enrolled || !!status.enrollment?.frozen} onClick={doVerify}>
              {busy === "verify" ? <><span className="spinner" /> Verifying... approve in your wallet</> : "Verify with the demo app"}
            </button>
          </>
        )}
      </Step>

      {enrolled && (
        <div>
          <button className="btn btn-secondary" onClick={() => setShowDetails(!showDetails)}>{showDetails ? "Hide" : "Show"} technical details</button>
          {showDetails && (
            <div className="card mono" style={{ padding: 16, marginTop: 12, fontSize: 12, lineHeight: 1.8, wordBreak: "break-all" }}>
              wallet: {wallet}<br />network: {network}<br />leaf: {status.enrollment!.leafIndex}<br />commitment: {status.enrollment!.commitment}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
