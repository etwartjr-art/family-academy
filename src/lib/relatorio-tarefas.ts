import { baixarCSV } from "@/lib/api";

export type LinhaRelatorio = {
  curso: string;
  sala: string;
  modulo: string;
  aluno: string;
  codigo: string;
  tipo: string;
  nomeCasal: string;
  concluidas: number;
  total: number;
  percentual: number;
};

const CABECALHO = [
  "Curso",
  "Turma",
  "Módulo",
  "Aluno",
  "Código",
  "Tipo",
  "Nome do casal",
  "Concluídas",
  "Total",
  "%",
];

function celulas(l: LinhaRelatorio) {
  return [
    l.curso,
    l.sala,
    l.modulo,
    l.aluno,
    l.codigo,
    l.tipo,
    l.nomeCasal,
    l.concluidas,
    l.total,
    `${l.percentual}%`,
  ];
}

export function exportarRelatorioCSV(linhas: LinhaRelatorio[]) {
  baixarCSV("conclusoes-por-aluno-e-modulo.csv", [CABECALHO, ...linhas.map(celulas)]);
}

export async function exportarRelatorioPDF(linhas: LinhaRelatorio[]) {
  const [{ jsPDF }, autoTableMod] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);
  const autoTable = autoTableMod.default;
  const doc = new jsPDF({ orientation: "landscape" });

  doc.setFontSize(14);
  doc.text("Conclusões de tarefas por aluno e módulo — Escola de Finanças", 14, 14);
  doc.setFontSize(9);
  doc.text(
    `${linhas.length} registro(s) · gerado em ${new Date().toLocaleDateString("pt-BR")}`,
    14,
    20,
  );

  autoTable(doc, {
    startY: 26,
    head: [CABECALHO],
    body: linhas.map((l) => celulas(l).map(String)),
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [10, 42, 102] },
    margin: { left: 14, right: 14 },
  });

  doc.save("conclusoes-por-aluno-e-modulo.pdf");
}
