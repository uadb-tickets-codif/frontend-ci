"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import type { AuthUser } from "../lib/api";
import {
  createQrToken,
  downloadDocument,
  getAdminDocuments,
  getBeds,
  getMealPrices,
  getWallet,
  getWalletTransactions,
  importCodifiableStudents,
  purchaseTickets,
  reserveBed,
  scanMeal,
  topUpWallet,
  uploadForm,
  validateAdminDocument,
  verifyStudentEligibility,
  type Bed,
  type CodificationDocument,
  type DocumentStatus,
  type EligibilityResult,
  type MealService,
  type QrTokenResponse,
  type ScanResponse,
  type WalletTransaction,
} from "../lib/business-api";

type BusinessScreen =
  | "etudiant" | "achat" | "recharge" | "historique" | "qr"
  | "codification" | "controleur" | "admin" | "dossiers" | "parametres";

type Props = {
  screen: BusinessScreen;
  user: AuthUser;
  onNavigate: (screen: BusinessScreen) => void;
};

const mealNames: Record<MealService, string> = {
  BREAKFAST: "Petit-déjeuner",
  LUNCH: "Déjeuner",
  DINNER: "Dîner",
};

const currency = (amount: number) =>
  `${new Intl.NumberFormat("fr-FR").format(amount)} FCFA`;

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function ErrorMessage({ children }: { children: string }) {
  return <p className="api-error" role="alert">{children}</p>;
}

function Notice({ children }: { children: React.ReactNode }) {
  return <p className="api-notice">{children}</p>;
}

function Intro({ eyebrow, title, subtitle }: { eyebrow: string; title: string; subtitle: string }) {
  return <div className="page-intro"><div className="eyebrow">{eyebrow}</div><h1>{title}</h1><p>{subtitle}</p></div>;
}

function useLoad<T>(loader: () => Promise<T>) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setData(await loader());
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Le chargement a échoué.");
    } finally {
      setLoading(false);
    }
  }, [loader]);
  useEffect(() => {
    let active = true;
    const timer = window.setTimeout(() => {
      if (!active) return;
      setLoading(true);
      setError("");
      void loader().then((result) => {
        if (active) setData(result);
      }).catch((reason: unknown) => {
        if (active) setError(reason instanceof Error ? reason.message : "Le chargement a échoué.");
      }).finally(() => {
        if (active) setLoading(false);
      });
    }, 0);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [loader]);
  return { data, error, loading, refresh, setData };
}

function transactionLabel(transaction: WalletTransaction): string {
  return transaction.type === "CREDIT" ? "Recharge du portefeuille" : "Débit du portefeuille";
}

function TransactionList({ transactions }: { transactions: WalletTransaction[] }) {
  if (!transactions.length) return <p>Aucune transaction pour le moment.</p>;
  return <div className="transaction-list">{transactions.map((transaction) => (
    <article className="transaction-row" key={transaction.id}>
      <span className="transaction-description"><strong>{transactionLabel(transaction)}</strong><small>{formatDate(transaction.createdAt)}</small></span>
      <span className={`transaction-status${transaction.status === "SUCCESS" ? " transaction-status-success" : " transaction-status-failure"}`}>{transaction.status === "SUCCESS" ? "Réussi" : "Échoué"}</span>
      <strong className="transaction-amount">{transaction.type === "CREDIT" ? "+" : "−"}{currency(transaction.amount)}</strong>
    </article>
  ))}</div>;
}

