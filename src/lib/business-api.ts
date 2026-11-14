import { apiRequest, apiRequestBlob } from "./api";

export type MealService = "BREAKFAST" | "LUNCH" | "DINNER";
export type TransactionKind = "CREDIT" | "DEBIT";
export type TransactionStatus = "SUCCESS" | "FAILED";
export type DocumentStatus = "PENDING" | "APPROVED" | "REJECTED";
export type BedStatus = "AVAILABLE" | "OCCUPIED" | "MAINTENANCE";

export type MealPrices = {
  currency: "XOF";
  prices: Record<MealService, number>;
};

export type Wallet = {
  balance: number;
  currency: "XOF";
};

export type WalletTransaction = {
  id: string;
  type: TransactionKind;
  status: TransactionStatus;
  amount: number;
  createdAt: string;
  currency: "XOF";
};

export type Bed = {
  id: string;
  label: string;
  status: BedStatus;
  room: {
    number: string;
    floor: number;
    pavilion: {
      id: string;
      name: string;
      gender: "MALE" | "FEMALE";
    };
  };
};

export type CodificationDocument = {
  id: string;
  type: "CNI" | "STUDENT_CARD" | string;
  fileName: string | null;
  mimeType: string | null;
  status: DocumentStatus;
  rejectionReason: string | null;
  createdAt: string;
  user: {
    studentNumber: string | null;
    firstName: string;
    lastName: string;
    email: string;
    codificationStatus: string;
  };
};

export type EligibilityResult = {
  eligible: boolean;
  message: string;
  student: {
    studentNumber: string;
    firstName: string;
    lastName: string;
    level: string;
    genre: "MALE" | "FEMALE";
    email: string;
  };
};

export type ApiResultMessage = {
  success: boolean;
  message: string;
};

export type PurchaseResult = {
  transaction: WalletTransaction;
  tickets: Array<{ id: string; service: MealService; status: string }>;
  balance: number;
  pricePerTicket: number;
  currency: "XOF";
};

export type TopUpResult = {
  transaction: WalletTransaction;
  balance: number;
  currency: "XOF";
};

export type ScanResponse = {
  result:
    | "OK"
    | "INSUFFICIENT_BALANCE"
    | "ALREADY_SERVED"
    | "INVALID_TOKEN"
    | "TICKET_NOT_FOUND";
  message: string;
  balance?: number;
  amount?: number;
  currency?: "XOF";
};

export type QrTokenResponse = {
  qrToken: string;
  tokenType: "Bearer";
  expiresIn: number;
  expiresAt: string;
};

export type BedFilters = {
  pavilion?: string;
  floor?: number;
  gender?: "MALE" | "FEMALE";
  status?: BedStatus;
};

export const mealServiceByName = {
  "Petit-déjeuner": "BREAKFAST",
  Déjeuner: "LUNCH",
  Dîner: "DINNER",
} as const satisfies Record<string, MealService>;

export async function getWallet(): Promise<Wallet> {
  return apiRequest<Wallet>("wallet");
}

export async function getMealPrices(): Promise<MealPrices> {
  return apiRequest<MealPrices>("tickets/prices");
}

export async function getWalletTransactions(): Promise<WalletTransaction[]> {
  return apiRequest<WalletTransaction[]>("wallet/transactions");
}

export async function topUpWallet(
  amount: number,
  simulateFailure: boolean,
): Promise<TopUpResult> {
  return apiRequest<TopUpResult>("wallet/top-up", {
    method: "POST",
    body: JSON.stringify({ amount, simulateFailure }),
  });
}

export async function purchaseTickets(
  service: MealService,
  quantity: number,
  simulateFailure: boolean,
): Promise<PurchaseResult> {
  return apiRequest<PurchaseResult>("tickets/purchase", {
    method: "POST",
    body: JSON.stringify({ service, quantity, simulateFailure }),
  });
}

export async function createQrToken(): Promise<QrTokenResponse> {
  return apiRequest<QrTokenResponse>("tickets/qr-token", {
    method: "POST",
  });
}

export async function scanMeal(
  qrToken: string,
  service: MealService,
): Promise<ScanResponse> {
  return apiRequest<ScanResponse>("tickets/scan", {
    method: "POST",
    body: JSON.stringify({ qrToken, service }),
  });
}

export async function verifyStudentEligibility(
  studentNumber: string,
  birthDate: string,
): Promise<EligibilityResult> {
  return apiRequest<EligibilityResult>("codification/verify", {
    method: "POST",
    body: JSON.stringify({ studentNumber, birthDate }),
  });
}

export async function uploadForm<T>(
  path: string,
  formData: FormData,
): Promise<T> {
  return apiRequest<T>(path, { method: "POST", body: formData });
}

export async function getBeds(filters: BedFilters): Promise<Bed[]> {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== "") {
      query.set(key, String(value));
    }
  }
  return apiRequest<Bed[]>(
    `codification/beds${query.size ? `?${query.toString()}` : ""}`,
  );
}

export async function reserveBed(
  bedId: string,
  studentNumber: string,
): Promise<ApiResultMessage> {
  return apiRequest<ApiResultMessage>(
    `codification/beds/${encodeURIComponent(bedId)}/reserve`,
    {
      method: "POST",
      body: JSON.stringify({ studentNumber }),
    },
  );
}

export async function getAdminDocuments(): Promise<CodificationDocument[]> {
  return apiRequest<CodificationDocument[]>("codification/admin/documents");
}

export async function validateAdminDocument(
  documentId: string,
  status: Exclude<DocumentStatus, "PENDING">,
  rejectionReason?: string,
): Promise<ApiResultMessage> {
  return apiRequest<ApiResultMessage>(
    `codification/admin/documents/${encodeURIComponent(documentId)}/validate`,
    {
      method: "PATCH",
      body: JSON.stringify({
        status,
        ...(status === "REJECTED" ? { rejectionReason } : {}),
      }),
    },
  );
}

export async function importCodifiableStudents(file: File): Promise<{
  success: boolean;
  message: string;
  importedCount: number;
}> {
  const formData = new FormData();
  formData.append("file", file);
  return uploadForm("codification/import", formData);
}

export async function downloadDocument(
  documentId: string,
  studentNumber: string,
  isAdmin: boolean,
): Promise<Blob> {
  const query = new URLSearchParams({
    studentNumber,
    ...(isAdmin ? { isAdmin: "true" } : {}),
  });
  return apiRequestBlob(
    `codification/documents/${encodeURIComponent(documentId)}/download?${query}`,
  );
}
