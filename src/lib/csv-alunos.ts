export type LinhaCSV = {
  linha: number;
  nome: string;
  email: string;
  telefone: string;
  senha: string;
  tipo: "individual" | "casal";
  nome_casal: string;
  erros: string[];
  /** "identico" = mesmo nome+e-mail; "email" = mesmo e-mail com nome diferente */
  duplicado: "identico" | "email" | null;
  duplicadoDaLinha: number | null;

};

const CABECALHOS: Record<string, keyof Omit<LinhaCSV, "linha" | "erros">> = {
  nome: "nome",
  "nome do aluno": "nome",
  aluno: "nome",
  email: "email",
  "e-mail": "email",
  telefone: "telefone",
  celular: "telefone",
  senha: "senha",
  tipo: "tipo",
  "tipo de matricula": "tipo",
  "tipo de matrícula": "tipo",
  casal: "nome_casal",
  "nome do casal": "nome_casal",
  nome_casal: "nome_casal",
};

function separador(linha: string) {
  const candidatos = [";", ",", "\t"];
  return candidatos.sort((a, b) => linha.split(b).length - linha.split(a).length)[0] ?? ",";
}

function partir(linha: string, sep: string) {
  const saida: string[] = [];
  let atual = "";
  let entreAspas = false;
  for (let i = 0; i < linha.length; i++) {
    const c = linha[i];
    if (c === '"') {
      if (entreAspas && linha[i + 1] === '"') {
        atual += '"';
        i++;
      } else entreAspas = !entreAspas;
    } else if (c === sep && !entreAspas) {
      saida.push(atual);
      atual = "";
    } else atual += c;
  }
  saida.push(atual);
  return saida.map((v) => v.trim());
}

const normalizar = (v: string) =>
  v
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

export function analisarCSVAlunos(texto: string): LinhaCSV[] {
  const linhas = texto
    .replace(/\r/g, "")
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  if (linhas.length === 0) return [];

  const sep = separador(linhas[0]!);
  const primeira = partir(linhas[0]!, sep);
  const temCabecalho = primeira.some((c) => normalizar(c) in CABECALHOS);

  const mapa: (keyof Omit<LinhaCSV, "linha" | "erros"> | null)[] = temCabecalho
    ? primeira.map((c) => CABECALHOS[normalizar(c)] ?? null)
    : ["nome", "email", "telefone", "tipo", "nome_casal", "senha"];

  const corpo = temCabecalho ? linhas.slice(1) : linhas;
  const vistos = new Set<string>();

  return corpo.map((bruta, idx) => {
    const cols = partir(bruta, sep);
    const item: LinhaCSV = {
      linha: idx + (temCabecalho ? 2 : 1),
      nome: "",
      email: "",
      telefone: "",
      senha: "",
      tipo: "individual",
      nome_casal: "",
      erros: [],
    };

    cols.forEach((valor, i) => {
      const campo = mapa[i];
      if (!campo) return;
      if (campo === "tipo") {
        const t = normalizar(valor);
        item.tipo = t.startsWith("casal") || t === "c" ? "casal" : "individual";
      } else {
        item[campo] = valor;
      }
    });

    // Campos obrigatórios
    if (!item.nome) item.erros.push("Nome é obrigatório");
    else if (item.nome.replace(/[^\p{L}]/gu, "").length < 2) item.erros.push("Nome inválido");
    else if (item.nome.length > 120) item.erros.push("Nome muito longo (máx. 120)");

    if (!item.email) item.erros.push("E-mail é obrigatório");
    else if (item.email.length > 255) item.erros.push("E-mail muito longo (máx. 255)");
    else if (!/^[^\s@,;]+@[^\s@,;]+\.[a-z]{2,}$/i.test(item.email))
      item.erros.push("E-mail inválido (ex.: nome@dominio.com)");

    // Telefone: opcional, mas quando informado precisa ter DDD + 8/9 dígitos
    if (item.telefone) {
      const digitos = item.telefone.replace(/\D/g, "");
      if (/[a-zA-Z]/.test(item.telefone)) item.erros.push("Telefone não pode conter letras");
      else if (digitos.length < 10 || digitos.length > 13)
        item.erros.push("Telefone inválido (use DDD + número, ex.: 62999990000)");
      else item.telefone = digitos;
    }

    if (item.tipo === "casal" && item.nome_casal.replace(/[^\p{L}]/gu, "").length < 2)
      item.erros.push("Nome do casal é obrigatório quando o tipo é Casal");
    if (item.senha && item.senha.length < 6) item.erros.push("Senha precisa ter 6+ caracteres");

    return item;
  });

  // Duplicados: mesma combinação nome+e-mail = idêntico; mesmo e-mail com nome
  // diferente = conflito que pode ser mesclado manualmente.
  const porChave = new Map<string, number>();
  const porEmail = new Map<string, number>();
  for (const item of itens) {
    const email = item.email.toLowerCase();
    if (!email) continue;
    const chave = `${normalizar(item.nome)}|${email}`;
    const iguais = porChave.get(chave);
    if (iguais !== undefined) {
      item.duplicado = "identico";
      item.duplicadoDaLinha = iguais;
      continue;
    }
    porChave.set(chave, item.linha);
    const mesmoEmail = porEmail.get(email);
    if (mesmoEmail !== undefined) {
      item.duplicado = "email";
      item.duplicadoDaLinha = mesmoEmail;
    } else porEmail.set(email, item.linha);
  }

  return itens;
}