function StudentDashboard({ user, onNavigate }: { user: AuthUser; onNavigate: (screen: BusinessScreen) => void }) {
  const wallet = useLoad(getWallet);
  const transactions = useLoad(getWalletTransactions);
  const status = user.codificationStatus || "Non renseigné";
  return <div className="page-stack">
    <Intro eyebrow="ESPACE ÉTUDIANT" title={`Bonjour, ${user.firstName}`} subtitle="Vos services étudiants, reliés à votre compte." />
    <div className="stats-grid">
      <article className="stat-card"><span>Solde portefeuille</span><strong>{wallet.loading ? "Chargement…" : wallet.data ? currency(wallet.data.balance) : "Indisponible"}</strong>{wallet.error && <ErrorMessage>{wallet.error}</ErrorMessage>}</article>
      <article className="stat-card"><span>Codification</span><strong>{status}</strong></article>
      <article className="stat-card"><span>Tickets disponibles</span><strong>Non fourni par l’API</strong></article>
    </div>
    <section className="content-card">
      <h2>Services</h2>
      <div className="quick-actions">
        <button className="outline-button" type="button" onClick={() => onNavigate("achat")}>Acheter un repas</button>
        <button className="outline-button" type="button" onClick={() => onNavigate("recharge")}>Recharger le portefeuille</button>
        <button className="outline-button" type="button" onClick={() => onNavigate("qr")}>Afficher mon QR</button>
        <button className="outline-button" type="button" onClick={() => onNavigate("codification")}>Codification et logement</button>
      </div>
    </section>
    <section className="content-card">
      <div className="section-heading"><h2>Dernières transactions</h2><button className="text-button" type="button" onClick={() => onNavigate("historique")}>Voir tout</button></div>
      {transactions.loading ? <p>Chargement…</p> : transactions.error ? <ErrorMessage>{transactions.error}</ErrorMessage> : <TransactionList transactions={(transactions.data ?? []).slice(0, 5)} />}
    </section>
  </div>;
}

function WalletPage({ screen }: { screen: "achat" | "recharge" | "historique" }) {
  const [amount, setAmount] = useState(2000);
  const [service, setService] = useState<MealService>("BREAKFAST");
  const [quantity, setQuantity] = useState(1);
  const [simulateFailure, setSimulateFailure] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const prices = useLoad(getMealPrices);
  const wallet = useLoad(getWallet);
  const transactions = useLoad(getWalletTransactions);
  const amountDue = (prices.data?.prices[service] ?? 0) * quantity;

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    try {
      if (screen === "achat") {
        const result = await purchaseTickets(service, quantity, simulateFailure);
        setNotice(`Achat traité par le serveur. Solde : ${currency(result.balance)}.`);
      } else {
        const result = await topUpWallet(amount, simulateFailure);
        setNotice(`Recharge traitée par le serveur. Solde : ${currency(result.balance)}.`);
      }
      await Promise.all([wallet.refresh(), transactions.refresh()]);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "L’opération a échoué.");
    } finally {
      setBusy(false);
    }
  };

  if (screen === "historique") return <div className="page-stack">
    <Intro eyebrow="ESPACE ÉTUDIANT" title="Historique des transactions" subtitle="Opérations de portefeuille renvoyées par le serveur." />
    <section className="content-card"><h2>Transactions</h2>{transactions.loading ? <p>Chargement…</p> : transactions.error ? <ErrorMessage>{transactions.error}</ErrorMessage> : <TransactionList transactions={transactions.data ?? []} />}
      <Notice>L’API ne fournit pas encore d’historique distinct des repas consommés.</Notice>
    </section>
  </div>;

  return <div className="page-stack">
    <Intro eyebrow="PORTEFEUILLE ÉTUDIANT" title={screen === "achat" ? "Acheter des tickets repas" : "Recharger le portefeuille"} subtitle={screen === "achat" ? "Les tarifs et l’achat sont fournis par le backend." : "Recharge simulée par le backend ; Wave et Orange Money ne sont pas encore connectés."} />
    <form className="content-card" onSubmit={(event) => void submit(event)}>
      <p><strong>Solde actuel : </strong>{wallet.loading ? "Chargement…" : wallet.data ? currency(wallet.data.balance) : "Indisponible"}</p>
      {wallet.error && <ErrorMessage>{wallet.error}</ErrorMessage>}
      {screen === "achat" ? <>
        <label>Service du repas
          <select value={service} onChange={(event) => setService(event.target.value as MealService)}>
            {(Object.keys(mealNames) as MealService[]).map((item) => <option key={item} value={item}>{mealNames[item]} · {prices.data ? currency(prices.data.prices[item]) : "Tarif en chargement"}</option>)}
          </select>
        </label>
        {prices.error && <ErrorMessage>{prices.error}</ErrorMessage>}
        <label>Nombre de tickets
          <input type="number" min={1} max={10} value={quantity} onChange={(event) => setQuantity(Math.min(10, Math.max(1, Number(event.target.value))))} required />
        </label>
        <p>Total : <strong>{prices.data ? currency(amountDue) : "—"}</strong></p>
      </> : <label>Montant de recharge (FCFA)
        <input type="number" min={100} step={100} value={amount} onChange={(event) => setAmount(Number(event.target.value))} required />
      </label>}
      <label className="checkbox-row"><input type="checkbox" checked={simulateFailure} onChange={(event) => setSimulateFailure(event.target.checked)} /> Simuler un échec côté backend</label>
      {error && <ErrorMessage>{error}</ErrorMessage>}
      {notice && <Notice>{notice}</Notice>}
      <button className="primary-button" disabled={busy || (screen === "achat" && !prices.data)} type="submit">{busy ? "Traitement…" : screen === "achat" ? "Acheter les tickets" : "Effectuer la recharge"}</button>
    </form>
  </div>;
}

