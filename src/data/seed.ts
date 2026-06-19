import type { ChecklistItem, Hotel, UserProfile } from "@/lib/types";

export const HOTELS: Hotel[] = [
  {
    id: "wellness",
    name: "Wellness Beach Park Resort",
    shortName: "Wellness",
    primaryColor: "#0f3a5f",
    logoText: "W",
    status: "active",
  },
  {
    id: "acqua",
    name: "Acqua Beach Park Resort",
    shortName: "Acqua",
    primaryColor: "#0b6e8c",
    logoText: "A",
    status: "active",
  },
  {
    id: "suites",
    name: "Suites Beach Park Resort",
    shortName: "Suites",
    primaryColor: "#103a6b",
    logoText: "S",
    status: "active",
  },
  {
    id: "oceani",
    name: "Oceani Beach Park Resort",
    shortName: "Oceani",
    primaryColor: "#0a5a78",
    logoText: "O",
    status: "active",
  },
  {
    id: "ohana",
    name: "Ohana Beach Park Resort",
    shortName: "Ohana",
    primaryColor: "#475569",
    logoText: "Oh",
    status: "coming_soon",
  },
];

export const USERS: UserProfile[] = [
  { id: "u1", hotel_id: "wellness", name: "Carlos Wellness", email: "wellness@ronda.com", password: "123456", role: "rondante" },
  { id: "u2", hotel_id: "acqua", name: "Bruno Acqua", email: "acqua@ronda.com", password: "123456", role: "rondante" },
  { id: "u3", hotel_id: "suites", name: "Diego Suites", email: "suites@ronda.com", password: "123456", role: "rondante" },
  { id: "u4", hotel_id: "oceani", name: "Eduardo Oceani", email: "oceani@ronda.com", password: "123456", role: "rondante" },
];

const blockChecklist = (blockNumber: number): Omit<ChecklistItem, "id" | "hotel_id">[] => {
  const block = String(blockNumber).padStart(2, "0");

  return [
    {
      section: `Bloco ${block}`,
      order: 1,
      label: "Extintores / equipamentos de incêndio",
      type: "conformidade",
      auditKind: "extintores",
    },
    {
      section: `Bloco ${block}`,
      order: 2,
      label: "Hidrantes / mangueiras",
      type: "conformidade",
      auditKind: "hidrantes",
    },
    {
      section: `Bloco ${block}`,
      order: 3,
      label: "Elevadores",
      type: "conformidade",
      auditKind: "elevadores",
    },
    {
      section: `Bloco ${block}`,
      order: 4,
      label: "Escadas e rota de fuga",
      type: "conformidade",
      auditKind: "escadas",
    },
  ];
};

const blockItems = Array.from({ length: 7 }, (_, index) => blockChecklist(index + 1)).flat();

const baseChecklist: Omit<ChecklistItem, "id" | "hotel_id">[] = [
  // Estacionamento Subsolo Bloco 01
  { section: "Estacionamento Subsolo Bloco 01", order: 1, label: "Vagas livres estacionamento subsolo bloco 01", type: "numero" },
  { section: "Estacionamento Subsolo Bloco 01", order: 2, label: "Estacionamento subsolo bloco 01", type: "conformidade" },
  { section: "Estacionamento Subsolo Bloco 01", order: 3, label: "Quantidade de veículos estacionamento subsolo bloco 01", type: "numero" },

  // Blocos do hotel
  ...blockItems,

  // Estacionamento Bloco 03
  { section: "Estacionamento Bloco 03", order: 1, label: "Estacionamento bloco 03", type: "conformidade" },
  { section: "Estacionamento Bloco 03", order: 2, label: "Quantidade de veículos estacionamento bloco 03", type: "numero" },
  { section: "Estacionamento Bloco 03", order: 3, label: "Vagas livres estacionamento bloco 03", type: "numero" },

  // Áreas Comuns
  { section: "Áreas Comuns", order: 1, label: "Restaurante", type: "conformidade" },
  { section: "Áreas Comuns", order: 2, label: "Recepção", type: "conformidade" },
  { section: "Áreas Comuns", order: 3, label: "Área Comum / Playground", type: "conformidade" },
  { section: "Áreas Comuns", order: 4, label: "Área Comum / Piscinas Bar Molhado", type: "conformidade" },

  // Estacionamento Subsolo Bloco 07
  { section: "Estacionamento Subsolo Bloco 07", order: 1, label: "Estacionamento subsolo bloco 07", type: "conformidade" },
  { section: "Estacionamento Subsolo Bloco 07", order: 2, label: "Quantidade de veículos estacionamento subsolo bloco 07", type: "numero" },
  { section: "Estacionamento Subsolo Bloco 07", order: 3, label: "Vagas livres estacionamento subsolo bloco 07", type: "numero" },
];

export const CHECKLIST_ITEMS: ChecklistItem[] = HOTELS
  .filter((h) => h.status === "active")
  .flatMap((h) =>
    baseChecklist.map((c, idx) => ({
      ...c,
      id: `${h.id}-${idx + 1}`,
      hotel_id: h.id,
    })),
  );

export const SECTION_ORDER = [
  "Estacionamento Subsolo Bloco 01",
  "Bloco 01",
  "Bloco 02",
  "Bloco 03",
  "Bloco 04",
  "Bloco 05",
  "Bloco 06",
  "Bloco 07",
  "Estacionamento Bloco 03",
  "Áreas Comuns",
  "Estacionamento Subsolo Bloco 07",
];
