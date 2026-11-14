export type ApiRole = "STUDENT" | "CONTROLLER" | "ADMIN";
export type UserGender = "MALE" | "FEMALE";

export type AuthUser = {
  id: string;
  studentNumber: string | null;
  firstName: string;
  lastName: string;
  email: string;
  role: ApiRole;
  gender: UserGender;
  codificationStatus: string;
  createdAt: string;
  updatedAt: string;
};

export type LoginResponse = {
  accessToken: string;
  tokenType: "Bearer";
  expiresIn: number;
  user: AuthUser;
};

type ApiRequestOptions = RequestInit & {
  authenticated?: boolean;
};

type ApiErrorPayload = {
  message?: string | string[];
};

const TOKEN_STORAGE_KEY = "uadb.accessToken";
const UNAUTHORIZED_EVENT = "uadb:unauthorized";

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function getAccessToken(): string | null {
  return typeof window === "undefined"
    ? null
    : window.localStorage.getItem(TOKEN_STORAGE_KEY);
}

export function setAccessToken(token: string): void {
  window.localStorage.setItem(TOKEN_STORAGE_KEY, token);
}

export function clearAccessToken(): void {
  if (typeof window !== "undefined") {
    window.localStorage.removeItem(TOKEN_STORAGE_KEY);
  }
}

function getErrorMessage(status: number, payload?: ApiErrorPayload): string {
  if (status === 401) {
    return "Identifiants invalides ou session expirée.";
  }
  if (status === 403) {
    return "Accès refusé.";
  }
  if (status === 409) {
    return "Cette adresse e-mail ou ce numéro étudiant est déjà utilisé.";
  }
  if (status >= 500) {
    return "Le service est temporairement indisponible. Réessayez plus tard.";
  }
  if (status === 400 || status === 422) {
    return "Les informations saisies sont invalides. Vérifiez les champs.";
  }
  if (typeof payload?.message === "string") {
    return payload.message;
  }
  if (Array.isArray(payload?.message)) {
    return payload.message.join(" ");
  }
  return "Une erreur est survenue. Réessayez.";
}

async function apiFetch(
  path: string,
  options: ApiRequestOptions = {},
): Promise<Response> {
  if (typeof window === "undefined") {
    throw new ApiError("Les appels à l’API sont réservés au navigateur.", 0);
  }

  const apiUrl = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (!apiUrl) {
    throw new ApiError(
      "L’API n’est pas configurée. Définissez NEXT_PUBLIC_API_URL.",
      0,
    );
  }

  const { authenticated = true, headers: requestHeaders, ...requestOptions } =
    options;
  const headers = new Headers(requestHeaders);
  if (
    typeof requestOptions.body === "string" &&
    !headers.has("Content-Type")
  ) {
    headers.set("Content-Type", "application/json");
  }

  const token = authenticated ? getAccessToken() : null;
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const baseUrl = `${apiUrl.replace(/\/+$/, "")}/`;
  let response: Response;
  try {
    response = await fetch(new URL(path.replace(/^\/+/, ""), baseUrl), {
      ...requestOptions,
      cache: "no-store",
      headers,
    });
  } catch {
    throw new ApiError(
      "Impossible de joindre le serveur. Vérifiez votre connexion et la disponibilité de l’API.",
      0,
    );
  }

  if (!response.ok) {
    const responseText = await response.text();
    let payload: unknown;
    try {
      payload = responseText ? JSON.parse(responseText) : undefined;
    } catch {
      payload = undefined;
    }

    if (response.status === 401) {
      clearAccessToken();
      window.dispatchEvent(new Event(UNAUTHORIZED_EVENT));
    }

    throw new ApiError(
      getErrorMessage(
        response.status,
        payload && typeof payload === "object"
          ? (payload as ApiErrorPayload)
          : undefined,
      ),
      response.status,
    );
  }

  return response;
}

export async function apiRequest<T>(
  path: string,
  options: ApiRequestOptions = {},
): Promise<T> {
  const response = await apiFetch(path, options);
  const responseText = await response.text();
  if (!responseText) {
    return undefined as T;
  }
  try {
    return JSON.parse(responseText) as T;
  } catch {
    throw new ApiError("Réponse invalide reçue du serveur.", response.status);
  }
}

export function apiRequestBlob(
  path: string,
  options: ApiRequestOptions = {},
): Promise<Blob> {
  return apiFetch(path, options).then((response) => response.blob());
}