function QrPage() {
  const wallet = useLoad(getWallet);
  const [token, setToken] = useState<QrTokenResponse | null>(null);
  const [image, setImage] = useState("");
  const [error, setError] = useState("");
  const [seconds, setSeconds] = useState(0);
  const refresh = useCallback(async () => {
    setError("");
    try {
      const newToken = await createQrToken();
      setToken(newToken);
      setSeconds(newToken.expiresIn);
      setImage(await QRCode.toDataURL(newToken.qrToken, { width: 240, margin: 1 }));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Impossible de générer le QR code.");
    }
  }, []);
  useEffect(() => {
    const timer = window.setTimeout(() => void refresh(), 0);
    return () => window.clearTimeout(timer);
  }, [refresh]);
  useEffect(() => {
    if (!token) return;
    const timer = window.setInterval(() => setSeconds((value) => Math.max(0, value - 1)), 1000);
    const expiration = window.setTimeout(() => void refresh(), token.expiresIn * 1000);
    return () => {
      window.clearInterval(timer);
      window.clearTimeout(expiration);
    };
  }, [refresh, token]);
  return <div className="page-stack">
    <Intro eyebrow="ACCÈS AU RESTAURANT" title="Votre QR code temporaire" subtitle="Le code est généré par le backend et renouvelé à son expiration." />
    <section className="content-card">
      {error ? <ErrorMessage>{error}</ErrorMessage> : image ? <Image src={image} alt="QR code temporaire de ticket repas" width={240} height={240} unoptimized /> : <p>Génération du QR code…</p>}
      <p>Expiration : {token ? `${Math.floor(seconds / 60)} min ${seconds % 60} s` : "—"}</p>
      <p>Solde : {wallet.data ? currency(wallet.data.balance) : wallet.loading ? "Chargement…" : "Indisponible"}</p>
      {wallet.error && <ErrorMessage>{wallet.error}</ErrorMessage>}
      <button className="outline-button" type="button" disabled={!token} onClick={() => void refresh()}>Renouveler le code</button>
    </section>
  </div>;
}

