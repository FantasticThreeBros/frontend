
"use client";
import { useMemo, useCallback } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { Program, AnchorProvider, setProvider } from "@anchor-lang/core";
import { PublicKey, Keypair, SystemProgram, Transaction, SYSVAR_INSTRUCTIONS_PUBKEY } from "@solana/web3.js";
import contractIdl from "@/idl/contract.json";
import consumerIdl from "@/idl/mock_consumer.json";
import { pdas, PROGRAM_ID, MOCK_CONSUMER_ID } from "@/lib/pdas";
import { SparseTree, commitmentOf } from "@/lib/merkle";

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

  const passport = useMemo(() => {
    if (!provider) return null;
    return new Program(contractIdl as any, provider);
  }, [provider]);

  const consumer = useMemo(() => {
    if (!provider) return null;
    return new Program(consumerIdl as any, provider);
  }, [provider]);

  const rebuildTree = useCallback(async (): Promise<SparseTree> => {
    if (!passport) throw new Error("Not connected");
    const tree = new SparseTree();
    await tree.waitReady();
    const records = (await (passport.account as any).enrollmentRecord.all()) as any[];
    records.sort((a: any, b: any) => a.account.leafIndex - b.account.leafIndex);
    for (const r of records) await tree.appendAsync(Buffer.from(r.account.commitment));
    return tree;
  }, [passport]);

  const fetchRegistry = useCallback(async () => {
    if (!passport) return null;
    try {
      return await (passport.account as any).registryConfig.fetch(pdas.registry());
    } catch { return null; }
  }, [passport]);

  const fetchAllEnrollments = useCallback(async () => {
    if (!passport) return [];
    const records = (await (passport.account as any).enrollmentRecord.all()) as any[];
    return records.sort((a: any, b: any) => a.account.leafIndex - b.account.leafIndex);
  }, [passport]);

  const fetchAllNullifiers = useCallback(async () => {
    if (!passport) return [];
    return (await (passport.account as any).nullifierRecord.all()) as any[];
  }, [passport]);

  const initializeRegistry = useCallback(async () => {
    if (!passport) throw new Error("Not connected");
    return (passport.methods as any).initializeRegistry()
      .accountsPartial({ registry: pdas.registry() }).rpc();
  }, [passport]);

  const registerVerifier = useCallback(async (verifierKey: string, isActive: boolean) => {
    if (!passport) throw new Error("Not connected");
    const vk = new PublicKey(verifierKey);
    return (passport.methods as any).registerVerifier(vk, isActive)
      .accountsPartial({ registry: pdas.registry(), verifierConfig: pdas.verifierConfig(vk) }).rpc();
  }, [passport]);

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

  const enrollIdentity = useCallback(async (verifierKey: string) => {
    if (!passport || !wallet.publicKey || !provider) throw new Error("Not connected");
    const vk = new PublicKey(verifierKey);

    const credKp = Keypair.generate();
    const lamports = await connection.getMinimumBalanceForRentExemption(8);
    const setupTx = new Transaction().add(
      SystemProgram.createAccount({
        fromPubkey: wallet.publicKey,
        newAccountPubkey: credKp.publicKey,
        lamports,
        space: 8,
        programId: vk,
      })
    );
    setupTx.feePayer = wallet.publicKey;
    setupTx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
    setupTx.partialSign(credKp);
    const signedSetup = await wallet.signTransaction!(setupTx);
    const setupSig = await connection.sendRawTransaction(signedSetup.serialize());
    await connection.confirmTransaction(setupSig, "confirmed");

    const commitment = await commitmentOf(credKp.publicKey);
    const tree = await rebuildTree();
    const next = tree.count;
    const proof = await tree.proofAsync(next);

    const sig = await (passport.methods as any)
      .enrollIdentity([...commitment], proof)
      .accountsPartial({
        wallet: wallet.publicKey,
        verifierConfig: pdas.verifierConfig(vk),
        credentialAccount: credKp.publicKey,
        registry: pdas.registry(),
        enrollment: pdas.enrollment(commitment),
      }).rpc();

    return { sig, commitment: Buffer.from(commitment).toString("hex"), leafIndex: next };
  }, [passport, wallet, provider, connection, rebuildTree]);

  const verifyPersonhood = useCallback(async (commitmentHex: string) => {
    if (!passport || !consumer || !wallet.publicKey || !provider) throw new Error("Not connected");
    const commitment = Buffer.from(commitmentHex, "hex");
    const tree = await rebuildTree();

    const enrollmentPda = pdas.enrollment(commitment);
    const rec = await (passport.account as any).enrollmentRecord.fetch(enrollmentPda);
    const leafIndex = rec.leafIndex;
    const proof = await tree.proofAsync(leafIndex);

    const ix = await (consumer.methods as any)
      .gatedAction([...commitment], proof)
      .accountsPartial({
        wallet: wallet.publicKey,
        registry: pdas.registry(),
        enrollment: pdas.enrollment(commitment),
        nullifier: pdas.nullifier(MOCK_CONSUMER_ID, commitment),
        instructions: SYSVAR_INSTRUCTIONS_PUBKEY,
        passportProgram: PROGRAM_ID,
      }).instruction();

    const k = ix.keys.find((k: any) => k.pubkey.equals(wallet.publicKey!));
    if (k) k.isSigner = true;

    const tx = new Transaction().add(ix);
    tx.feePayer = wallet.publicKey;
    tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
    const signed = await wallet.signTransaction!(tx);
    return connection.sendRawTransaction(signed.serialize());
  }, [passport, consumer, wallet, provider, connection, rebuildTree]);

  return {
    connected: !!wallet.publicKey,
    publicKey: wallet.publicKey,
    passport,
    consumer,
    provider,
    fetchRegistry,
    fetchAllEnrollments,
    fetchAllNullifiers,
    initializeRegistry,
    registerVerifier,
    setRegistryFrozen,
    freezeIdentity,
    enrollIdentity,
    verifyPersonhood,
    rebuildTree,
  };
}
