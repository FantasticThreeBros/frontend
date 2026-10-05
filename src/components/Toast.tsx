
"use client";
import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, AlertCircle, Info, X } from "lucide-react";

export type ToastType = "success" | "error" | "info";

interface Props {
  message: string;
  type: ToastType;
  onClose: () => void;
  txSig?: string;
}

export function Toast({ message, type, onClose, txSig }: Props) {
  useEffect(() => {
    const t = setTimeout(onClose, 6000);
    return () => clearTimeout(t);
  }, [onClose]);

  const Icon = type === "success" ? CheckCircle2 : type === "error" ? AlertCircle : Info;
  const color = type === "success" ? "var(--success)" : type === "error" ? "var(--danger)" : "var(--accent)";

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="toast" 
      style={{ display: "flex", flexDirection: "column", gap: 8, borderLeft: `4px solid ${color}` }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
        <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
          <Icon size={18} color={color} style={{ marginTop: 2 }} />
          <span style={{ fontSize: 14, color: "var(--text)", lineHeight: 1.4 }}>{message}</span>
        </div>
        <button onClick={onClose} style={{ background: "none", border: "none", color: "var(--muted)", cursor: "pointer", padding: 2 }}>
          <X size={16} />
        </button>
      </div>
      {txSig && (
        <a
          href={`https://explorer.solana.com/tx/${txSig}?cluster=devnet`}
          target="_blank"
          rel="noopener noreferrer"
          style={{ fontSize: 12, color: "var(--muted)", marginLeft: 30, textDecoration: "underline" }}
          className="mono"
        >
          View Transaction ↗
        </a>
      )}
    </motion.div>
  );
}
