"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  apiRequest,
  clearAccessToken,
  getAccessToken,
  setAccessToken,
  type ApiRole,
  type AuthUser,
  type LoginResponse,
} from "../lib/api";
import { parseStudentCsv, type AdminStudent } from "../lib/parse-student-csv.mts";
import logo from "./uadb-removebg-preview.png";

type Role = "student" | "controller" | "admin";
type Screen =
  | "connexion"
  | "etudiant"
  | "achat"
  | "recharge"
  | "historique"
  | "qr"
  | "codification"
  | "controleur"
  | "admin"
  | "dossiers"
  | "parametres";
type Meal = "Petit-déjeuner" | "Déjeuner" | "Dîner";
type ScanResult = "valid" | "used" | "invalid" | "insufficient";
type Transaction = {
  id: number;
  description: string;
  date: string;
  type: "ticket" | "repas" | "recharge";
  amount: number;
  successful: boolean;
};
type DemoRoom = {
  pavilion: string;
  floor: string;
  type: "Simple" | "Double";
  room: string;
  beds: string[];
  available: number;
};
type DetectedBarcode = { rawValue: string };
type BrowserBarcodeDetector = {
  detect: (source: HTMLVideoElement) => Promise<DetectedBarcode[]>;
};
type BrowserBarcodeDetectorConstructor = new (options: { formats: string[] }) => BrowserBarcodeDetector;
type WindowWithBarcodeDetector = Window & { BarcodeDetector?: BrowserBarcodeDetectorConstructor };
type IconName =
  | "grid"
  | "ticket"
  | "qr"
  | "building"
  | "scan"
  | "chart"
  | "users"
  | "settings"
  | "logout"
  | "arrow"
  | "plus"
  | "search"
  | "bell"
  | "clock"
  | "check"
  | "upload"
  | "wallet"
  | "user"
  | "shield"
  | "sun"
  | "refresh"
  | "chevron"
  | "document"
  | "filter"
  | "close"
  | "sparkles"
  | "calendar"
  | "bed"
  | "wifi";

function getPortalRole(role: ApiRole): Role {
  switch (role) {
    case "STUDENT":
      return "student";
    case "CONTROLLER":
      return "controller";
    case "ADMIN":
      return "admin";
    default:
      throw new Error("Le rôle reçu de l’API est invalide.");
  }
}

function getRoleHomeScreen(role: ApiRole): Screen {
  switch (role) {
    case "STUDENT":
      return "etudiant";
    case "CONTROLLER":
      return "controleur";
    case "ADMIN":
      return "admin";
    default:
      throw new Error("Le rôle reçu de l’API est invalide.");
  }
}

const MEALS: { name: Meal; price: number; time: string; icon: string }[] = [
  { name: "Petit-déjeuner", price: 150, time: "07:00 – 09:00", icon: "☀" },
  { name: "Déjeuner", price: 300, time: "12:00 – 14:30", icon: "◉" },
  { name: "Dîner", price: 250, time: "19:00 – 21:00", icon: "☾" },
];

const DEMO_ROOMS: DemoRoom[] = [
  { pavilion: "Pavillon A", floor: "1er étage", type: "Double", room: "A-108", beds: ["A-108-1", "A-108-2", "A-108-3"], available: 2 },
  { pavilion: "Pavillon B", floor: "2e étage", type: "Simple", room: "B-214", beds: ["B-214-1", "B-214-2", "B-214-3"], available: 1 },
  { pavilion: "Pavillon C", floor: "Rez-de-chaussée", type: "Double", room: "C-006", beds: ["C-006-1", "C-006-2", "C-006-3"], available: 3 },
];

const STUDENT_NAV: { label: string; screen: Screen; icon: IconName }[] = [
  { label: "Vue d’ensemble", screen: "etudiant", icon: "grid" },
  { label: "Acheter un ticket", screen: "achat", icon: "ticket" },
  { label: "Historique", screen: "historique", icon: "clock" },
  { label: "Mon QR code", screen: "qr", icon: "qr" },
  { label: "Codification", screen: "codification", icon: "building" },
];

const ADMIN_NAV: { label: string; screen: Screen; icon: IconName }[] = [
  { label: "Vue d’ensemble", screen: "admin", icon: "chart" },
  { label: "Dossiers étudiants", screen: "dossiers", icon: "users" },
  { label: "Paramètres", screen: "parametres", icon: "settings" },
];

const currency = (amount: number) =>
  `${new Intl.NumberFormat("fr-FR").format(amount)} FCFA`;

const scanLabels: Record<ScanResult, string> = {
  valid: "Repas validé",
  used: "Déjà servi",
  invalid: "Code invalide",
  insufficient: "Solde insuffisant",
};

function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  const shared = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true as const,
  };
  const paths: Record<IconName, React.ReactNode> = {
    grid: <><rect x="3.5" y="3.5" width="7" height="7" rx="1.5" /><rect x="13.5" y="3.5" width="7" height="7" rx="1.5" /><rect x="3.5" y="13.5" width="7" height="7" rx="1.5" /><rect x="13.5" y="13.5" width="7" height="7" rx="1.5" /></>,
    ticket: <><path d="M4 8.5A2.5 2.5 0 0 0 4 13.5v3A1.5 1.5 0 0 0 5.5 18h13a1.5 1.5 0 0 0 1.5-1.5v-3a2.5 2.5 0 0 0 0-5v-3A1.5 1.5 0 0 0 18.5 4h-13A1.5 1.5 0 0 0 4 5.5z" /><path d="M12 5v2m0 4v2m0 4v2" /></>,
    qr: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><path d="M14 14h3v3h-3zm5 0h2m-7 5v2m5-4v4h2" /></>,
    building: <><path d="M4 20V5.5A1.5 1.5 0 0 1 5.5 4h13A1.5 1.5 0 0 1 20 5.5V20M2.5 20h19" /><path d="M8 8h2m4 0h2M8 12h2m4 0h2m-7 8v-3.5a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1V20" /></>,
    scan: <><path d="M4 8V5a1 1 0 0 1 1-1h3m8 0h3a1 1 0 0 1 1 1v3m0 8v3a1 1 0 0 1-1 1h-3m-8 0H5a1 1 0 0 1-1-1v-3" /><path d="M7 12h10M9 9v6m6-6v6" /></>,
    chart: <><path d="M4 19.5h16M6.5 16v-5m5 5V5m5 11v-8" /><path d="m5 8 6.5-4 5 3 3.5-2" /></>,
    users: <><path d="M16 20v-1.5a3.5 3.5 0 0 0-3.5-3.5h-5A3.5 3.5 0 0 0 4 18.5V20" /><circle cx="10" cy="8" r="3.5" /><path d="M16 4.7a3.5 3.5 0 0 1 0 6.6M20 20v-1.5a3.5 3.5 0 0 0-2.5-3.35" /></>,
    settings: <><circle cx="12" cy="12" r="3" /><path d="m19.4 15 .1.1 1.2.9-1.5 2.6-1.4-.6a7.5 7.5 0 0 1-1.6.9l-.2 1.5h-3l-.2-1.5a7.5 7.5 0 0 1-1.6-.9l-1.4.6-1.5-2.6 1.2-.9a7.6 7.6 0 0 1 0-1.9l-1.2-.9 1.5-2.6 1.4.6a7.5 7.5 0 0 1 1.6-.9l.2-1.5h3l.2 1.5a7.5 7.5 0 0 1 1.6.9l1.4-.6 1.5 2.6-1.2.9a7.6 7.6 0 0 1 0 1.8Z" transform="translate(-1 -1)" /></>,
    logout: <><path d="M10 17l5-5-5-5m5 5H3" /><path d="M12 3h6a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-6" /></>,
    arrow: <><path d="M5 12h14m-6-6 6 6-6 6" /></>,
    plus: <><path d="M12 5v14m-7-7h14" /></>,
    search: <><circle cx="10.8" cy="10.8" r="6.8" /><path d="m16 16 4.5 4.5" /></>,
    bell: <><path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9m-8 12h4" /></>,
    clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
    check: <><path d="m5 12 4 4L19 6" /></>,
    upload: <><path d="M12 16V4m-5 5 5-5 5 5M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" /></>,
    wallet: <><rect x="3" y="5" width="18" height="15" rx="2" /><path d="M3 8h18m-5 6h2M6 5V4a1 1 0 0 1 1-1h11" /></>,
    user: <><circle cx="12" cy="8" r="3.5" /><path d="M5 20a7 7 0 0 1 14 0" /></>,
    shield: <><path d="M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11Z" /><path d="m9 12 2 2 4-4" /></>,
    sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42" /></>,
    refresh: <><path d="M20 7v5h-5M4 17v-5h5" /><path d="M5.5 9a7 7 0 0 1 11.7-2L20 12M4 12l2.8 5a7 7 0 0 0 11.7-2" /></>,
    chevron: <path d="m7 10 5 5 5-5" />,
    document: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6M8 13h8m-8 4h8" /></>,
    filter: <><path d="M4 6h16M7 12h10m-7 6h4" /></>,
    close: <><path d="m18 6-12 12M6 6l12 12" /></>,
    sparkles: <><path d="m12 3 1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3Z" /><path d="m19 14 1 2 2 1-2 1-1 2-1-2-2-1 2-1 1-2Z" /></>,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 10h18" /></>,
    bed: <><path d="M3 18V7m0 8h18v5M3 11h18a2 2 0 0 1 2 2v2H3zm3 0V9a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v2" /></>,
    wifi: <><path d="M5 9.5a11 11 0 0 1 14 0M8 12.5a6.5 6.5 0 0 1 8 0m-5 5h.01" /><circle cx="12" cy="17.5" r=".7" fill="currentColor" /></>,
  };

  return <svg {...shared}>{paths[name]}</svg>;
}

function QrArtwork({ compact = false }: { compact?: boolean }) {
  const dimension = 25;
  const cells = useMemo(() => {
    const result: { x: number; y: number; on: boolean }[] = [];
    for (let y = 0; y < dimension; y += 1) {
      for (let x = 0; x < dimension; x += 1) {
        const inFinder = (fx: number, fy: number) =>
          x >= fx && x < fx + 7 && y >= fy && y < fy + 7;
        const finderOn = (fx: number, fy: number) => {
          const dx = x - fx;
          const dy = y - fy;
          return (
            dx === 0 ||
            dx === 6 ||
            dy === 0 ||
            dy === 6 ||
            (dx >= 2 && dx <= 4 && dy >= 2 && dy <= 4)
          );
        };
        let on: boolean;
        if (inFinder(1, 1)) on = finderOn(1, 1);
        else if (inFinder(17, 1)) on = finderOn(17, 1);
        else if (inFinder(1, 17)) on = finderOn(1, 17);
        else on = (x * 7 + y * 11 + x * y * 3) % 5 < 2;
        result.push({ x, y, on });
      }
    }
    return result;
  }, []);

  return (
    <svg
      className={`qr-artwork${compact ? " qr-artwork-compact" : ""}`}
      viewBox={`0 0 ${dimension} ${dimension}`}
      role="img"
      aria-label="Illustration d’un QR code de démonstration"
    >
      <rect width={dimension} height={dimension} rx="1.2" fill="#fff" />
      {cells
        .filter((cell) => cell.on)
        .map((cell) => (
          <rect
            key={`${cell.x}-${cell.y}`}
            x={cell.x}
            y={cell.y}
            width="1"
            height="1"
            fill="#17345a"
          />
        ))}
    </svg>
  );
}

