import { supabase } from "@/integrations/supabase/client";

export type Tarefa = {
  id: string;
  aula_id: string;
  titulo: string;
  instrucoes: string | null;
  link: string | null;
  rotulo_link: string | null;
  ordem: number;
  criado_por: string | null;
  criado_em: string;
};

export type Conclusao = {
  id: string;
  tarefa_id: string;
  aluno_id: string;
  em: string;
  por: "aluno" | "professor";
};

/** Tarefas visíveis ao usuário (RLS decide o alcance). */
export async function listarTarefas(aulaIds?: string[]) {
  let q = supabase.from("tarefas").select("*").order("ordem").order("criado_em");
  if (aulaIds) {
    if (aulaIds.length === 0) return [];
    q = q.in("aula_id", aulaIds);
  }
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as Tarefa[];
}

export async function listarConclusoes(tarefaIds?: string[]) {
  let q = supabase.from("conclusoes").select("*");
  if (tarefaIds) {
    if (tarefaIds.length === 0) return [];
    q = q.in("tarefa_id", tarefaIds);
  }
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as Conclusao[];
}

export async function criarTarefa(entrada: {
  aulaId: string;
  titulo: string;
  instrucoes?: string;
  link?: string;
  rotuloLink?: string;
  ordem: number;
}) {
  const { data: auth } = await supabase.auth.getUser();
  const { error } = await supabase.from("tarefas").insert({
    aula_id: entrada.aulaId,
    titulo: entrada.titulo,
    instrucoes: entrada.instrucoes?.trim() ? entrada.instrucoes.trim() : null,
    link: entrada.link?.trim() ? entrada.link.trim() : null,
    rotulo_link: entrada.rotuloLink?.trim() ? entrada.rotuloLink.trim() : null,
    ordem: entrada.ordem,
    criado_por: auth.user?.id ?? null,
  });
  if (error) throw error;
}

export async function atualizarTarefa(id: string, campos: Partial<Tarefa>) {
  const { error } = await supabase.from("tarefas").update(campos).eq("id", id);
  if (error) throw error;
}

export async function excluirTarefa(id: string) {
  const { error } = await supabase.from("tarefas").delete().eq("id", id);
  if (error) throw error;
}

/** Troca a ordem entre duas tarefas. */
export async function reordenar(a: Tarefa, b: Tarefa) {
  await atualizarTarefa(a.id, { ordem: b.ordem });
  await atualizarTarefa(b.id, { ordem: a.ordem });
}

export async function marcarConclusao(
  tarefaId: string,
  alunoId: string,
  por: "aluno" | "professor",
) {
  const { error } = await supabase
    .from("conclusoes")
    .insert({ tarefa_id: tarefaId, aluno_id: alunoId, por });
  if (error && !/duplicate|unique/i.test(error.message)) throw error;
}

export async function desmarcarConclusao(tarefaId: string, alunoId: string) {
  const { error } = await supabase
    .from("conclusoes")
    .delete()
    .eq("tarefa_id", tarefaId)
    .eq("aluno_id", alunoId);
  if (error) throw error;
}

/** Progresso sempre calculado: concluídas / total. */
export function progresso(concluidas: number, total: number) {
  return total === 0 ? 0 : Math.round((concluidas / total) * 100);
}
