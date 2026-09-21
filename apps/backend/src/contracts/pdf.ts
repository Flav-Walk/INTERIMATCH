import { PDFDocument, StandardFonts, rgb, type PDFFont } from "pdf-lib";
import type {
  ContractSignatureEvent,
  ContractSnapshot,
} from "./schemas.js";

const forest = rgb(0.02, 0.27, 0.2);
const orange = rgb(0.91, 0.42, 0.12);
const ink = rgb(0.12, 0.16, 0.14);
const muted = rgb(0.32, 0.38, 0.35);
const pale = rgb(0.93, 0.97, 0.95);

const printable = (value: unknown) =>
  String(value ?? "")
    .replace(/[’‘]/g, "'")
    .replace(/[–—]/g, "-")
    .replace(/…/g, "...")
    .replace(/\u00a0/g, " ");

const date = (value: string) =>
  new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "Europe/Paris",
  }).format(new Date(value));

const pay = (snapshot: ContractSnapshot) => {
  const amount = snapshot.mission.pay_amount;
  if (amount === null) return "Non renseignée dans InteriMatch";
  const units: Record<string, string> = {
    hour: "par heure",
    day: "par jour",
    mission: "pour la mission",
  };
  return `${amount} EUR ${units[snapshot.mission.pay_unit ?? ""] ?? snapshot.mission.pay_unit ?? ""}`.trim();
};

function wrappedLines(font: PDFFont, text: string, size: number, width: number) {
  const words = printable(text).split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) <= width) line = candidate;
    else {
      if (line) lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines.length ? lines : ["-"];
}

export async function generateContractPdf(
  contractId: string,
  version: number,
  snapshot: ContractSnapshot,
  signatures: ContractSignatureEvent[] = [],
) {
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  pdf.setTitle(`Document de mission InteriMatch ${contractId}`);
  pdf.setAuthor("InteriMatch");
  pdf.setSubject("Document contractuel de démonstration");
  pdf.setCreationDate(new Date(snapshot.generated_at));
  pdf.setModificationDate(new Date(snapshot.generated_at));

  let page = pdf.addPage([595.28, 841.89]);
  let y = 790;
  const margin = 52;
  const width = 595.28 - margin * 2;

  const header = () => {
    page.drawText("InteriMatch", {
      x: margin,
      y: 798,
      size: 18,
      font: bold,
      color: forest,
    });
    page.drawRectangle({ x: margin, y: 785, width, height: 2, color: orange });
  };
  header();

  const ensure = (height: number) => {
    if (y - height > 54) return;
    page = pdf.addPage([595.28, 841.89]);
    header();
    y = 760;
  };
  const text = (
    value: string,
    options: { size?: number; font?: PDFFont; color?: ReturnType<typeof rgb> } = {},
  ) => {
    const size = options.size ?? 10;
    const selected = options.font ?? regular;
    const lines = wrappedLines(selected, value, size, width);
    ensure(lines.length * (size + 4));
    for (const line of lines) {
      page.drawText(line, {
        x: margin,
        y,
        size,
        font: selected,
        color: options.color ?? ink,
      });
      y -= size + 4;
    }
  };
  const section = (title: string) => {
    ensure(38);
    y -= 8;
    page.drawRectangle({ x: margin, y: y - 5, width, height: 24, color: pale });
    page.drawText(printable(title), {
      x: margin + 9,
      y,
      size: 11,
      font: bold,
      color: forest,
    });
    y -= 28;
  };
  const field = (label: string, value: unknown) => {
    text(`${label} : ${value === null || value === "" ? "Non renseigné" : printable(value)}`);
  };

  text("DOCUMENT DE MISSION", { size: 20, font: bold, color: forest });
  text("Validation électronique interne de démonstration", {
    size: 12,
    font: bold,
    color: orange,
  });
  y -= 4;
  text(snapshot.legal_notice, { size: 9, color: muted });
  field("Identifiant", contractId);
  field("Version", version);
  field("Généré le", date(snapshot.generated_at));

  section("Entreprise");
  field("Raison sociale", snapshot.company.legal_name);
  field("Établissement", snapshot.company.establishment_name);
  field(
    "Compte représentant",
    `${snapshot.company.representative_first_name} ${snapshot.company.representative_last_name}`.trim(),
  );
  field("Adresse", snapshot.company.address);
  field(
    "Localité",
    [snapshot.company.postal_code, snapshot.company.city].filter(Boolean).join(" "),
  );
  field("Téléphone", snapshot.company.phone);
  field("Email", snapshot.company.email);

  section("Intérimaire");
  field(
    "Nom",
    `${snapshot.worker.first_name} ${snapshot.worker.last_name}`.trim(),
  );
  field("Localité déclarée", [snapshot.worker.postal_code, snapshot.worker.city].filter(Boolean).join(" "));
  field("Téléphone", snapshot.worker.phone);
  field("Email", snapshot.worker.email);

  section("Mission");
  field("Intitulé", snapshot.mission.title);
  field("Métier", snapshot.mission.job);
  field("Début", date(snapshot.mission.starts_at));
  field("Fin", date(snapshot.mission.ends_at));
  field(
    "Lieu",
    [
      snapshot.mission.address,
      snapshot.mission.postal_code,
      snapshot.mission.city,
    ]
      .filter(Boolean)
      .join(", "),
  );
  field("Rémunération déclarée", pay(snapshot));
  field("Description", snapshot.mission.description);
  field("Candidature liée", snapshot.application.id);
  field("Acceptée le", date(snapshot.application.accepted_at));

  section("Traçabilité des validations internes");
  if (!signatures.length) {
    text("Aucune validation enregistrée.", { color: muted });
  } else {
    for (const signature of signatures) {
      field(
        signature.actor_role === "worker"
          ? "Validation intérimaire"
          : "Validation entreprise",
        `${date(signature.created_at)} - utilisateur ${signature.actor_id}`,
      );
    }
  }

  y -= 10;
  text(
    "Ce document ne constitue ni une signature électronique qualifiée ni, à lui seul, un contrat de travail juridiquement complet.",
    { size: 9, font: bold, color: muted },
  );

  return new Uint8Array(await pdf.save({ useObjectStreams: false }));
}