function CodificationPage({ user }: { user: AuthUser }) {
  const [studentNumber, setStudentNumber] = useState(user.studentNumber ?? "");
  const [birthDate, setBirthDate] = useState("");
  const [eligibility, setEligibility] = useState<EligibilityResult | null>(null);
  const [cni, setCni] = useState<File | null>(null);
  const [studentCard, setStudentCard] = useState<File | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [gender, setGender] = useState<"MALE" | "FEMALE" | "">("");
  const beds = useLoad(useCallback(() => getBeds({ gender: gender || undefined, status: "AVAILABLE" }), [gender]));

  async function verify(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(""); setMessage(""); setBusy(true);
    try {
      const result = await verifyStudentEligibility(studentNumber, birthDate);
      setEligibility(result);
      setMessage(result.message);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "La vérification a échoué.");
    } finally { setBusy(false); }
  }

  async function submitDocuments(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!cni || !studentCard) { setError("Sélectionnez les deux documents requis."); return; }
    setError(""); setMessage(""); setBusy(true);
    try {
      const data = new FormData();
      data.append("studentNumber", studentNumber);
      data.append("cni", cni);
      data.append("studentCard", studentCard);
      const response = await uploadForm<{ message?: string }>("codification/upload-documents", data);
      setMessage(response.message ?? "Documents transmis au serveur.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Le dépôt des documents a échoué.");
    } finally { setBusy(false); }
  }

  async function chooseBed(bed: Bed) {
    setError(""); setMessage("");
    try {
      const result = await reserveBed(bed.id, studentNumber);
      setMessage(result.message);
      await beds.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "La réservation a échoué.");
    }
  }

  return <div className="page-stack">
    <Intro eyebrow="CODIFICATION ÉTUDIANTE" title="Vérification et logement" subtitle="Vérifiez votre éligibilité, déposez vos pièces puis consultez les lits disponibles." />
    <form className="content-card" onSubmit={(event) => void verify(event)}>
      <h2>1. Vérifier l’éligibilité</h2>
      <label>Numéro étudiant<input value={studentNumber} onChange={(event) => setStudentNumber(event.target.value)} required /></label>
      <label>Date de naissance<input type="date" value={birthDate} onChange={(event) => setBirthDate(event.target.value)} required /></label>
      <button className="primary-button" disabled={busy} type="submit">{busy ? "Vérification…" : "Vérifier"}</button>
      {eligibility && <p>{eligibility.eligible ? "Éligible" : "Non éligible"} — {eligibility.student.firstName} {eligibility.student.lastName}</p>}
      {error && <ErrorMessage>{error}</ErrorMessage>}{message && <Notice>{message}</Notice>}
    </form>
    {eligibility?.eligible && <>
      <form className="content-card" onSubmit={(event) => void submitDocuments(event)}>
        <h2>2. Déposer les documents</h2>
        <label>CNI (PDF, JPG ou PNG, 5 Mo max)<input type="file" accept=".pdf,.jpg,.jpeg,.png" required onChange={(event) => setCni(event.target.files?.[0] ?? null)} /></label>
        <label>Carte étudiant (PDF, JPG ou PNG, 5 Mo max)<input type="file" accept=".pdf,.jpg,.jpeg,.png" required onChange={(event) => setStudentCard(event.target.files?.[0] ?? null)} /></label>
        <button className="primary-button" disabled={busy} type="submit">Envoyer les documents</button>
      </form>
      <section className="content-card">
        <h2>3. Choisir un lit</h2>
        <label>Genre du pavillon
          <select value={gender} onChange={(event) => setGender(event.target.value as typeof gender)}><option value="">Tous</option><option value="FEMALE">Femme</option><option value="MALE">Homme</option></select>
        </label>
        {beds.loading ? <p>Chargement des lits…</p> : beds.error ? <ErrorMessage>{beds.error}</ErrorMessage> : beds.data?.length ? beds.data.map((bed) => <article className="transaction-row" key={bed.id}>
          <span>{bed.room.pavilion.name} · étage {bed.room.floor} · chambre {bed.room.number} · lit {bed.label}</span>
          <button className="outline-button" type="button" onClick={() => void chooseBed(bed)}>Réserver</button>
        </article>) : <p>Aucun lit disponible pour ces filtres.</p>}
      </section>
    </>}
    <Notice>Le backend n’expose pas encore de consultation du statut des documents côté étudiant. La réservation est soumise à la validation serveur.</Notice>
  </div>;
}

