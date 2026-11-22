"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import {
  apiRequest,
  clearAccessToken,
  getAccessToken,
  setAccessToken,
  type ApiRole,
  type AuthUser,
  type LoginResponse,
} from "../lib/api";
import BusinessPages from "./business-pages";
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

const ALLOWED_SCREENS: Record<Role, Screen[]> = {
  student: ["etudiant", "achat", "recharge", "historique", "qr", "codification"],
  controller: ["controleur"],
  admin: ["admin", "dossiers", "parametres"],
};

// L'écran courant est reflété dans l'URL (#codification) : le bouton « retour »
// du navigateur et l'actualisation de la page fonctionnent.
function screenFromHash(apiRole: ApiRole): Screen {
  const hashScreen = (typeof window === "undefined" ? "" : window.location.hash.slice(1)) as Screen;
  return ALLOWED_SCREENS[getPortalRole(apiRole)].includes(hashScreen)
    ? hashScreen
    : getRoleHomeScreen(apiRole);
}

const STUDENT_NAV: { label: string; screen: Screen; icon: IconName }[] = [
  { label: "Vue d’ensemble", screen: "etudiant", icon: "grid" },
  { label: "Acheter un ticket", screen: "achat", icon: "ticket" },
  { label: "Recharger le portefeuille", screen: "recharge", icon: "wallet" },
  { label: "Historique", screen: "historique", icon: "clock" },
  { label: "Mon QR code", screen: "qr", icon: "qr" },
  { label: "Codification", screen: "codification", icon: "building" },
];

const ADMIN_NAV: { label: string; screen: Screen; icon: IconName }[] = [
  { label: "Vue d’ensemble", screen: "admin", icon: "chart" },
  { label: "Dossiers étudiants", screen: "dossiers", icon: "users" },
  { label: "Paramètres", screen: "parametres", icon: "settings" },
];

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

function Portal() {
  const [screen, setScreen] = useState<Screen>("connexion");
  const [role, setRole] = useState<Role>("student");
  const [user, setUser] = useState<AuthUser | null>(null);
  const [registering, setRegistering] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [authSubmitting, setAuthSubmitting] = useState(false);
  const [authError, setAuthError] = useState("");
  const [toast, setToast] = useState("");

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
        const initialScreen = screenFromHash(authenticatedUser.role);
        setUser(authenticatedUser);
        setRole(authenticatedRole);
        setScreen(initialScreen);
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
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 3200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  // Écran -> URL
  useEffect(() => {
    if (!user || screen === "connexion") return;
    const target = `#${screen}`;
    if (window.location.hash !== target) {
      window.history.pushState(null, "", target);
    }
  }, [screen, user]);

  // URL -> écran (bouton retour/avant, lien modifié à la main)
  useEffect(() => {
    if (!user) return;
    const handleHashChange = () => {
      const nextScreen = window.location.hash.slice(1) as Screen;
      if (ALLOWED_SCREENS[role].includes(nextScreen)) {
        setScreen(nextScreen);
      }
    };
    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, [user, role]);

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

  function showToast(message: string) {
    setToast(message);
  }

  function routeToRole(apiRole: ApiRole) {
    const nextRole = getPortalRole(apiRole);
    setRole(nextRole);
    setScreen(screenFromHash(apiRole));
    setRegistering(false);
  }

  async function refreshUser(): Promise<void> {
    try {
      setUser(await apiRequest<AuthUser>("auth/me"));
    } catch {
      // Un échec ici ne doit pas interrompre l'action en cours : le profil sera
      // rechargé à la prochaine navigation ou au prochain rafraîchissement.
    }
  }

  function navigateToScreen(nextScreen: Screen) {
    if (!user || !ALLOWED_SCREENS[role].includes(nextScreen)) {
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

        await apiRequest<AuthUser>("auth/register", {
          method: "POST",
          authenticated: false,
          body: JSON.stringify({
            firstName: String(formData.get("firstName") ?? "").trim(),
            lastName: String(formData.get("lastName") ?? "").trim(),
            email,
            password,
            gender,
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
    window.history.replaceState(null, "", window.location.pathname + window.location.search);
    setUser(null);
    setScreen("connexion");
    setRole("student");
    setRegistering(false);
    setAuthError("");
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
              <BusinessPages
                screen={screen as Exclude<Screen, "connexion">}
                user={user}
                onNavigate={(nextScreen) => navigateToScreen(nextScreen)}
                onUserRefresh={refreshUser}
              />
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
          <p className="login-subtitle">{registering ? "Quelques informations pour commencer. Votre numéro étudiant sera vérifié plus tard, dans l’espace Codification." : "Connectez-vous pour accéder à vos services universitaires."}</p>
          {error && <p className="auth-error" role="alert">{error}</p>}
          <form className="login-form" onSubmit={onSubmit}>
            {registering && <>
              <label>Prénom<div className="input-wrap"><Icon name="user" size={18} /><input name="firstName" autoComplete="given-name" maxLength={100} required /></div></label>
              <label>Nom<div className="input-wrap"><Icon name="user" size={18} /><input name="lastName" autoComplete="family-name" maxLength={100} required /></div></label>
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

export default Portal;
