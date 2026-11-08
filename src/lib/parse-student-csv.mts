export type AdminStudent = {
  initials: string;
  name: string;
  number: string;
  program: string;
  date: string;
  status: "À vérifier" | "En attente" | "Validé" | "Rejeté";
  gender: "F" | "M";
};

function parseCsvRow(row: string, delimiter: string) {
  const cells: string[] = [];
  let cell = "";
  let quoted = false;

  for (let index = 0; index < row.length; index += 1) {
    const character = row[index];
    if (character === '"' && quoted && row[index + 1] === '"') {
      cell += '"';
      index += 1;
    } else if (character === '"') {
      quoted = !quoted;
    } else if (character === delimiter && !quoted) {
      cells.push(cell.trim());
      cell = "";
    } else {
      cell += character;
    }
  }
  if (quoted) throw new Error("Le CSV contient un champ entre guillemets non terminé.");
  cells.push(cell.trim());
  return cells;
}

export function parseStudentCsv(contents: string): AdminStudent[] {
  const rows = contents.replace(/^\uFEFF/, "").split(/\r?\n/).filter((row) => row.trim());
  if (rows.length < 2) throw new Error("Le CSV doit contenir une ligne d’en-tête et au moins un étudiant.");

  const delimiter = rows[0].includes(";") ? ";" : ",";
  const normalize = (value: string) =>
    value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
  const headers = parseCsvRow(rows[0], delimiter).map(normalize);
  const requiredHeaders = ["numero etudiant", "nom", "prenom", "date de naissance", "genre", "niveau", "email"];
  const missingHeaders = requiredHeaders.filter((header) => !headers.includes(header));
  if (missingHeaders.length) {
    throw new Error(`Colonnes CSV manquantes : ${missingHeaders.join(", ")}.`);
  }

  return rows.slice(1).map((row, index) => {
    const values = parseCsvRow(row, delimiter);
    const valueFor = (header: string) => values[headers.indexOf(header)]?.trim() ?? "";
    const number = valueFor("numero etudiant");
    const firstName = valueFor("prenom");
    const lastName = valueFor("nom");
    const email = valueFor("email");
    const genderValue = normalize(valueFor("genre"));
    if (!number || !firstName || !lastName || !email || !valueFor("niveau") || !valueFor("date de naissance")) {
      throw new Error(`Informations manquantes à la ligne ${index + 2}.`);
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new Error(`Adresse e-mail invalide à la ligne ${index + 2}.`);
    }
    if (!["f", "femme", "m", "homme"].includes(genderValue)) {
      throw new Error(`Genre invalide à la ligne ${index + 2} (utiliser F ou M).`);
    }

    return {
      initials: `${firstName[0]}${lastName[0]}`.toUpperCase(),
      name: `${firstName} ${lastName}`,
      number,
      program: valueFor("niveau"),
      date: "Importé à l’instant",
      status: "En attente",
      gender: genderValue.startsWith("f") ? "F" : "M",
    };
  });
}
