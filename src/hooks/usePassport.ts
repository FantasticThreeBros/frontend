"use client";
import { useMemo, useCallback } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { Program, AnchorProvider, setProvider } from "@anchor-lang/core";
import { PublicKey } from "@solana/web3.js";
import contractIdl from "@/idl/contract.json";
import consumerIdl from "@/idl/mock_consumer.json";
import { pdas } from "@/lib/pdas";
import {
  buildTree, enrollIdentity as enrollIdentityTx, verifyPersonhood as verifyPersonhoodTx,
  registerVerifier as registerVerifierTx, decodeAll, fetchVerifierStatus, PassMode, WalletLike,
} from "@/lib/passportClient";

export function usePassport() {
  const { connection } = useConnection();
  const wallet = useWallet();

  const provider = useMemo(() => {
    if (!wallet.publicKey || !wallet.signTransaction || !wallet.signAllTransactions) return null;
    const anchorWallet = {
      publicKey: wallet.publicKey,
      signTransaction: wallet.signTransaction.bind(wallet),
      signAllTransactions: wallet.signAllTransactions.bind(wallet),
    };
    const p = new AnchorProvider(connection, anchorWallet as any, { commitment: "confirmed" });
    setProvider(p);
    return p;
  }, [connection, wallet.publicKey, wallet.signTransaction, wallet.signAllTransactions]);

  const passport = useMemo(() => (provider ? new Program(contractIdl as any, provider) : null), [provider]);
  const consumer = useMemo(() => (provider ? new Program(consumerIdl as any, provider) : null), [provider]);

  const walletLike = useCallback((): WalletLike => {
    if (!wallet.publicKey || !wallet.signTransaction) throw new Error("Not connected");
    return { publicKey: wallet.publicKey, signTransaction: wallet.signTransaction.bind(wallet) as any };
  }, [wallet]);

  const rebuildTree = useCallback(async () => {
    if (!passport) throw new Error("Not connected");
    return buildTree(connection, passport);
  }, [connection, passport]);

  const fetchRegistry = useCallback(async () => {
    if (!passport) return null;
    try {
      return await (passport.account as any).registryConfig.fetch(pdas.registry());
    } catch { return null; }
  }, [passport]);

  const fetchAllEnrollments = useCallback(async () => {
    if (!passport) return [];
    const records = await decodeAll(connection, passport, "EnrollmentRecord");
    return records.sort((a: any, b: any) => a.account.leafIndex - b.account.leafIndex);
  }, [connection, passport]);

  const fetchAllNullifiers = useCallback(async () => {
    if (!passport) return [];
    return decodeAll(connection, passport, "NullifierRecord");
  }, [connection, passport]);

  const fetchAllVerifiers = useCallback(async () => {
    if (!passport) return [];
    return decodeAll(connection, passport, "VerifierConfig");
  }, [connection, passport]);

  const verifierStatus = useCallback(async (mode: PassMode, network: string) => {
    if (!passport) return null;
    try { return await fetchVerifierStatus(passport, mode, new PublicKey(network)); } catch { return null; }
  }, [passport]);

  const initializeRegistry = useCallback(async () => {
    if (!passport) throw new Error("Not connected");
    return (passport.methods as any).initializeRegistry()
      .accountsPartial({ registry: pdas.registry() }).rpc();
  }, [passport]);

  const registerVerifier = useCallback(async (verifierKey: string, network: string, isActive: boolean) => {
    if (!passport) throw new Error("Not connected");
    return registerVerifierTx({
      connection, passport, wallet: walletLike(),
      verifier: new PublicKey(verifierKey), network: new PublicKey(network), isActive,
    });
  }, [connection, passport, walletLike]);

  const setRegistryFrozen = useCallback(async (frozen: boolean) => {
    if (!passport) throw new Error("Not connected");
    return (passport.methods as any).setRegistryFrozen(frozen)
      .accountsPartial({ registry: pdas.registry() }).rpc();
  }, [passport]);

  const freezeIdentity = useCallback(async (commitmentHex: string, frozen: boolean) => {
    if (!passport) throw new Error("Not connected");
    const commitment = Buffer.from(commitmentHex, "hex");
    return (passport.methods as any)
      .freezeIdentity([...commitment], frozen)
      .accountsPartial({ registry: pdas.registry(), enrollment: pdas.enrollment(commitment) }).rpc();
  }, [passport]);

  const enrollIdentity = useCallback(async (mode: PassMode, network: string) => {
    if (!passport || !consumer) throw new Error("Not connected");
    return enrollIdentityTx({ connection, passport, consumer, wallet: walletLike(), mode, network: new PublicKey(network) });
  }, [connection, passport, consumer, walletLike]);

  const verifyPersonhood = useCallback(async (commitmentHex: string) => {
    if (!passport || !consumer) throw new Error("Not connected");
    return verifyPersonhoodTx({ connection, passport, consumer, wallet: walletLike(), commitmentHex });
  }, [connection, passport, consumer, walletLike]);

  return {
    connected: !!wallet.publicKey,
    publicKey: wallet.publicKey,
    passport, consumer, provider,
    fetchRegistry, fetchAllEnrollments, fetchAllNullifiers, fetchAllVerifiers, verifierStatus,
    initializeRegistry, registerVerifier, setRegistryFrozen, freezeIdentity,
    enrollIdentity, verifyPersonhood, rebuildTree,
  };
}