function ControllerPage() {
  const [service, setService] = useState<MealService>("LUNCH");
  const [manualToken, setManualToken] = useState("");
  const [result, setResult] = useState<ScanResponse | null>(null);
  const [error, setError] = useState("");
  const [video, setVideo] = useState<HTMLVideoElement | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [busy, setBusy] = useState(false);
  const onVideoRef = useCallback((element: HTMLVideoElement | null) => setVideo(element), []);

  const submitToken = useCallback(async (rawToken: string) => {
    if (!rawToken.trim() || busy) return;
    setBusy(true); setError(""); setResult(null);
    try {
      setResult(await scanMeal(rawToken.trim(), service));
      setManualToken("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Le scan a échoué.");
    } finally { setBusy(false); }
  }, [busy, service]);

  useEffect(() => {
    if (!cameraActive || !video) return;
    const detectorConstructor = (window as Window & { BarcodeDetector?: new (options: { formats: string[] }) => { detect: (video: HTMLVideoElement) => Promise<Array<{ rawValue: string }>> } }).BarcodeDetector;
    if (!detectorConstructor || !navigator.mediaDevices?.getUserMedia) {
      const unsupportedTimer = window.setTimeout(() => {
        setCameraError("La lecture QR n’est pas prise en charge ici. Saisissez le code manuellement.");
        setCameraActive(false);
      }, 0);
      return () => window.clearTimeout(unsupportedTimer);
    }
    let cancelled = false;
    let stream: MediaStream | null = null;
    let timer: number | undefined;
    const detector = new detectorConstructor({ formats: ["qr_code"] });
    void navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } }).then(async (camera) => {
      stream = camera;
      if (cancelled) { camera.getTracks().forEach((track) => track.stop()); return; }
      video.srcObject = camera;
      await video.play();
      const readFrame = async () => {
        if (cancelled) return;
        try {
          const codes = await detector.detect(video);
          if (codes[0]?.rawValue) { await submitToken(codes[0].rawValue); return; }
        } catch { setCameraError("Impossible de lire ce QR. Vous pouvez saisir son contenu manuellement."); setCameraActive(false); return; }
        timer = window.setTimeout(() => void readFrame(), 300);
      };
      void readFrame();
    }).catch((reason: unknown) => {
      setCameraError(reason instanceof Error ? reason.message : "Impossible d’accéder à la caméra.");
      setCameraActive(false);
    });
    return () => {
      cancelled = true;
      if (timer !== undefined) window.clearTimeout(timer);
      stream?.getTracks().forEach((track) => track.stop());
      video.srcObject = null;
    };
  }, [cameraActive, submitToken, video]);

  return <div className="page-stack">
    <Intro eyebrow="ESPACE CONTRÔLEUR" title="Valider un ticket repas" subtitle="Scannez le QR temporaire ou saisissez son contenu pour interroger le backend." />
    <section className="content-card">
      <label>Service
        <select value={service} onChange={(event) => setService(event.target.value as MealService)}>{(Object.keys(mealNames) as MealService[]).map((meal) => <option key={meal} value={meal}>{mealNames[meal]}</option>)}</select>
      </label>
      <video ref={onVideoRef} muted playsInline className="camera-video" aria-label="Caméra de scan QR" />
      <button className="outline-button" type="button" onClick={() => { setCameraError(""); setCameraActive((active) => !active); }}>{cameraActive ? "Arrêter la caméra" : "Activer la caméra"}</button>
      {cameraError && <ErrorMessage>{cameraError}</ErrorMessage>}
      <form onSubmit={(event) => { event.preventDefault(); void submitToken(manualToken); }}>
        <label>Contenu du QR code<input value={manualToken} onChange={(event) => setManualToken(event.target.value)} autoComplete="off" /></label>
        <button className="primary-button" disabled={busy || !manualToken.trim()} type="submit">{busy ? "Vérification…" : "Valider le ticket"}</button>
      </form>
      {error && <ErrorMessage>{error}</ErrorMessage>}
      {result && <div className={`scan-result ${result.result === "OK" ? "scan-success" : "scan-failure"}`} aria-live="polite">
        <h2>{result.result === "OK" ? "Accès autorisé" : "Accès refusé"}</h2><p>{result.message}</p>
        {result.balance !== undefined && <p>Solde : {currency(result.balance)}</p>}
      </div>}
    </section>
  </div>;
}

