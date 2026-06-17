export type HotelStatus = "active" | "coming_soon";

export interface Hotel {
  id: string;
  name: string;
  shortName: string;
  primaryColor: string; // tailwind-compatible hex
  logoText: string; // initials shown as logo placeholder
  status: HotelStatus;
}

export interface UserProfile {
  id: string;
  hotel_id: string;
  name: string;
  email: string;
  password: string; // mock only
  role: "rondante";
}

export type ChecklistItemType = "conformidade" | "numero" | "texto";

export interface ChecklistItem {
  id: string;
  hotel_id: string;
  section: string;
  order: number;
  label: string;
  type: ChecklistItemType;
  requiresPhotoIfNonConform?: boolean;
}

export type ConformidadeAnswer = "conforme" | "nao_conforme" | "nao_realizado";

export interface ChecklistAnswer {
  itemId: string;
  // for conformidade
  conformity?: ConformidadeAnswer;
  // for numero
  numberValue?: number | null;
  // for texto
  textValue?: string;
  observation?: string;
  photoIds?: string[];
}

export type RoundStatus = "em_andamento" | "finalizado";
export type Shift = "diurno" | "noturno";

export interface Round {
  id: string;
  hotel_id: string;
  user_id: string;
  userName: string;
  number: number;
  year: number;
  shift: Shift;
  status: RoundStatus;
  startedAt: string; // ISO
  finishedAt?: string;
  serverStartedAt?: string | null; // reserved for future server time
  answers: Record<string, ChecklistAnswer>;
  generalObservation?: string;
  signatureDataUrl?: string;
  score?: number;
}

export interface StoredPhoto {
  id: string;
  round_id: string;
  item_id: string;
  dataUrl: string; // base64
  createdAt: string;
}