/** Linhas realmente importáveis: sem erros e sem duplicidade */
export const linhasImportaveis = (linhas: LinhaCSV[]) =>
  linhas.filter((l) => l.erros.length === 0 && !l.duplicado);

const CAMPOS_CSV = ["nome", "email", "telefone", "tipo", "nome_casal", "senha"] as const;

const escapar = (v: string) => (/[;"\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

const paraCSV = (linhas: LinhaCSV[]) =>
  `${CAMPOS_CSV.join(";")}\n${linhas
    .map((l) => CAMPOS_CSV.map((c) => escapar(String(l[c] ?? ""))).join(";"))
    .join("\n")}\n`;

/**
 * Remove duplicados por nome+e-mail. Com `mesclar`, agrupa por e-mail e
 * completa campos vazios com os valores das linhas repetidas (mantendo o nome
 * do primeiro registro); sem `mesclar`, apenas descarta as repetições.
 */
export function resolverDuplicados(linhas: LinhaCSV[], mesclar: boolean): string {
  const chaveDe = (l: LinhaCSV) =>
    mesclar ? l.email.toLowerCase() : `${normalizar(l.nome)}|${l.email.toLowerCase()}`;

  const grupos = new Map<string, LinhaCSV>();
  const semEmail: LinhaCSV[] = [];

  for (const l of linhas) {
    if (!l.email) {
      semEmail.push(l);
      continue;
    }
    const chave = chaveDe(l);
    const base = grupos.get(chave);
    if (!base) {
      grupos.set(chave, { ...l });
      continue;
    }
    if (!mesclar) continue;
    for (const campo of ["nome", "telefone", "senha", "nome_casal"] as const) {
      if (!base[campo] && l[campo]) base[campo] = l[campo];
    }
    if (base.tipo === "individual" && l.tipo === "casal") {
      base.tipo = "casal";
      if (!base.nome_casal && l.nome_casal) base.nome_casal = l.nome_casal;
    }
  }

  const ordenadas = [...grupos.values(), ...semEmail].sort((a, b) => a.linha - b.linha);
  return paraCSV(ordenadas);
}

export const MODELO_CSV =
  "nome;email;telefone;tipo;nome_casal;senha\n" +
  "Maria Silva;maria@exemplo.com;62999990000;individual;;\n" +
  "João e Ana Souza;joao@exemplo.com;62988880000;casal;João e Ana Souza;\n";

