import { supabase } from "@/integrations/supabase/client";

export type Papel = "coordenador" | "professor" | "aluno";

export type Perfil = {
  id: string;
  nome: string;
  codigo: string;
  email: string | null;
  telefone: string | null;
};

export type Curso = { id: string; nome: string; descricao: string | null; ordem: number };
export type CursoModulo = { id: string; curso_id: string; nome: string; ordem: number };
export type Sala = {
  id: string;
  curso_id: string;
  nome: string;
  professor_id: string | null;
  modulo_ativo_id: string | null;
  turno: string | null;
  convite: string;
  data_inicio: string;
};
export type Modulo = {
  id: string;
  sala_id: string;
  nome: string;
  ordem: number;
  data_inicio: string;
};
export type Aula = {
  id: string;
  modulo_id: string;
  numero: number;
  titulo: string;
  data: string | null;
  professor_id: string | null;
};
export type TipoMatricula = "individual" | "casal";
export type Matricula = {
  id: string;
  aluno_id: string;
  sala_id: string;
  status: "ativa" | "pendente" | "cancelada";
  tipo: TipoMatricula;
  nome_casal: string | null;
};
export type Presenca = {
  id: string;
  aula_id: string;
  aluno_id: string;
  metodo: "qr" | "codigo" | "manual";
  criado_em: string;
};

export const FREQUENCIA_MINIMA = 75;

export async function buscarSessao() {
  const { data } = await supabase.auth.getUser();
  const user = data.user;
  if (!user) return null;

  const [{ data: perfil }, { data: papeis }] = await Promise.all([
    supabase.from("perfis").select("*").eq("id", user.id).maybeSingle(),
    supabase.from("papeis_usuario").select("papel").eq("user_id", user.id),
  ]);

  const lista = (papeis ?? []).map((p) => p.papel as Papel);
  const papel: Papel = lista.includes("coordenador")
    ? "coordenador"
    : lista.includes("professor")
      ? "professor"
      : "aluno";

  return { user, perfil: perfil as Perfil | null, papel };
}

export async function listarCursos() {
  const { data, error } = await supabase.from("cursos").select("*").order("ordem");
  if (error) throw error;
  return (data ?? []) as Curso[];
}

export async function listarEmenta() {
  const { data, error } = await supabase.from("curso_modulos").select("*").order("ordem");
  if (error) throw error;
  return (data ?? []) as CursoModulo[];
}

export async function listarSalas() {
  const { data, error } = await supabase.from("salas").select("*").order("criado_em");
  if (error) throw error;
  return (data ?? []) as Sala[];
}

export async function listarPerfis() {
  const { data, error } = await supabase.from("perfis").select("*").order("nome");
  if (error) throw error;
  return (data ?? []) as Perfil[];
}

export async function listarPapeis() {
  const { data, error } = await supabase.from("papeis_usuario").select("user_id, papel");
  if (error) throw error;
  return (data ?? []) as { user_id: string; papel: Papel }[];
}

export async function listarModulos(salaId?: string) {
  let q = supabase.from("modulos").select("*").order("ordem");
  if (salaId) q = q.eq("sala_id", salaId);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as Modulo[];
}

export async function listarAulas(moduloIds?: string[]) {
  let q = supabase.from("aulas").select("*").order("numero");
  if (moduloIds) {
    if (moduloIds.length === 0) return [];
    q = q.in("modulo_id", moduloIds);
  }
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as Aula[];
}

export async function listarMatriculas(salaId?: string) {
  let q = supabase.from("matriculas").select("*");
  if (salaId) q = q.eq("sala_id", salaId);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as Matricula[];
}

export async function listarInscricoes() {
  const { data, error } = await supabase.from("matricula_modulos").select("*");
  if (error) throw error;
  return (data ?? []) as { matricula_id: string; modulo_id: string }[];
}

export async function listarPresencas(aulaIds?: string[]) {
  let q = supabase.from("presencas").select("*");
  if (aulaIds) {
    if (aulaIds.length === 0) return [];
    q = q.in("aula_id", aulaIds);
  }
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as Presenca[];
}

export function dataBR(iso?: string | null) {
  if (!iso) return "—";
  const [a, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${a}`;
}

/** Data e hora local, para registros com horário (ex.: conclusão de tarefa). */
export function dataHoraBR(iso?: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}


export function iniciais(nome: string) {
  return nome
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

export function lerPayloadQR(texto: string) {
  const t = texto.trim();
  const partes = t.split("|");
  if (partes[0] === "FA" && partes[1] === "ALUNO" && partes[2]) {
    return { tipo: "aluno" as const, valor: partes[2].toUpperCase() };
  }
  const mSala = t.match(/matricula\/([A-Za-z0-9-]+)/);
  if (mSala) return { tipo: "convite" as const, valor: mSala[1].toUpperCase() };
  const mSessao = t.match(/chamada\/([A-Za-z0-9]+)/);
  if (mSessao) return { tipo: "sessao" as const, valor: mSessao[1].toUpperCase() };
  if (/^[A-Za-z0-9]{6}$/.test(t)) return { tipo: "aluno" as const, valor: t.toUpperCase() };
  return { tipo: "desconhecido" as const, valor: t };
}

export function baixarCSV(nome: string, linhas: (string | number)[][]) {
  const csv = linhas
    .map((l) => l.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";"))
    .join("\n");
  const url = URL.createObjectURL(new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = nome;
  a.click();
  URL.revokeObjectURL(url);
}
