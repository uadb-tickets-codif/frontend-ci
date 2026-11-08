import assert from "node:assert/strict";
import test from "node:test";
import { parseStudentCsv } from "./parse-student-csv.mts";

test("parses accented headers and semicolon-separated student data", () => {
  const [student] = parseStudentCsv(
    "Numéro étudiant;Nom;Prénom;Date de naissance;Genre;Niveau;Email\n2024-01842;Diallo;Amadou;2001-02-03;M;Master 2;amadou@uadb.edu.sn",
  );

  assert.deepEqual(student, {
    initials: "AD",
    name: "Amadou Diallo",
    number: "2024-01842",
    program: "Master 2",
    date: "Importé à l’instant",
    status: "En attente",
    gender: "M",
  });
});

test("accepts a UTF-8 BOM and rejects invalid email addresses", () => {
  const header = "\uFEFFnumero etudiant;nom;prenom;date de naissance;genre;niveau;email";
  assert.equal(
    parseStudentCsv(`${header}\n2024-1;Diallo;Amadou;2001-01-01;M;Master;amadou@uadb.edu.sn`).length,
    1,
  );
  assert.throws(
    () => parseStudentCsv(`${header}\n2024-1;Diallo;Amadou;2001-01-01;M;Master;invalid-email`),
    /Adresse e-mail invalide à la ligne 2/,
  );
});

test("handles commas inside quoted values", () => {
  const [student] = parseStudentCsv(
    'numero etudiant,nom,prenom,date de naissance,genre,niveau,email\n2024-1,"Ndiaye, Fall",Mariama,2002-01-01,F,"Master 1, informatique",mariama@uadb.edu.sn',
  );

  assert.equal(student.name, "Mariama Ndiaye, Fall");
  assert.equal(student.program, "Master 1, informatique");
});

test("rejects CSVs with missing headers", () => {
  assert.throws(
    () => parseStudentCsv("nom;prenom\nDiallo;Amadou"),
    /Colonnes CSV manquantes/,
  );
});

test("rejects rows with invalid gender or missing required values", () => {
  const header = "numero etudiant;nom;prenom;date de naissance;genre;niveau;email";
  assert.throws(
    () => parseStudentCsv(`${header}\n2024-1;Diallo;Amadou;2001-01-01;X;Master;amadou@uadb.edu.sn`),
    /Genre invalide à la ligne 2/,
  );
  assert.throws(
    () => parseStudentCsv(`${header}\n2024-1;Diallo;;2001-01-01;M;Master;amadou@uadb.edu.sn`),
    /Informations manquantes à la ligne 2/,
  );
});