function Portal() {
  const [screen, setScreen] = useState<Screen>("connexion");
  const [role, setRole] = useState<Role>("student");
  const [user, setUser] = useState<AuthUser | null>(null);
  const [registering, setRegistering] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [authSubmitting, setAuthSubmitting] = useState(false);
  const [authError, setAuthError] = useState("");
  const [toast, setToast] = useState("");
  const [balance, setBalance] = useState(4_850);
  const [tickets, setTickets] = useState(8);
  const [meal, setMeal] = useState<Meal>("Déjeuner");
  const [quantity, setQuantity] = useState(2);
  const [paymentMethod, setPaymentMethod] = useState("Wave");
  const [paymentOutcome, setPaymentOutcome] = useState<"success" | "failure">("success");
  const [purchaseComplete, setPurchaseComplete] = useState(false);
  const [transactions, setTransactions] = useState<Transaction[]>([
    { id: 3, description: "Déjeuner acheté", date: "Aujourd’hui · 10:42", type: "ticket", amount: -300, successful: true },
    { id: 2, description: "Repas consommé · Dîner", date: "Hier · 19:26", type: "repas", amount: 0, successful: true },
    { id: 1, description: "Recharge portefeuille", date: "4 nov. · 09:12", type: "recharge", amount: 2_000, successful: true },
  ]);
  const [rechargeAmount, setRechargeAmount] = useState(2_000);
  const [qrSeconds, setQrSeconds] = useState(42);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [scanLog, setScanLog] = useState<ScanResult[]>(["valid", "used"]);
  const [selectedBed, setSelectedBed] = useState<string | null>(null);
  const [bedConfirmed, setBedConfirmed] = useState(false);
  const [blockedRooms, setBlockedRooms] = useState<string[]>([]);
  const [codificationOpen, setCodificationOpen] = useState(true);
  const [rejectionReason, setRejectionReason] = useState("");
  const [mealPrices, setMealPrices] = useState([150, 300, 250]);
  const [nonScholarMealPrices, setNonScholarMealPrices] = useState([300, 600, 500]);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    let active = true;
    const handleUnauthorized = () => {
      setUser(null);
      setScreen("connexion");
      setRegistering(false);
    };

    window.addEventListener("uadb:unauthorized", handleUnauthorized);
    if (!getAccessToken()) {
      const noSessionTimer = window.setTimeout(() => {
        if (active) setAuthLoading(false);
      }, 0);
      return () => {
        active = false;
        window.clearTimeout(noSessionTimer);
        window.removeEventListener("uadb:unauthorized", handleUnauthorized);
      };
    }

    void apiRequest<AuthUser>("auth/me")
      .then((authenticatedUser) => {
        if (!active) return;
        const authenticatedRole = getPortalRole(authenticatedUser.role);
        const homeScreen = getRoleHomeScreen(authenticatedUser.role);
        setUser(authenticatedUser);
        setRole(authenticatedRole);
        setScreen(homeScreen);
      })
      .catch((error: unknown) => {
        if (active) {
          setToast(
            error instanceof Error
              ? error.message
              : "Impossible de vérifier votre session.",
          );
        }
      })
      .finally(() => {
        if (active) setAuthLoading(false);
      });

    return () => {
      active = false;
      window.removeEventListener("uadb:unauthorized", handleUnauthorized);
    };
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setQrSeconds((seconds) => (seconds <= 1 ? 60 : seconds - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 3200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const isLoggedIn = user !== null && screen !== "connexion";
  const pageTitle =
    screen === "etudiant"
      ? "Vue d’ensemble"
      : screen === "achat"
        ? "Acheter des tickets"
        : screen === "recharge"
          ? "Recharger le portefeuille"
          : screen === "historique"
            ? "Historique des opérations"
        : screen === "qr"
          ? "Mon QR code"
          : screen === "codification"
            ? "Ma codification"
            : screen === "controleur"
              ? "Contrôle des accès"
              : screen === "admin"
                ? "Vue d’ensemble"
                : screen === "dossiers"
                  ? "Dossiers étudiants"
                  : screen === "parametres"
                    ? "Configuration"
                    : "Connexion";

  const activeMeal = MEALS.find((item) => item.name === meal) ?? MEALS[1];
  const selectedMealIndex = MEALS.findIndex((item) => item.name === meal);
  const currentPrice = mealPrices[selectedMealIndex] ?? activeMeal.price;
  const total = currentPrice * quantity;

  function showToast(message: string) {
    setToast(message);
  }

  function routeToRole(apiRole: ApiRole) {
    const nextRole = getPortalRole(apiRole);
    const homeScreen = getRoleHomeScreen(apiRole);
    setRole(nextRole);
    setScreen(homeScreen);
    setRegistering(false);
  }

  function navigateToScreen(nextScreen: Screen) {
    const allowedScreens: Record<Role, Screen[]> = {
      student: ["etudiant", "achat", "recharge", "historique", "qr", "codification"],
      controller: ["controleur"],
      admin: ["admin", "dossiers", "parametres"],
    };

    if (!user || !allowedScreens[role].includes(nextScreen)) {
      showToast("Accès refusé.");
      return;
    }
    setScreen(nextScreen);
  }

  async function handleAuthSubmit(
    event: React.FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();
    setAuthError("");
    setAuthSubmitting(true);

    const form = event.currentTarget;
    const formData = new FormData(form);
    const email = String(formData.get("email") ?? "").trim();
    const password = String(formData.get("password") ?? "");

    try {
      if (registering) {
        const gender = formData.get("gender");
        if (gender !== "MALE" && gender !== "FEMALE") {
          throw new Error("Sélectionnez votre genre.");
        }

        const studentNumber = String(formData.get("studentNumber") ?? "").trim();
        await apiRequest<AuthUser>("auth/register", {
          method: "POST",
          authenticated: false,
          body: JSON.stringify({
            firstName: String(formData.get("firstName") ?? "").trim(),
            lastName: String(formData.get("lastName") ?? "").trim(),
            email,
            password,
            gender,
            ...(studentNumber ? { studentNumber } : {}),
          }),
        });
        setRegistering(false);
        setToast("Compte créé. Vous pouvez maintenant vous connecter.");
        form.reset();
        return;
      }

      const result = await apiRequest<LoginResponse>("auth/login", {
        method: "POST",
        authenticated: false,
        body: JSON.stringify({ email, password }),
      });
      routeToRole(result.user.role);
      setAccessToken(result.accessToken);
      setUser(result.user);
    } catch (error) {
      setAuthError(
        error instanceof Error
          ? error.message
          : "Une erreur est survenue. Réessayez.",
      );
    } finally {
      setAuthSubmitting(false);
    }
  }

  function logout() {
    clearAccessToken();
    setUser(null);
    setScreen("connexion");
    setRole("student");
    setRegistering(false);
    setAuthError("");
  }

  function completePurchase(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (paymentMethod === "Portefeuille" && balance < total) {
      showToast("Solde insuffisant. Choisissez un autre mode de paiement.");
      return;
    }
    if (paymentOutcome === "failure") {
      setPurchaseComplete(false);
      setTransactions((current) => [
        { id: Date.now(), description: `Achat · ${meal}`, date: "À l’instant", type: "ticket", amount: -total, successful: false },
        ...current,
      ]);
      showToast("Paiement refusé dans cette simulation. Aucun ticket ni montant n’a été débité.");
      return;
    }
    if (paymentMethod === "Portefeuille") {
      setBalance((amount) => amount - total);
    }
    setTickets((count) => count + quantity);
    setPurchaseComplete(true);
    setTransactions((current) => [
      { id: Date.now(), description: `Achat de ${quantity} ticket${quantity > 1 ? "s" : ""} · ${meal}`, date: "À l’instant", type: "ticket", amount: -total, successful: true },
      ...current,
    ]);
    showToast("Achat simulé avec succès. Vos tickets sont prêts !");
  }

  function completeRecharge(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (paymentOutcome === "failure") {
      setTransactions((current) => [
        { id: Date.now(), description: "Recharge du portefeuille", date: "À l’instant", type: "recharge", amount: rechargeAmount, successful: false },
        ...current,
      ]);
      showToast("Recharge refusée dans cette simulation. Votre solde n’a pas changé.");
      return;
    }
    setBalance((amount) => amount + rechargeAmount);
    setTransactions((current) => [
      { id: Date.now(), description: "Recharge du portefeuille", date: "À l’instant", type: "recharge", amount: rechargeAmount, successful: true },
      ...current,
    ]);
    showToast(`Recharge simulée de ${currency(rechargeAmount)} effectuée.`);
  }

  function simulateScan(result: ScanResult) {
    setScanResult(result);
    setScanLog((entries) => [result, ...entries].slice(0, 5));
  }

  const navItems =
    role === "student"
      ? STUDENT_NAV
      : role === "controller"
        ? [{ label: "Scanner un ticket", screen: "controleur" as Screen, icon: "scan" as IconName }]
        : ADMIN_NAV;
  const displayName = user ? `${user.firstName} ${user.lastName}` : "";
  const initials = user
    ? `${user.firstName.charAt(0)}${user.lastName.charAt(0)}`.toUpperCase()
    : "";

  return (
    <>
      {authLoading ? (
        <main className="auth-loading" aria-live="polite">
          Vérification de votre session…
        </main>
      ) : isLoggedIn ? (
        <div className="portal-layout">
          <aside className="sidebar">
            <a className="brand-lockup" href="#" onClick={(event) => event.preventDefault()}>
              <Image className="brand-logo" src={logo} alt="Université Alioune Diop de Bambey" priority />
              <span className="brand-copy">
                <strong>UADB</strong>
                <small>Services étudiants</small>
              </span>
            </a>

            <div className="sidebar-divider" />
            <p className="nav-caption">ESPACE {role === "student" ? "ÉTUDIANT" : role === "controller" ? "CONTRÔLE" : "ADMINISTRATION"}</p>
            <nav className="side-nav" aria-label="Navigation principale">
              {navItems.map((item) => (
                <button
                  className={`nav-item${screen === item.screen ? " nav-item-active" : ""}`}
                  key={item.label}
                  onClick={() => navigateToScreen(item.screen)}
                  type="button"
                >
                  <Icon name={item.icon} size={19} />
                  <span>{item.label}</span>
                  {screen === item.screen && <span className="nav-active-mark" />}
                </button>
              ))}
            </nav>

            <div className="sidebar-spacer" />
            {role === "student" && (
              <div className="sidebar-help">
                <div className="help-icon"><Icon name="sparkles" size={18} /></div>
                <strong>Besoin d’aide ?</strong>
                <p>Notre équipe est là pour vous accompagner.</p>
                <button type="button" onClick={() => showToast("Contactez le service CROUS sur le campus.")}>
                  Contacter le CROUS <Icon name="arrow" size={15} />
                </button>
              </div>
            )}
            <button className="sidebar-logout" type="button" onClick={logout}>
              <Icon name="logout" size={18} />
              <span>Se déconnecter</span>
            </button>
            <div className="sidebar-footer">UNIVERSITÉ ALIOUNE DIOP · BAMBEY</div>
          </aside>

          <div className="main-column">
            <header className="topbar">
              <div className="breadcrumbs">
                <span>UADB Services</span><span className="breadcrumb-separator">/</span><strong>{pageTitle}</strong>
              </div>
              <div className="topbar-actions">
                <span className="today-label"><Icon name="calendar" size={15} /> {new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric" }).format(new Date())}</span>
                <button className="icon-button notification-button" type="button" aria-label="Notifications" onClick={() => showToast("Vous êtes à jour, aucune nouvelle notification.")}>
                  <Icon name="bell" size={19} /><i />
                </button>
                <div className="profile-chip">
                  <div className="avatar">{initials}</div>
                  <div className="profile-copy"><strong>{displayName}</strong><small>{role === "student" ? "Étudiant" : role === "controller" ? "Contrôleur" : "Administrateur"}</small></div>
                  <button className="profile-chevron" type="button" aria-label="Se déconnecter" onClick={logout}><Icon name="chevron" size={16} /></button>
                </div>
              </div>
            </header>

            <main className="main-content">
              {screen === "etudiant" && (
                <StudentDashboard
                  balance={balance}
                  tickets={tickets}
                  transactions={transactions}
                  firstName={user.firstName}
                  fullName={displayName}
                  onNavigate={navigateToScreen}
                />
              )}
              {screen === "achat" && (
                <PurchasePage
                  balance={balance}
                  meal={meal}
                  onMealChange={setMeal}
                  quantity={quantity}
                  onQuantityChange={setQuantity}
                  paymentMethod={paymentMethod}
                  onPaymentChange={setPaymentMethod}
                  currentPrice={currentPrice}
                  total={total}
                  completed={purchaseComplete}
                  paymentOutcome={paymentOutcome}
                  onPaymentOutcomeChange={setPaymentOutcome}
                  onSubmit={completePurchase}
                />
              )}
              {screen === "recharge" && (
                <RechargePage
                  balance={balance}
                  amount={rechargeAmount}
                  onAmountChange={setRechargeAmount}
                  paymentMethod={paymentMethod}
                  onPaymentChange={setPaymentMethod}
                  outcome={paymentOutcome}
                  onOutcomeChange={setPaymentOutcome}
                  onSubmit={completeRecharge}
                />
              )}
              {screen === "historique" && <HistoryPage transactions={transactions} />}
              {screen === "qr" && (
                <QrPage
                  balance={balance}
                  seconds={qrSeconds}
                  onRefresh={() => setQrSeconds(60)}
                />
              )}
              {screen === "codification" && (
                <CodificationPage
                  selectedBed={selectedBed}
                  onSelectBed={(bed) => {
                    setSelectedBed(bed);
                    setBedConfirmed(false);
                  }}
                  confirmed={bedConfirmed}
                  blockedRooms={blockedRooms}
                  onConfirm={() => {
                    if (!selectedBed) return;
                    setBedConfirmed(true);
                    showToast(`Votre lit ${selectedBed} est réservé dans cette maquette.`);
                  }                  }
                  onToast={showToast}
                  isOpen={codificationOpen}
                />
              )}
              {screen === "controleur" && (
                <ControllerPage
                  scanResult={scanResult}
                  scanLog={scanLog}
                  onScan={simulateScan}
                />
              )}
              {screen === "admin" && (
                <AdminDashboard
                  onNavigate={navigateToScreen}
                  onReview={() => navigateToScreen("dossiers")}
                />
              )}
              {screen === "dossiers" && (
                <AdminDossiers
                  query={searchQuery}
                  onQueryChange={setSearchQuery}
                  rejectionReason={rejectionReason}
                  onRejectionReasonChange={setRejectionReason}
                  onToast={showToast}
                />
              )}
              {screen === "parametres" && (
                <AdminSettings
                  onNavigate={navigateToScreen}
                  blockedRooms={blockedRooms}
                  reservedBed={bedConfirmed ? selectedBed : null}
                  onToggleRoom={(room) =>
                    {
                      const isBlocked = blockedRooms.includes(room);
                      if (!isBlocked && bedConfirmed && selectedBed?.startsWith(`${room}-`)) {
                        showToast(`La chambre ${room} ne peut pas être bloquée tant qu’un lit est réservé.`);
                        return;
                      }
                      setBlockedRooms((current) =>
                        isBlocked
                          ? current.filter((blockedRoom) => blockedRoom !== room)
                          : [...current, room],
                      );
                      if (!isBlocked && selectedBed?.startsWith(`${room}-`)) {
                        setSelectedBed(null);
                        setBedConfirmed(false);
                      }
                    }
                  }
                  prices={mealPrices}
                  nonScholarPrices={nonScholarMealPrices}
                  onPriceChange={(index, value) =>
                    setMealPrices((current) =>
                      current.map((price, i) => (i === index ? value : price)),
                    )
                  }
                  onNonScholarPriceChange={(index, value) =>
                    setNonScholarMealPrices((current) =>
                      current.map((price, i) => (i === index ? value : price)),
                    )
                  }
                  isOpen={codificationOpen}
                  onOpenChange={setCodificationOpen}
                  onToast={showToast}
                />
              )}
            </main>
          </div>
        </div>
      ) : (
        <LoginPage
          registering={registering}
          onToggleRegister={() => setRegistering((value) => !value)}
          error={authError}
          submitting={authSubmitting}
          onSubmit={handleAuthSubmit}
          onErrorClear={() => setAuthError("")}
        />
      )}
      {toast && <div className="toast-message" role="status"><span className="toast-check"><Icon name="check" size={16} /></span>{toast}</div>}
    </>
  );
}

function LoginPage({
  registering,
  onToggleRegister,
  error,
  submitting,
  onSubmit,
  onErrorClear,
}: {
  registering: boolean;
  onToggleRegister: () => void;
  error: string;
  submitting: boolean;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  onErrorClear: () => void;
}) {
  return (
    <main className="login-page">
      <section className="login-brand-panel">
        <div className="login-brand">
          <Image src={logo} alt="Université Alioune Diop de Bambey" width={76} height={76} priority />
          <span><strong>UADB</strong><small>Services étudiants</small></span>
        </div>
        <div className="login-hero">
          <div className="eyebrow eyebrow-light"><span className="eyebrow-dot" /> LA VIE ÉTUDIANTE, SIMPLIFIÉE</div>
          <h1>Votre campus,<br />à portée de main.</h1>
          <p>Vos repas et votre codification, réunis dans un espace simple, sûr et pensé pour vous.</p>
          <div className="login-benefits">
            <div><span className="benefit-icon"><Icon name="ticket" size={18} /></span><span><strong>Tickets de restaurant</strong><small>Achetez et retrouvez vos repas en un instant.</small></span></div>
            <div><span className="benefit-icon"><Icon name="shield" size={18} /></span><span><strong>Accès sécurisé par QR</strong><small>Un passage simple et rapide au restaurant.</small></span></div>
            <div><span className="benefit-icon"><Icon name="building" size={18} /></span><span><strong>Codification en ligne</strong><small>Suivez votre dossier et choisissez votre lit.</small></span></div>
          </div>
        </div>
        <div className="login-panel-footer"><span>Université Alioune Diop de Bambey</span><span>© UADB Services 2026</span></div>
        <div className="login-decoration login-decoration-one" /><div className="login-decoration login-decoration-two" />
      </section>

      <section className="login-form-panel">
        <div className="login-card">
          <div className="login-mobile-brand">
            <Image src={logo} alt="" width={50} height={50} />
            <span><strong>UADB</strong><small>Services étudiants</small></span>
          </div>
          <div className="eyebrow"><span className="eyebrow-dot" /> ESPACE NUMÉRIQUE</div>
          <h2>{registering ? "Créer mon compte" : "Ravi de vous revoir"}</h2>
          <p className="login-subtitle">{registering ? "Quelques informations pour commencer votre expérience." : "Connectez-vous pour accéder à vos services universitaires."}</p>
          {error && <p className="auth-error" role="alert">{error}</p>}
          <form className="login-form" onSubmit={onSubmit}>
            {registering && <>
              <label>Prénom<div className="input-wrap"><Icon name="user" size={18} /><input name="firstName" autoComplete="given-name" maxLength={100} required /></div></label>
              <label>Nom<div className="input-wrap"><Icon name="user" size={18} /><input name="lastName" autoComplete="family-name" maxLength={100} required /></div></label>
              <label>Numéro étudiant <span>(facultatif)</span><div className="input-wrap"><Icon name="user" size={18} /><input name="studentNumber" autoComplete="off" maxLength={32} /></div></label>
            </>}
            <label>Adresse e-mail<div className="input-wrap"><Icon name="user" size={18} /><input name="email" type="email" autoComplete="email" maxLength={254} onChange={onErrorClear} required /></div></label>
            {registering && <label>Genre<div className="input-wrap"><Icon name="user" size={18} /><select name="gender" defaultValue="" required><option value="" disabled>Sélectionnez une option</option><option value="FEMALE">Femme</option><option value="MALE">Homme</option></select></div></label>}
            <label>Mot de passe<div className="input-wrap"><Icon name="shield" size={18} /><input name="password" type="password" autoComplete={registering ? "new-password" : "current-password"} minLength={12} maxLength={72} onChange={onErrorClear} required /></div></label>
            <button className="primary-button login-submit" type="submit" disabled={submitting}>
              {submitting ? "Veuillez patienter…" : registering ? "Créer mon compte" : "Se connecter"}
              {!submitting && <Icon name="arrow" size={17} />}
            </button>
          </form>
          <div className="login-switch">{registering ? "Vous avez déjà un compte ?" : "Vous n’avez pas encore de compte ?"} <button type="button" onClick={() => { onErrorClear(); onToggleRegister(); }}>{registering ? "Se connecter" : "Créer un compte"}</button></div>
        </div>
      </section>
    </main>
  );
}

function StudentDashboard({
  balance,
  tickets,
  transactions,
  firstName,
  fullName,
  onNavigate,
}: {
  balance: number;
  tickets: number;
  transactions: Transaction[];
  firstName: string;
  fullName: string;
  onNavigate: (screen: Screen) => void;
}) {
  return (
    <div className="page-stack">
      <div className="welcome-row">
        <div><div className="eyebrow"><span className="eyebrow-dot" /> {new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(new Date()).toUpperCase()}</div><h1>Bonjour {firstName} <span className="wave-emoji">✦</span></h1><p>Content de vous revoir. Voici votre espace étudiant.</p></div>
        <button className="outline-button" type="button" onClick={() => onNavigate("historique")}><Icon name="clock" size={16} /> Historique</button>
      </div>

      <section className="student-hero">
        <div className="hero-content">
          <div className="hero-label"><Icon name="wallet" size={15} /> MON PORTEFEUILLE</div>
          <p className="hero-balance">{currency(balance)}</p>
          <p className="hero-support">Disponible pour vos repas au restaurant universitaire.</p>
          <div className="hero-actions"><button className="hero-button" type="button" onClick={() => onNavigate("achat")}>Acheter des tickets <Icon name="arrow" size={16} /></button><button className="hero-button hero-button-secondary" type="button" onClick={() => onNavigate("recharge")}><Icon name="plus" size={15} /> Recharger</button></div>
        </div>
        <div className="hero-card-visual">
          <div className="campus-card">
            <div className="campus-card-top"><Image src={logo} alt="" width={31} height={31} /><span>CARTE ÉTUDIANT<br /><strong>UADB · 2026</strong></span><Icon name="wifi" size={17} /></div>
            <div className="campus-card-name">{fullName.toLocaleUpperCase("fr-FR")}</div>
            <div className="campus-card-bottom"><span>MASTER 2 · SI-SR</span><span>•••• 2048</span></div>
          </div>
          <div className="hero-sparkle sparkle-a">✳</div><div className="hero-sparkle sparkle-b">✦</div>
        </div>
        <div className="hero-corner-mark">UADB</div>
      </section>

      <div className="stats-grid">
        <StatCard icon="ticket" tone="blue" label="Tickets disponibles" value={String(tickets)} note="Tous services confondus" />
        <StatCard icon="building" tone="sand" label="Ma codification" value="Dossier validé" note="Choisissez votre lit" />
        <StatCard icon="shield" tone="green" label="Statut étudiant" value="Boursier" note="Tarif social appliqué" />
      </div>

      <div className="dashboard-columns">
        <section className="content-card quick-actions-card">
          <div className="section-heading"><div><h2>Accès rapide</h2><p>Vos services essentiels, en un clic.</p></div><span className="section-badge">MES SERVICES</span></div>
          <div className="quick-actions">
            <button type="button" className="quick-action" onClick={() => onNavigate("achat")}><span className="quick-icon quick-icon-blue"><Icon name="ticket" size={20} /></span><span><strong>Acheter un repas</strong><small>Petit-déjeuner, déjeuner ou dîner</small></span><span className="quick-arrow"><Icon name="arrow" size={16} /></span></button>
            <button type="button" className="quick-action" onClick={() => onNavigate("qr")}><span className="quick-icon quick-icon-green"><Icon name="qr" size={20} /></span><span><strong>Mon QR code</strong><small>Présentez-le à l’entrée du restaurant</small></span><span className="quick-arrow"><Icon name="arrow" size={16} /></span></button>
            <button type="button" className="quick-action" onClick={() => onNavigate("codification")}><span className="quick-icon quick-icon-sand"><Icon name="building" size={20} /></span><span><strong>Ma codification</strong><small>Consultez les lits disponibles</small></span><span className="quick-arrow"><Icon name="arrow" size={16} /></span></button>
          </div>
        </section>

        <section className="content-card history-card">
          <div className="section-heading"><div><h2>Activité récente</h2><p>Suivez vos dernières opérations.</p></div><button className="text-button" type="button" onClick={() => onNavigate("historique")}>Tout voir <Icon name="arrow" size={14} /></button></div>
          <div className="activity-list">
            {transactions.slice(0, 3).map((transaction) => (
              <Activity
                key={transaction.id}
                icon={transaction.type === "recharge" ? "wallet" : transaction.type === "repas" ? "check" : "ticket"}
                tone={transaction.type === "recharge" ? "green" : transaction.successful ? "blue" : "sand"}
                title={transaction.description}
                detail={`${transaction.date} · ${transaction.successful ? "Réussi" : "Échoué"}`}
                amount={transaction.amount > 0 ? `+${currency(transaction.amount)}` : transaction.amount < 0 ? `−${currency(Math.abs(transaction.amount))}` : "Consommé"}
              />
            ))}
          </div>
        </section>
      </div>
      <section className="notice-banner"><span className="notice-icon"><Icon name="sun" size={18} /></span><p><strong>Bon appétit !</strong> Le service du déjeuner est ouvert de 12 h à 14 h 30 au restaurant universitaire.</p><button type="button" aria-label="Fermer" onClick={(event) => event.currentTarget.parentElement?.remove()}><Icon name="close" size={17} /></button></section>
    </div>
  );
}

function StatCard({ icon, tone, label, value, note }: { icon: IconName; tone: string; label: string; value: string; note: string }) {
  return <article className="stat-card"><span className={`stat-icon ${tone}`}><Icon name={icon} size={19} /></span><div className="stat-copy"><span>{label}</span><strong>{value}</strong><small>{note}</small></div></article>;
}

function Activity({ icon, tone, title, detail, amount }: { icon: IconName; tone: string; title: string; detail: string; amount: string }) {
  return <div className="activity-row"><span className={`activity-icon ${tone}`}><Icon name={icon} size={16} /></span><span className="activity-main"><strong>{title}</strong><small>{detail}</small></span><span className="activity-amount">{amount}</span></div>;
}

function HistoryPage({ transactions }: { transactions: Transaction[] }) {
  return (
    <div className="page-stack">
      <PageIntro eyebrow="ESPACE ÉTUDIANT" title="Historique des opérations" subtitle="Retrouvez vos achats, repas consommés et recharges de portefeuille." />
      <section className="content-card transaction-history-card">
        <div className="section-heading"><div><h2>Mes opérations</h2><p>Données de démonstration, conservées jusqu’au rechargement de la page.</p></div><span className="section-badge">{transactions.length} OPÉRATIONS</span></div>
        <div className="transaction-list">
          {transactions.map((transaction) => (
            <article className="transaction-row" key={transaction.id}>
              <span className={`activity-icon ${transaction.type === "recharge" ? "green" : transaction.successful ? "blue" : "sand"}`}>
                <Icon name={transaction.type === "recharge" ? "wallet" : transaction.type === "repas" ? "check" : "ticket"} size={17} />
              </span>
              <span className="transaction-description"><strong>{transaction.description}</strong><small>{transaction.date}</small></span>
              <span className={`transaction-status${transaction.successful ? " transaction-status-success" : " transaction-status-failure"}`}>{transaction.successful ? "Réussi" : "Échoué"}</span>
              <strong className="transaction-amount">{transaction.amount > 0 ? `+${currency(transaction.amount)}` : transaction.amount < 0 ? `−${currency(Math.abs(transaction.amount))}` : "Consommé"}</strong>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

function DemoPaymentOutcome({ value, onChange }: { value: "success" | "failure"; onChange: (value: "success" | "failure") => void }) {
  return (
    <label className="demo-outcome-select">
      Résultat de démonstration
      <select value={value} onChange={(event) => onChange(event.target.value === "failure" ? "failure" : "success")}>
        <option value="success">Paiement réussi</option>
        <option value="failure">Simuler un échec</option>
      </select>
    </label>
  );
}

function RechargePage({
  balance,
  amount,
  onAmountChange,
  paymentMethod,
  onPaymentChange,
  outcome,
  onOutcomeChange,
  onSubmit,
}: {
  balance: number;
  amount: number;
  onAmountChange: (amount: number) => void;
  paymentMethod: string;
  onPaymentChange: (method: string) => void;
  outcome: "success" | "failure";
  onOutcomeChange: (outcome: "success" | "failure") => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <div className="page-stack">
      <PageIntro eyebrow="PORTEFEUILLE ÉTUDIANT" title="Recharger votre portefeuille" subtitle="Choisissez un montant et simulez le résultat du paiement mobile." />
      <form className="content-card recharge-card" onSubmit={onSubmit}>
        <div className="recharge-current-balance"><span><Icon name="wallet" size={18} /> Solde actuel</span><strong>{currency(balance)}</strong></div>
        <fieldset className="recharge-amount-fieldset">
          <legend>Montant de la recharge</legend>
          <div className="recharge-amount-options">{[1_000, 2_000, 5_000, 10_000].map((value) => <button type="button" className={`recharge-amount-option${amount === value ? " recharge-amount-active" : ""}`} key={value} onClick={() => onAmountChange(value)}>{currency(value)}</button>)}</div>
        </fieldset>
        <fieldset className="recharge-amount-fieldset">
          <legend>Moyen de paiement</legend>
          <div className="payment-options recharge-payment-options">
            {["Wave", "Orange Money"].map((method) => <button type="button" className={`payment-option${paymentMethod === method ? " payment-option-active" : ""}`} key={method} onClick={() => onPaymentChange(method)}><span className={`payment-logo ${method === "Wave" ? "payment-wave" : "payment-orange"}`}>{method === "Wave" ? "W" : "OM"}</span><span><strong>{method}</strong><small>Paiement simulé</small></span><span className="radio-dot" /></button>)}
          </div>
        </fieldset>
        <DemoPaymentOutcome value={outcome} onChange={onOutcomeChange} />
        <p className="demo-payment-note"><Icon name="shield" size={15} /> Maquette uniquement : aucun paiement réel n’est effectué.</p>
        <button className="primary-button recharge-submit" type="submit">Simuler la recharge de {currency(amount)} <Icon name="arrow" size={16} /></button>
      </form>
    </div>
  );
}

function PurchasePage({
  balance,
  meal,
  onMealChange,
  quantity,
  onQuantityChange,
  paymentMethod,
  onPaymentChange,
  currentPrice,
  total,
  completed,
  paymentOutcome,
  onPaymentOutcomeChange,
  onSubmit,
}: {
  balance: number;
  meal: Meal;
  onMealChange: (meal: Meal) => void;
  quantity: number;
  onQuantityChange: (quantity: number) => void;
  paymentMethod: string;
  onPaymentChange: (method: string) => void;
  currentPrice: number;
  total: number;
  completed: boolean;
  paymentOutcome: "success" | "failure";
  onPaymentOutcomeChange: (outcome: "success" | "failure") => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <div className="page-stack">
      <PageIntro eyebrow="RESTAURANT UNIVERSITAIRE" title="Un bon repas, en quelques clics." subtitle="Choisissez votre service et retrouvez vos tickets immédiatement dans votre espace." />
      <div className="purchase-layout">
        <form className="content-card purchase-form" onSubmit={onSubmit}>
          <div className="form-section"><div className="form-section-heading"><span className="step-number">01</span><div><h2>Choisissez votre repas</h2><p>Un ticket correspond à un repas pour un service.</p></div></div>
            <div className="meal-options">{MEALS.map((option, index) => <button className={`meal-option${meal === option.name ? " meal-option-active" : ""}`} type="button" key={option.name} onClick={() => onMealChange(option.name)}><span className={`meal-icon meal-icon-${index}`}>{option.icon}</span><span className="meal-name">{option.name}</span><span className="meal-time">{option.time}</span><span className="meal-price">{currency(option.name === meal ? currentPrice : option.price)}</span>{meal === option.name && <span className="meal-selected"><Icon name="check" size={13} /></span>}</button>)}</div>
          </div>
          <div className="form-section quantity-section"><div className="form-section-heading"><span className="step-number">02</span><div><h2>Combien de tickets ?</h2><p>Vous pouvez acheter jusqu’à 10 tickets par commande.</p></div></div><div className="quantity-control"><span>Nombre de tickets</span><div><button type="button" aria-label="Diminuer" disabled={quantity <= 1} onClick={() => onQuantityChange(Math.max(1, quantity - 1))}>−</button><strong>{quantity}</strong><button type="button" aria-label="Augmenter" disabled={quantity >= 10} onClick={() => onQuantityChange(Math.min(10, quantity + 1))}>+</button></div></div></div>
          <div className="form-section payment-section"><div className="form-section-heading"><span className="step-number">03</span><div><h2>Mode de paiement</h2><p>Choisissez votre moyen de paiement préféré.</p></div></div><div className="payment-options"><button type="button" className={`payment-option${paymentMethod === "Wave" ? " payment-option-active" : ""}`} onClick={() => onPaymentChange("Wave")}><span className="payment-logo payment-wave">W</span><span><strong>Wave</strong><small>Paiement mobile</small></span><span className="radio-dot" /></button><button type="button" className={`payment-option${paymentMethod === "Orange Money" ? " payment-option-active" : ""}`} onClick={() => onPaymentChange("Orange Money")}><span className="payment-logo payment-orange">OM</span><span><strong>Orange Money</strong><small>Paiement mobile</small></span><span className="radio-dot" /></button><button type="button" className={`payment-option${paymentMethod === "Portefeuille" ? " payment-option-active" : ""}`} onClick={() => onPaymentChange("Portefeuille")}><span className="payment-logo payment-wallet"><Icon name="wallet" size={19} /></span><span><strong>Mon portefeuille</strong><small>Solde : {currency(balance)}</small></span><span className="radio-dot" /></button></div></div>
          <DemoPaymentOutcome value={paymentOutcome} onChange={onPaymentOutcomeChange} />
          <p className="demo-payment-note"><Icon name="shield" size={15} /> Le paiement est simulé pour cette maquette. Aucun débit réel.</p>
          <button className="primary-button purchase-submit" type="submit"><Icon name="shield" size={17} /> {completed ? "Simuler un nouvel achat" : `Payer ${currency(total)}`} <Icon name="arrow" size={17} /></button>
        </form>
        <aside className="purchase-aside">
          <section className="content-card order-card"><div className="section-heading"><div><h2>Récapitulatif</h2><p>Votre commande en détail.</p></div><span className="order-bag"><Icon name="ticket" size={19} /></span></div><div className="order-meal-preview"><span className="order-meal-symbol"><Icon name="sun" size={20} /></span><span><strong>{meal}</strong><small>Restaurant universitaire</small></span></div><div className="order-lines"><div><span>{quantity} ticket{quantity > 1 ? "s" : ""} × tarif boursier</span><strong>{currency(total)}</strong></div><div><span>Frais de service</span><strong className="free-label">Gratuit</strong></div></div><div className="order-total"><span>Total à payer</span><strong>{currency(total)}</strong></div>          <div className="order-balance"><span>{paymentMethod === "Portefeuille" ? "Solde après achat" : "Solde du portefeuille"}</span><strong>{currency(paymentMethod === "Portefeuille" ? balance - total : balance)}</strong></div></section>
          <div className="assurance-card"><span><Icon name="shield" size={18} /></span><div><strong>Paiement protégé</strong><p>Vos informations restent privées. Aucun paiement réel n’est effectué.</p></div></div>
          {completed && <div className="purchase-success"><span><Icon name="check" size={17} /></span><div><strong>Commande simulée !</strong><p>Vos tickets sont prêts dans votre portefeuille.</p></div></div>}
        </aside>
      </div>
    </div>
  );
}

function PageIntro({ eyebrow, title, subtitle }: { eyebrow: string; title: string; subtitle: string }) {
  return <div className="page-intro"><div className="eyebrow"><span className="eyebrow-dot" /> {eyebrow}</div><h1>{title}</h1><p>{subtitle}</p></div>;
}

function QrPage({ balance, seconds, onRefresh }: { balance: number; seconds: number; onRefresh: () => void }) {
  return (
    <div className="page-stack">
      <PageIntro eyebrow="ACCÈS AU RESTAURANT" title="Votre repas, votre passage." subtitle="Présentez ce code au contrôleur à l’entrée du restaurant universitaire." />
      <div className="qr-page-layout">
        <section className="qr-ticket-card">
          <div className="qr-ticket-top"><div className="qr-university-mark"><Image src={logo} alt="" width={43} height={43} /><span><strong>UADB</strong><small>RESTAURANT UNIVERSITAIRE</small></span></div><span className="qr-status-badge"><i /> ACTIF</span></div>
          <div className="qr-ticket-body"><p className="qr-ticket-label">VOTRE TICKET DU JOUR</p><h2>Bon appétit, Amadou !</h2><p className="qr-ticket-date">Aujourd’hui · Service déjeuner</p><div className="qr-code-frame"><QrArtwork /><span className="qr-center-mark"><Image src={logo} alt="" width={30} height={30} /></span></div><div className="qr-token-caption"><Icon name="shield" size={14} /> CODE DE DÉMONSTRATION</div><div className="qr-ticket-id">ÉTUDIANT · 2024-01842</div></div>
          <div className="qr-ticket-footer"><div><small>SOLDE DU PORTEFEUILLE</small><strong>{currency(balance)}</strong></div><div className="qr-dash" /><div><small>VALIDITÉ DU CODE</small><strong className="qr-countdown"><Icon name="clock" size={15} /> 00:{String(seconds).padStart(2, "0")}</strong></div></div>
        </section>
        <aside className="qr-side-column"><section className="content-card qr-help-card"><span className="qr-help-icon"><Icon name="scan" size={20} /></span><h2>Comment ça marche ?</h2><div className="qr-instructions"><div><span>1</span><p>Présentez votre QR code au contrôleur à l’entrée.</p></div><div><span>2</span><p>Le ticket est vérifié pour le service sélectionné.</p></div><div><span>3</span><p>Un message confirme votre accès au restaurant.</p></div></div><button className="outline-button full-width" type="button" onClick={onRefresh}><Icon name="refresh" size={16} /> Générer un nouveau code</button></section>
          <div className="qr-security-note"><Icon name="shield" size={18} /><div><strong>Votre compte est protégé</strong><p>Le code visuel n’intègre pas votre solde. Un vrai jeton sécurisé devra être délivré par le serveur.</p></div></div>
          <div className="qr-demo-warning"><span>i</span><p><strong>Aperçu de maquette.</strong> Le QR affiché est illustratif et ne permet pas l’accès au restaurant.</p></div>
        </aside>
      </div>
    </div>
  );
}

function CodificationPage({
  selectedBed,
  onSelectBed,
  confirmed,
  blockedRooms,
  onConfirm,
  onToast,
  isOpen,
}: {
  selectedBed: string | null;
  onSelectBed: (bed: string) => void;
  confirmed: boolean;
  blockedRooms: string[];
  onConfirm: () => void;
  onToast: (message: string) => void;
  isOpen: boolean;
}) {
  const [studentDetails, setStudentDetails] = useState({
    number: "2024-01842",
    name: "Amadou Diallo",
    birthDate: "2001-02-03",
    gender: "M",
  });
  const [verified, setVerified] = useState(true);
  const [editingDetails, setEditingDetails] = useState(false);
  const [verificationError, setVerificationError] = useState("");
  const [pavilionFilter, setPavilionFilter] = useState("Tous");
  const [floorFilter, setFloorFilter] = useState("Tous");
  const [roomTypeFilter, setRoomTypeFilter] = useState("Tous");
  const [documents, setDocuments] = useState({
    identity: "Document vérifié · PDF",
    studentCard: "Document vérifié · JPG",
  });
  const rooms = DEMO_ROOMS;
  const filteredRooms = rooms.filter((room) =>
    (pavilionFilter === "Tous" || room.pavilion === pavilionFilter) &&
    (floorFilter === "Tous" || room.floor === floorFilter) &&
    (roomTypeFilter === "Tous" || room.type === roomTypeFilter),
  );

  function verifyStudentDetails(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const matchesDemoRecord =
      studentDetails.number.trim() === "2024-01842" &&
      studentDetails.name.trim().toLocaleLowerCase("fr") === "amadou diallo" &&
      studentDetails.birthDate === "2001-02-03" &&
      studentDetails.gender === "M";
    setVerified(matchesDemoRecord);
    setVerificationError(
      matchesDemoRecord
        ? ""
        : "Ces informations ne correspondent pas à la liste codifiable de démonstration.",
    );
    setEditingDetails(!matchesDemoRecord);
    if (matchesDemoRecord) onToast("Informations vérifiées dans la liste de démonstration.");
  }

  function handleDocumentUpload(
    event: React.ChangeEvent<HTMLInputElement>,
    documentType: keyof typeof documents,
  ) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file) return;

    const extension = file.name.split(".").pop()?.toLowerCase();
    if (!extension || !["pdf", "jpg", "jpeg", "png"].includes(extension)) {
      onToast("Format refusé. Choisissez un fichier PDF, JPG ou PNG.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      onToast("Le document dépasse la taille maximale de 5 Mo.");
      return;
    }

    setDocuments((current) => ({ ...current, [documentType]: `${file.name} · vérifié en maquette` }));
    onToast("Fichier vérifié localement. Aucun document n’a été envoyé.");
  }

  return (
    <div className="page-stack">
      <PageIntro eyebrow="LOGEMENT UNIVERSITAIRE" title="Votre chambre, à votre rythme." subtitle="Suivez votre dossier et choisissez un lit parmi les places disponibles." />
      <section className="content-card verification-card"><div className="section-heading"><div><h2>Vérification de l’éligibilité</h2><p>Vos informations sont comparées à la liste codifiable.</p></div><span className={`status-pill ${verified ? "status-approved" : "status-review"}`}><i /> {verified ? "VÉRIFIÉ" : "À VÉRIFIER"}</span></div>{editingDetails ? <form className="verification-form" onSubmit={verifyStudentDetails}><label>Numéro étudiant<input required value={studentDetails.number} onChange={(event) => setStudentDetails((current) => ({ ...current, number: event.target.value }))} /></label><label>Nom et prénom<input required value={studentDetails.name} onChange={(event) => setStudentDetails((current) => ({ ...current, name: event.target.value }))} /></label><label>Date de naissance<input type="date" required value={studentDetails.birthDate} onChange={(event) => setStudentDetails((current) => ({ ...current, birthDate: event.target.value }))} /></label><label>Genre<select value={studentDetails.gender} onChange={(event) => setStudentDetails((current) => ({ ...current, gender: event.target.value }))}><option value="M">Homme</option><option value="F">Femme</option></select></label><button className="primary-button" type="submit">Vérifier mes informations <Icon name="arrow" size={15} /></button></form> : <div className="verified-student-row"><span><Icon name="check" size={16} /> {studentDetails.name} · {studentDetails.number}</span><button type="button" className="text-button" onClick={() => { setEditingDetails(true); setVerificationError(""); }}>Modifier mes informations</button></div>}{verificationError && <p className="verification-error" role="alert">{verificationError}</p>}<p className="demo-data-note">Vérification locale de démonstration · aucune donnée n’est envoyée.</p></section>
      <section className="codification-progress-card"><div className="codification-progress-head"><div><span className={`status-pill ${verified ? "status-approved" : "status-review"}`}><Icon name={verified ? "check" : "clock"} size={14} /> {verified ? "DOSSIER VALIDÉ" : "VÉRIFICATION REQUISE"}</span><h2>{verified ? "Votre dossier est complet" : "Vérifiez votre éligibilité"}</h2><p>{verified ? "Vos pièces ont été vérifiées par l’administration." : "La sélection d’un lit sera disponible après la vérification."}</p></div><span className="codification-ref">DOSSIER N° COD-2026-1842</span></div><div className="step-track"><div className={`codification-step${verified ? " step-done" : " step-current"}`}><span>{verified ? <Icon name="check" size={15} /> : "1"}</span><div><strong>Informations</strong><small>{verified ? "Vérifiées" : "À vérifier"}</small></div></div><i className={`step-line${verified ? " step-line-done" : ""}`} /><div className={`codification-step${verified ? " step-done" : ""}`}><span>{verified ? <Icon name="check" size={15} /> : "2"}</span><div><strong>Documents</strong><small>{verified ? "Validés" : "À déposer"}</small></div></div><i className={`step-line${verified ? " step-line-done" : ""}`} /><div className={`codification-step${confirmed ? " step-done" : " step-current"}`}><span>{confirmed ? <Icon name="check" size={15} /> : "3"}</span><div><strong>Choix du lit</strong><small>{confirmed ? "Confirmé" : "À effectuer"}</small></div></div></div></section>

      <div className="bed-section-heading"><div><div className="eyebrow"><span className="eyebrow-dot" /> PLACES DISPONIBLES</div><h2>Choisissez votre lit</h2><p>Les places affichées sont filtrées selon votre profil étudiant.</p></div><div className="gender-chip"><Icon name="shield" size={15} /> Pavillons garçons</div></div>
      <div className="bed-filters" aria-label="Filtres des chambres">
        <label>Pavillon<select value={pavilionFilter} onChange={(event) => setPavilionFilter(event.target.value)}><option>Tous</option>{rooms.map((room) => <option key={room.pavilion}>{room.pavilion}</option>)}</select></label>
        <label>Étage<select value={floorFilter} onChange={(event) => setFloorFilter(event.target.value)}><option>Tous</option>{rooms.map((room) => <option key={room.floor}>{room.floor}</option>)}</select></label>
        <label>Type de chambre<select value={roomTypeFilter} onChange={(event) => setRoomTypeFilter(event.target.value)}><option>Tous</option><option>Simple</option><option>Double</option></select></label>
      </div>
      {!isOpen && <div className="codification-closed-note" role="status">La période de codification est fermée. Les dépôts et choix de lits sont suspendus.</div>}
      {filteredRooms.length ? <div className="bed-grid">{filteredRooms.map((room) => {
        const blocked = blockedRooms.includes(room.room);
        const freeBeds = blocked ? 0 : room.available;
        return <article className="room-card" key={room.room}><div className="room-card-top"><span className="room-building"><Icon name="building" size={18} /></span><span className={`room-availability${blocked ? " room-maintenance" : ""}`}>{blocked ? "Maintenance" : `${freeBeds} ${freeBeds === 1 ? "lit libre" : "lits libres"}`}</span></div><h3>{room.pavilion}</h3><p className="room-location">{room.floor} <span>·</span> Chambre {room.room} <span>·</span> {room.type}</p><div className="room-beds" aria-label={`Lits disponibles dans ${room.room}`}>{room.beds.map((bed, index) => { const available = !blocked && index < room.available; return <button key={bed} type="button" disabled={!available || confirmed || !verified || !isOpen} className={`bed-button${selectedBed === bed ? " bed-selected" : ""}${!available ? " bed-occupied" : ""}`} onClick={() => onSelectBed(bed)} aria-label={`${bed}, ${available ? "disponible" : blocked ? "en maintenance" : "occupé"}`}><Icon name="bed" size={17} /><span>{blocked ? "Bloqué" : available ? "Libre" : "Occupé"}</span></button>; })}</div></article>;
      })}</div> : <div className="content-card bed-empty-state">Aucune chambre ne correspond à ces filtres.</div>}

      <div className="codification-bottom-grid"><section className="content-card selected-bed-card"><div className="section-heading"><div><h2>Votre sélection</h2><p>{confirmed ? "Votre réservation est confirmée." : "Choisissez un lit libre pour continuer."}</p></div><span className="selection-tag">{confirmed ? "CONFIRMÉ" : "ÉTAPE 3/3"}</span></div>{selectedBed ? <div className="selected-bed-summary"><span><Icon name="bed" size={19} /></span><div><strong>Lit {selectedBed}</strong><small>{rooms.find((room) => room.beds.includes(selectedBed))?.pavilion} · {rooms.find((room) => room.beds.includes(selectedBed))?.floor}</small></div><span className="status-pill status-approved"><Icon name="check" size={13} /> {confirmed ? "Réservé" : "Disponible"}</span></div> : <div className="empty-selection"><Icon name="bed" size={21} /><span>Aucun lit sélectionné</span></div>}<button type="button" className="primary-button confirm-bed-button" disabled={!selectedBed || confirmed || !verified || !isOpen} onClick={onConfirm}>{confirmed ? "Réservation confirmée" : "Confirmer ce lit"} <Icon name={confirmed ? "check" : "arrow"} size={16} /></button></section>
        <section className="content-card documents-card"><div className="section-heading"><div><h2>Mes documents</h2><p>Fichiers de démonstration · limite de 5 Mo.</p></div><span className="status-pill status-approved"><Icon name="check" size={13} /> VALIDÉS</span></div><div className="document-row"><span className="document-icon"><Icon name="document" size={18} /></span><span><strong>Carte nationale d’identité</strong><small>{documents.identity}</small></span><Icon name="check" size={17} /></div><label className="upload-link"><Icon name="upload" size={15} /> Choisir un fichier CNI<input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={(event) => handleDocumentUpload(event, "identity")} /></label><div className="document-row"><span className="document-icon"><Icon name="document" size={18} /></span><span><strong>Carte d’étudiant</strong><small>{documents.studentCard}</small></span><Icon name="check" size={17} /></div><label className="upload-link"><Icon name="upload" size={15} /> Choisir une carte étudiant<input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={(event) => handleDocumentUpload(event, "studentCard")} /></label></section></div>

      <section className="codification-window"><div><Icon name="calendar" size={17} /><span><strong>Fenêtre de codification {isOpen ? "ouverte" : "fermée"}</strong><small>{isOpen ? "Votre choix de lit reste modifiable jusqu’au 20 novembre 2026." : "Contactez l’administration pour connaître la prochaine période."}</small></span></div><span className={`status-pill ${isOpen ? "status-approved" : "status-pending"}`}>{isOpen ? "OUVERTE" : "FERMÉE"}</span></section>
    </div>
  );
}

function ControllerPage({ scanResult, scanLog, onScan }: { scanResult: ScanResult | null; scanLog: ScanResult[]; onScan: (result: ScanResult) => void }) {
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const videoRef = useRef<HTMLVideoElement>(null);
  const onScanRef = useRef(onScan);
  const scanColor = scanResult === "valid" ? "scan-success" : scanResult ? "scan-error" : "";

  useEffect(() => {
    onScanRef.current = onScan;
  }, [onScan]);

  useEffect(() => {
    if (!cameraActive) return;

    let cancelled = false;
    let stream: MediaStream | undefined;
    let scanTimer: number | undefined;
    let activeVideo: HTMLVideoElement | null = null;

    async function startCamera() {
      const Detector = (window as WindowWithBarcodeDetector).BarcodeDetector;
      if (!Detector) {
        throw new Error("La lecture QR par caméra n’est pas prise en charge par ce navigateur. Utilisez Chrome ou Edge récent.");
      }
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("La caméra nécessite HTTPS ou localhost sur cet appareil.");
      }

      stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: { ideal: "environment" } },
      });
      if (cancelled) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }

      activeVideo = videoRef.current;
      if (!activeVideo) throw new Error("La zone caméra n’est pas disponible.");
      activeVideo.srcObject = stream;
      await activeVideo.play();

      const detector = new Detector({ formats: ["qr_code"] });
      const scanFrame = async () => {
        if (cancelled || !videoRef.current) return;
        try {
          const codes = await detector.detect(videoRef.current);
          if (codes[0]?.rawValue) {
            const value = codes[0].rawValue.toLowerCase();
            const result: ScanResult = value.includes("used")
              ? "used"
              : value.includes("insufficient")
                ? "insufficient"
                : value.includes("valid")
                  ? "valid"
                  : "invalid";
            setCameraActive(false);
            setCameraError("");
            onScanRef.current(result);
            return;
          }
        } catch {
          setCameraActive(false);
          setCameraError("Impossible de lire le QR code. Réessayez ou utilisez une simulation.");
          return;
        }
        scanTimer = window.setTimeout(() => void scanFrame(), 250);
      };
      void scanFrame();
    }

    void startCamera().catch((error: unknown) => {
      if (cancelled) return;
      setCameraError(
        error instanceof Error
          ? error.message
          : "Impossible d’accéder à la caméra sur cet appareil.",
      );
      setCameraActive(false);
    });

    return () => {
      cancelled = true;
      if (scanTimer !== undefined) window.clearTimeout(scanTimer);
      stream?.getTracks().forEach((track) => track.stop());
      if (activeVideo) activeVideo.srcObject = null;
    };
  }, [cameraActive]);

  return (
    <div className="page-stack controller-page">
      <PageIntro eyebrow="ESPACE CONTRÔLEUR · RESTAURANT" title="Un scan, et c’est réglé." subtitle="Scannez le QR code étudiant pour vérifier et valider l’accès au repas." />
      <div className="controller-info-strip"><span className="controller-info-icon"><Icon name="sun" size={18} /></span><span><strong>Service en cours : Déjeuner</strong><small>Aujourd’hui · 12:00 – 14:30</small></span><span className="service-open-pill"><i /> SERVICE OUVERT</span></div>
      <div className="scanner-layout"><section className="scanner-card"><div className="scanner-card-heading"><div><span className="eyebrow"><span className="eyebrow-dot" /> LECTEUR DE TICKETS</span><h2>Scanner un QR code</h2></div><span className="camera-ready"><i /> PRÊT</span></div>
          <div className={`camera-preview${scanColor}`}>{cameraActive && <video ref={videoRef} className="camera-video" muted playsInline aria-label="Aperçu de la caméra pour scanner un QR code" />}<div className="camera-corner corner-tl" /><div className="camera-corner corner-tr" /><div className="camera-corner corner-bl" /><div className="camera-corner corner-br" />{scanResult ? <div className="scan-result-overlay"><span className={`result-mark${scanResult === "valid" ? " result-mark-success" : ""}`}><Icon name={scanResult === "valid" ? "check" : "close"} size={27} /></span><strong>{scanLabels[scanResult]}</strong><small>{scanResult === "valid" ? "Accès autorisé · Déjeuner" : scanResult === "used" ? "Ce ticket a déjà été utilisé pour ce service." : scanResult === "invalid" ? "Ce QR code ne correspond à aucun étudiant." : "Le portefeuille ne permet pas cet achat."}</small><span className="scan-student-ref">ÉTUDIANT · 2024-01842</span></div> : <div className="camera-placeholder"><span className="camera-icon"><Icon name="scan" size={28} /></span><strong>{cameraActive ? "Recherche d’un QR code…" : "Placez le QR code dans le cadre"}</strong><small>Le scan sera effectué depuis la caméra de votre appareil.</small></div>}<div className="scan-line" /></div>
          <div className="scanner-camera-actions"><button type="button" className="outline-button" onClick={() => { setCameraError(""); setCameraActive((active) => !active); }}>{cameraActive ? "Arrêter la caméra" : "Activer la caméra"}</button>{cameraError && <p role="alert">{cameraError}</p>}</div>
          <div className="scanner-simulate"><p>SIMULER UN RÉSULTAT DE SCAN</p><div><button type="button" className="simulate-button simulate-valid" onClick={() => onScan("valid")}><Icon name="check" size={15} /> Valide</button><button type="button" className="simulate-button simulate-used" onClick={() => onScan("used")}><Icon name="clock" size={15} /> Déjà servi</button><button type="button" className="simulate-button simulate-invalid" onClick={() => onScan("invalid")}><Icon name="close" size={15} /> Invalide</button><button type="button" className="simulate-button simulate-invalid" onClick={() => onScan("insufficient")}><Icon name="wallet" size={15} /> Solde insuffisant</button></div></div>
          <div className="scanner-secure"><Icon name="shield" size={15} /> Accès caméra possible uniquement sur HTTPS ou localhost.</div></section>
        <aside className="scanner-side"><section className="content-card scan-summary"><div className="section-heading"><div><h2>Activité du service</h2><p>Aujourd’hui · Restaurant central</p></div><span className="live-indicator"><i /> EN DIRECT</span></div><div className="scan-stats"><div><strong>128</strong><span>Repas contrôlés</span></div><div><strong>03</strong><span>En attente</span></div></div><div className="scan-success-rate"><span>Accès validés</span><strong>97 %</strong><div><i /></div></div></section>
          <section className="content-card scan-log-card"><div className="section-heading"><div><h2>Derniers contrôles</h2><p>Journal de vos derniers scans.</p></div><Icon name="clock" size={17} /></div><div className="scan-log-list">{scanLog.map((item, index) => <div className="scan-log-row" key={`${item}-${index}`}><span className={`scan-log-icon ${item === "valid" ? "scan-log-ok" : "scan-log-bad"}`}><Icon name={item === "valid" ? "check" : "close"} size={14} /></span><span><strong>{scanLabels[item]}</strong><small>2024-01842 · {index === 0 ? "À l’instant" : `${index * 4} min`}</small></span><span className={`scan-log-tag ${item === "valid" ? "tag-ok" : "tag-bad"}`}>{item === "valid" ? "OK" : "REFUSÉ"}</span></div>)}</div><p className="audit-note"><Icon name="shield" size={13} /> Chaque scan est consigné dans le journal.</p></section></aside>
      </div>
    </div>
  );
}

function AdminDashboard({ onNavigate, onReview }: { onNavigate: (screen: Screen) => void; onReview: () => void }) {
  const bars = [40, 65, 51, 79, 58, 88, 70, 96, 61, 77, 50, 84];
  return (
    <div className="page-stack">
      <div className="welcome-row"><div><div className="eyebrow"><span className="eyebrow-dot" /> PORTAIL D’ADMINISTRATION</div><h1>Bonjour, M. Ndiaye</h1><p>Voici les indicateurs clés de vos services aujourd’hui.</p></div><button className="outline-button" type="button" onClick={() => onNavigate("parametres")}><Icon name="settings" size={16} /> Paramètres</button></div>
      <section className="admin-hero"><div><span className="admin-hero-label"><Icon name="chart" size={15} /> RAPPORT QUOTIDIEN</span><h2>Les services du campus<br />en un coup d’œil.</h2><p>Les indicateurs sont présentés à titre d’exemple pour cette maquette.</p><button type="button" onClick={onReview}>Examiner les dossiers <Icon name="arrow" size={16} /></button></div><div className="admin-hero-orb"><Icon name="chart" size={57} /></div><div className="admin-hero-watermark">UADB</div></section>
      <div className="stats-grid admin-stats-grid"><StatCard icon="ticket" tone="blue" label="Repas servis" value="1 284" note="Aujourd’hui · +12 %" /><StatCard icon="wallet" tone="sand" label="Recettes du jour" value="385 200 FCFA" note="Tickets restaurant" /><StatCard icon="building" tone="green" label="Lits occupés" value="82 %" note="1 640 / 2 000 places" /><StatCard icon="users" tone="lavender" label="Dossiers en attente" value="24" note="À examiner aujourd’hui" /></div>
      <div className="admin-dashboard-grid"><section className="content-card chart-card"><div className="section-heading"><div><h2>Repas servis</h2><p>Évolution sur les 12 derniers mois.</p></div><span className="select-small">Cette année <Icon name="chevron" size={14} /></span></div><div className="chart-area"><div className="chart-y-labels"><span>2 000</span><span>1 500</span><span>1 000</span><span>500</span><span>0</span></div><div className="chart-content"><div className="chart-grid-lines"><i /><i /><i /><i /><i /></div><div className="chart-bars">{bars.map((height, index) => <div className="chart-bar-group" key={index}><span className={`chart-bar${index === 7 ? " chart-bar-highlight" : ""}`} style={{ height: `${height}%` }} /><small>{["J","F","M","A","M","J","J","A","S","O","N","D"][index]}</small></div>)}</div></div></div><div className="chart-footer"><span><i className="legend-blue" /> Repas servis</span><strong>1 284 <small>ce mois</small></strong></div></section>
        <section className="content-card pending-card"><div className="section-heading"><div><h2>Dossiers à traiter</h2><p>Les demandes les plus récentes.</p></div><button className="text-button" type="button" onClick={onReview}>Tout voir <Icon name="arrow" size={14} /></button></div><div className="pending-list"><PendingStudent initials="MN" name="Mariama Ndiaye" detail="Master 1 · Informatique" time="Il y a 12 min" /><PendingStudent initials="IS" name="Ibrahima Sow" detail="Licence 3 · Économie" time="Il y a 28 min" /><PendingStudent initials="AF" name="Awa Fall" detail="Master 2 · Droit" time="Il y a 1 h" /></div><button className="review-all-button" type="button" onClick={onReview}>Examiner les 24 dossiers <Icon name="arrow" size={16} /></button></section></div>
      <div className="admin-footer-note"><Icon name="shield" size={15} /> Les informations affichées sont fictives et servent uniquement à illustrer l’interface.</div>
    </div>
  );
}

function PendingStudent({ initials, name, detail, time }: { initials: string; name: string; detail: string; time: string }) {
  return <div className="pending-row"><span className="pending-avatar">{initials}</span><span><strong>{name}</strong><small>{detail}</small></span><time>{time}</time></div>;
}

const INITIAL_ADMIN_STUDENTS: AdminStudent[] = [
  { initials: "MN", name: "Mariama Ndiaye", number: "2024-02108", program: "Master 1 · Informatique", date: "7 nov. · 11:42", status: "À vérifier", gender: "F" },
  { initials: "IS", name: "Ibrahima Sow", number: "2023-01834", program: "Licence 3 · Économie", date: "7 nov. · 11:26", status: "À vérifier", gender: "M" },
  { initials: "AF", name: "Awa Fall", number: "2022-00891", program: "Master 2 · Droit", date: "7 nov. · 10:58", status: "À vérifier", gender: "F" },
  { initials: "BD", name: "Babacar Diop", number: "2024-02401", program: "Licence 2 · Géographie", date: "6 nov. · 16:10", status: "En attente", gender: "M" },
  { initials: "FS", name: "Fatou Sarr", number: "2023-01765", program: "Master 1 · Sociologie", date: "6 nov. · 14:32", status: "Validé", gender: "F" },
];

function AdminDossiers({ query, onQueryChange, rejectionReason, onRejectionReasonChange, onToast }: { query: string; onQueryChange: (query: string) => void; rejectionReason: string; onRejectionReasonChange: (reason: string) => void; onToast: (message: string) => void }) {
  const [statusFilter, setStatusFilter] = useState<"all" | "review" | "approved">("all");
  const [students, setStudents] = useState(INITIAL_ADMIN_STUDENTS);
  const [selectedNumber, setSelectedNumber] = useState(INITIAL_ADMIN_STUDENTS[0].number);
  const selectedStudent = students.find((student) => student.number === selectedNumber) ?? students[0];
  const filtered = students.filter((student) => {
    const matchesSearch = `${student.name} ${student.number} ${student.program}`.toLowerCase().includes(query.toLowerCase());
    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "review" && student.status !== "Validé" && student.status !== "Rejeté") ||
      (statusFilter === "approved" && student.status === "Validé");
    return matchesSearch && matchesStatus;
  });
  const reviewCount = students.filter((student) => student.status !== "Validé" && student.status !== "Rejeté").length;
  const approvedCount = students.filter((student) => student.status === "Validé").length;

  function updateStudentStatus(status: AdminStudent["status"]) {
    if (!selectedStudent) return;
    if (status === "Rejeté" && !rejectionReason.trim()) {
      onToast("Veuillez indiquer le motif du rejet.");
      return;
    }
    setStudents((current) =>
      current.map((student) =>
        student.number === selectedStudent.number ? { ...student, status } : student,
      ),
    );
    onToast(
      status === "Rejeté"
        ? `Dossier de ${selectedStudent.name} rejeté : ${rejectionReason.trim()}`
        : `Dossier de ${selectedStudent.name} validé. L’étudiant peut choisir un lit.`,
    );
    onRejectionReasonChange("");
  }

  async function importStudents(file: File) {
    if (file.size > 5 * 1024 * 1024) {
      onToast("Le fichier CSV dépasse la taille maximale de 5 Mo.");
      return;
    }
    try {
      const importedStudents = parseStudentCsv(await file.text());
      const existingNumbers = new Set(students.map((student) => student.number));
      const uniqueStudents = importedStudents.filter((student) => {
        if (existingNumbers.has(student.number)) return false;
        existingNumbers.add(student.number);
        return true;
      });
      if (uniqueStudents.length === 0) {
        onToast("Aucun nouvel étudiant à importer : les numéros existent déjà.");
        return;
      }
      setStudents((current) => [...uniqueStudents, ...current]);
      setSelectedNumber(uniqueStudents[0].number);
      onToast(`${uniqueStudents.length} étudiant${uniqueStudents.length > 1 ? "s" : ""} importé${uniqueStudents.length > 1 ? "s" : ""} dans cette maquette.`);
    } catch (error) {
      onToast(error instanceof Error ? error.message : "Impossible de lire ce fichier CSV.");
    }
  }

  return (
    <div className="page-stack">
      <PageIntro eyebrow="GESTION DES DEMANDES" title="Les dossiers de codification" subtitle="Vérifiez les pièces justificatives, puis validez ou rejetez chaque demande." />
      <div className="dossiers-toolbar"><div className="dossier-tabs"><button type="button" className={`dossier-tab${statusFilter === "all" ? " dossier-tab-active" : ""}`} onClick={() => setStatusFilter("all")}>Tous <span>{students.length}</span></button><button type="button" className={`dossier-tab${statusFilter === "review" ? " dossier-tab-active" : ""}`} onClick={() => setStatusFilter("review")}>À vérifier <span>{reviewCount}</span></button><button type="button" className={`dossier-tab${statusFilter === "approved" ? " dossier-tab-active" : ""}`} onClick={() => setStatusFilter("approved")}>Validés <span>{approvedCount}</span></button></div><div className="dossier-tools"><label className="search-field"><Icon name="search" size={17} /><input placeholder="Rechercher un étudiant..." value={query} onChange={(event) => onQueryChange(event.target.value)} /></label><button className="outline-button filter-button" type="button" onClick={() => setStatusFilter(statusFilter === "review" ? "all" : "review")}><Icon name="filter" size={16} /> Filtrer</button></div></div>
      <section className="content-card dossiers-table-card"><div className="table-responsive"><table className="dossiers-table"><thead><tr><th>ÉTUDIANT</th><th>N° ÉTUDIANT</th><th>FORMATION</th><th>REÇU LE</th><th>STATUT</th><th>ACTION</th></tr></thead><tbody>{filtered.map((student, index) => <tr key={student.number}><td><div className="table-student"><span className={`pending-avatar table-avatar avatar-${index % 4}`}>{student.initials}</span><span><strong>{student.name}</strong><small>{student.gender === "F" ? "Femme · " : "Homme · "}Dossier codification</small></span></div></td><td className="student-number">{student.number}</td><td>{student.program}</td><td className="muted-cell">{student.date}</td><td><span className={`status-pill ${student.status === "À vérifier" ? "status-review" : student.status === "Validé" ? "status-approved" : "status-pending"}`}><i /> {student.status}</span></td><td><button className="table-action" type="button" onClick={() => setSelectedNumber(student.number)}>Examiner <Icon name="arrow" size={14} /></button></td></tr>)}</tbody></table></div>{filtered.length === 0 && <div className="empty-search">Aucun dossier ne correspond à votre recherche.</div>}<div className="table-pagination"><span>Affichage de <strong>{filtered.length}</strong> étudiant{filtered.length === 1 ? "" : "s"}</span><div className="pagination-demo-note">Données de démonstration</div></div></section>
      {selectedStudent && <div className="admin-review-layout"><section className="content-card review-docs-card"><div className="section-heading"><div><h2>Dossier à examiner</h2><p>{selectedStudent.name} · {selectedStudent.number}</p></div><span className={`status-pill ${selectedStudent.status === "Validé" ? "status-approved" : selectedStudent.status === "Rejeté" ? "status-pending" : "status-review"}`}><i /> {selectedStudent.status}</span></div><div className="review-document-list"><div><span className="document-icon"><Icon name="document" size={18} /></span><span><strong>Carte nationale d’identité</strong><small>CNI_{selectedStudent.number}.pdf · exemple</small></span><button type="button" onClick={() => onToast("Aperçu fictif : aucun document réel n’a été importé.")}>Aperçu</button></div><div><span className="document-icon"><Icon name="document" size={18} /></span><span><strong>Carte d’étudiant</strong><small>carte_etudiant_{selectedStudent.number}.jpg · exemple</small></span><button type="button" onClick={() => onToast("Aperçu fictif : aucun document réel n’a été importé.")}>Aperçu</button></div></div></section><section className="content-card review-actions-card"><h2>Décision d’administration</h2><p>Validez le dossier ou indiquez le motif de rejet.</p><label className="textarea-label">Motif de rejet <textarea placeholder="Précisez le document à corriger..." value={rejectionReason} onChange={(event) => onRejectionReasonChange(event.target.value)} /></label><div className="review-action-buttons"><button type="button" className="reject-button" onClick={() => updateStudentStatus("Rejeté")}>Rejeter</button><button type="button" className="primary-button" disabled={selectedStudent.status === "Validé"} onClick={() => updateStudentStatus("Validé")}><Icon name="check" size={15} /> Valider le dossier</button></div></section></div>}
      <section className="csv-import-banner"><span><Icon name="upload" size={20} /></span><div><strong>Importer la liste des étudiants codifiables</strong><small>CSV avec numéro étudiant, nom, prénom, date de naissance, genre, niveau et email · 5 Mo maximum.</small></div><label className="outline-button"><Icon name="plus" size={16} /> Choisir un fichier CSV<input type="file" accept=".csv,text/csv" onChange={(event) => { const file = event.target.files?.[0]; if (file) void importStudents(file); event.currentTarget.value = ""; }} /></label></section>
    </div>
  );
}

function AdminSettings({ onNavigate, blockedRooms, reservedBed, onToggleRoom, prices, nonScholarPrices, onPriceChange, onNonScholarPriceChange, isOpen, onOpenChange, onToast }: { onNavigate: (screen: Screen) => void; blockedRooms: string[]; reservedBed: string | null; onToggleRoom: (room: string) => void; prices: number[]; nonScholarPrices: number[]; onPriceChange: (index: number, value: number) => void; onNonScholarPriceChange: (index: number, value: number) => void; isOpen: boolean; onOpenChange: (open: boolean) => void; onToast: (message: string) => void }) {
  return (
    <div className="page-stack">
      <PageIntro eyebrow="CONFIGURATION DES SERVICES" title="Les réglages du campus" subtitle="Gérez les tarifs, la fenêtre de codification et les accès de la plateforme." />
      <div className="settings-grid"><section className="content-card settings-card"><div className="section-heading"><div><h2>Tarifs des repas</h2><p>Tarifs de démonstration, ajustables par l’administration.</p></div><span className="settings-icon"><Icon name="ticket" size={18} /></span></div><div className="tariff-table"><div className="tariff-head"><span>SERVICE</span><span>TARIF BOURSIER</span><span>TARIF NON-BOURSIER</span></div>{MEALS.map((item, index) => <div className="tariff-row" key={item.name}><span><i className={`tariff-dot tariff-dot-${index}`} />{item.name}</span><label><input type="number" min="0" step="50" value={prices[index]} onChange={(event) => onPriceChange(index, Number(event.target.value))} aria-label={`Tarif boursier ${item.name}`} /> <small>FCFA</small></label><label><input type="number" min="0" step="50" value={nonScholarPrices[index]} onChange={(event) => onNonScholarPriceChange(index, Number(event.target.value))} aria-label={`Tarif non-boursier ${item.name}`} /> <small>FCFA</small></label></div>)}</div><button className="primary-button save-settings-button" type="button" onClick={() => onToast("Les tarifs de démonstration ont été mis à jour.")}>Enregistrer les tarifs <Icon name="check" size={16} /></button></section>
        <div className="settings-side"><section className="content-card settings-card codification-settings"><div className="section-heading"><div><h2>Fenêtre de codification</h2><p>Disponibilité du service pour les étudiants.</p></div><span className="settings-icon settings-icon-sand"><Icon name="calendar" size={18} /></span></div><div className="window-status"><span className="status-pill status-approved"><i /> {isOpen ? "OUVERTE" : "FERMÉE"}</span><p>{isOpen ? "Les étudiants peuvent déposer leur dossier et choisir un lit." : "Les dépôts et réservations sont temporairement suspendus."}</p></div><label className="settings-date-label">Date de clôture<input type="date" defaultValue="2026-11-20" /></label><button type="button" className="settings-toggle-row" onClick={() => onOpenChange(!isOpen)}><span><strong>Ouvrir la codification</strong><small>Autoriser les nouvelles demandes</small></span><span className={`toggle-switch${isOpen ? " toggle-on" : ""}`}><span /></span></button></section>
          <section className="content-card settings-card import-settings"><div className="section-heading"><div><h2>Liste des étudiants</h2><p>Importer les étudiants autorisés.</p></div><span className="settings-icon settings-icon-green"><Icon name="users" size={18} /></span></div><div className="import-dropzone"><Icon name="upload" size={20} /><strong>Préparez la liste codifiable</strong><small>L’import CSV et la revue des dossiers sont disponibles dans l’espace Dossiers étudiants.</small><button type="button" className="outline-button" onClick={() => onNavigate("dossiers")}>Ouvrir les dossiers <Icon name="arrow" size={14} /></button></div></section></div></div>
      <section className="content-card room-management-card"><div className="section-heading"><div><h2>Chambres et maintenance</h2><p>Bloquez temporairement une chambre indisponible.</p></div><span className="settings-icon settings-icon-green"><Icon name="building" size={18} /></span></div><div className="room-management-list">{DEMO_ROOMS.map((room) => { const blocked = blockedRooms.includes(room.room); const hasReservation = reservedBed?.startsWith(`${room.room}-`) ?? false; const freeBeds = room.available - Number(hasReservation); return <div className="room-management-row" key={room.room}><span><strong>{room.pavilion} · {room.room}</strong><small>{room.floor} · {room.type} · {freeBeds} lit{freeBeds === 1 ? "" : "s"} libre{freeBeds === 1 ? "" : "s"}{hasReservation ? " · 1 réservation" : ""}</small></span><button type="button" disabled={!blocked && hasReservation} className={`room-maintenance-button${blocked ? " room-maintenance-active" : ""}`} onClick={() => onToggleRoom(room.room)}>{blocked ? "Réouvrir" : hasReservation ? "Réservation active" : "Bloquer pour maintenance"}</button></div>; })}</div><p className="demo-data-note">Les changements sont partagés dans la maquette et réinitialisés au rechargement.</p></section>
      <section className="settings-security-note"><Icon name="shield" size={18} /><div><strong>Respect des données personnelles</strong><p>Les pièces justificatives doivent rester privées, accessibles uniquement à l’étudiant concerné et à l’administration.</p></div></section>
    </div>
  );
}

export default Portal;