function DocumentsAdmin() {
  const documents = useLoad(getAdminDocuments);
  const [csv, setCsv] = useState<File | null>(null);
  const [busyId, setBusyId] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [reason, setReason] = useState("");

  async function importCsv(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!csv) return;
    setError(""); setMessage("");
    try {
      const result = await importCodifiableStudents(csv);
      setMessage(`${result.message} (${result.importedCount} étudiant(s)).`);
    } catch (failure) { setError(failure instanceof Error ? failure.message : "L’import a échoué."); }
  }

  async function review(document: CodificationDocument, status: Exclude<DocumentStatus, "PENDING">) {
    setBusyId(document.id); setError(""); setMessage("");
    try {
      const result = await validateAdminDocument(document.id, status, status === "REJECTED" ? reason : undefined);
      setMessage(result.message);
      await documents.refresh();
    } catch (failure) { setError(failure instanceof Error ? failure.message : "La décision a échoué."); }
    finally { setBusyId(""); }
  }

  async function download(document: CodificationDocument) {
    try {
      const blob = await downloadDocument(document.id, document.user.studentNumber ?? "", true);
      const url = URL.createObjectURL(blob);
      const anchor = window.document.createElement("a");
      anchor.href = url;
      anchor.download = document.fileName ?? `document-${document.id}`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Le téléchargement a échoué."); }
  }

  return <div className="page-stack">
    <Intro eyebrow="ADMINISTRATION" title="Codification et documents" subtitle="Importez les étudiants éligibles et traitez les pièces déposées." />
    <Notice>À sécuriser côté backend avant tout usage en production : les routes d’administration et de téléchargement doivent vérifier le JWT et le rôle administrateur. Le masquage de l’interface ne protège pas ces routes.</Notice>
    <form className="content-card" onSubmit={(event) => void importCsv(event)}>
      <h2>Importer les étudiants éligibles (CSV)</h2>
      <p>Colonnes requises par le serveur : numéro étudiant, nom, prénom, date de naissance, genre, niveau et e-mail.</p>
      <input type="file" accept=".csv,text/csv" onChange={(event) => setCsv(event.target.files?.[0] ?? null)} required />
      <button className="primary-button" disabled={!csv} type="submit">Importer le fichier</button>
    </form>
    {message && <Notice>{message}</Notice>}{error && <ErrorMessage>{error}</ErrorMessage>}
    <section className="content-card">
      <h2>Dossiers en attente</h2>
      {documents.loading ? <p>Chargement…</p> : documents.error ? <ErrorMessage>{documents.error}</ErrorMessage> : documents.data?.length ? documents.data.map((document) => <article className="content-card" key={document.id}>
        <h3>{document.user.firstName} {document.user.lastName} · {document.user.studentNumber ?? "Sans matricule"}</h3>
        <p>{document.type} · {document.fileName ?? "Nom de fichier inconnu"} · {document.status}</p>
        {document.rejectionReason && <p>Motif : {document.rejectionReason}</p>}
        <button className="outline-button" type="button" onClick={() => void download(document)}>Télécharger</button>
        {document.status === "PENDING" && <>
          <button className="outline-button" disabled={busyId === document.id} type="button" onClick={() => void review(document, "APPROVED")}>Approuver</button>
          <label>Motif de rejet<input value={reason} onChange={(event) => setReason(event.target.value)} /></label>
          <button className="outline-button" disabled={busyId === document.id || !reason.trim()} type="button" onClick={() => void review(document, "REJECTED")}>Rejeter</button>
        </>}
      </article>) : <p>Aucun document à traiter.</p>}
    </section>
  </div>;
}

function AdminHome() {
  const documents = useLoad(getAdminDocuments);
  const pendingCount = useMemo(() => documents.data?.filter((item) => item.status === "PENDING").length ?? 0, [documents.data]);
  return <div className="page-stack">
    <Intro eyebrow="PORTAIL D’ADMINISTRATION" title="Services étudiants" subtitle="Données disponibles depuis l’API." />
    <section className="content-card"><h2>Documents en attente</h2><strong>{documents.loading ? "Chargement…" : documents.error ? "Indisponible" : pendingCount}</strong>{documents.error && <ErrorMessage>{documents.error}</ErrorMessage>}<p>Les statistiques de repas, recettes et occupation ne sont pas encore exposées par l’API.</p></section>
  </div>;
}

export default function BusinessPages({ screen, user, onNavigate }: Props) {
  switch (screen) {
    case "etudiant": return <StudentDashboard user={user} onNavigate={onNavigate} />;
    case "achat":
    case "recharge":
    case "historique": return <WalletPage screen={screen} />;
    case "qr": return <QrPage />;
    case "codification": return <CodificationPage user={user} />;
    case "controleur": return <ControllerPage />;
    case "admin": return <AdminHome />;
    case "dossiers": return <DocumentsAdmin />;
    case "parametres": return <div className="page-stack"><Intro eyebrow="ADMINISTRATION" title="Configuration" subtitle="Les tarifs sont gérés par le backend." /><section className="content-card"><p>Les tarifs exposés actuellement sont consultables à l’achat : petit-déjeuner 50 FCFA, déjeuner 100 FCFA et dîner 100 FCFA. L’API ne permet pas de les modifier.</p></section></div>;
    default: return null;
  }
}
