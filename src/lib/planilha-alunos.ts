import * as XLSX from "xlsx";

/** Converte um arquivo (CSV, TXT, XLSX, XLS) em texto delimitado por ";" */
export async function arquivoParaTexto(arquivo: File): Promise<string> {
  const nome = arquivo.name.toLowerCase();
  const ehPlanilha = /\.(xlsx|xls|xlsm|ods)$/.test(nome);
  if (!ehPlanilha) return await arquivo.text();

  const buffer = await arquivo.arrayBuffer();
  const wb = XLSX.read(buffer, { type: "array" });
  const primeira = wb.SheetNames[0];
  if (!primeira) return "";
  const planilha = wb.Sheets[primeira];
  if (!planilha) return "";
  return XLSX.utils
    .sheet_to_csv(planilha, { FS: ";", blankrows: false })
    .split("\n")
    .map((l) => l.replace(/;+$/, ""))
    .filter((l) => l.replace(/;/g, "").trim().length > 0)
    .join("\n");
}

export const ACEITA_ARQUIVOS =
  ".csv,.txt,.xlsx,.xls,text/csv,text/plain,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

const CABECALHO_MODELO = ["nome", "email", "telefone", "tipo", "nome_casal", "senha"];

const EXEMPLOS_MODELO = [
  ["Maria Silva", "maria@exemplo.com", "62999990000", "individual", "", ""],
  ["João e Ana Souza", "joao@exemplo.com", "62988880000", "casal", "João e Ana Souza", ""],
];

/** Gera e baixa um template .xlsx com as colunas esperadas na importação */
export function baixarModeloXLSX() {
  const planilha = XLSX.utils.aoa_to_sheet([
    CABECALHO_MODELO,
    ...EXEMPLOS_MODELO,
    [],
    ["Instruções:"],
    ["nome e email são obrigatórios"],
    ["tipo: individual ou casal"],
    ["nome_casal: obrigatório quando tipo for casal"],
    ["senha: opcional (mínimo 6 caracteres); em branco, o sistema gera uma"],
    ["Apague as linhas de exemplo e de instruções antes de importar"],
  ]);
  planilha["!cols"] = [{ wch: 28 }, { wch: 28 }, { wch: 16 }, { wch: 12 }, { wch: 28 }, { wch: 14 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, planilha, "Alunos");
  XLSX.writeFile(wb, "modelo-alunos.xlsx");
}
