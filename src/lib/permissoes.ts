import { supabase } from "@/integrations/supabase/client";
import type { Papel } from "@/lib/api";

export const PAPEIS: Papel[] = ["coordenador", "professor", "aluno"];

export type ChaveAcesso =
  | "painel"
  | "meu_painel"
  | "cursos"
  | "salas"
  | "alunos"
  | "chamada"
  | "frequencia"
  | "carteirinhas"
  | "pessoas"
  | "acessos"
  | "turma_editar"
  | "turma_matricular"
  | "turma_definir_professor";

export type ItemCatalogo = {
  chave: ChaveAcesso;
  rotulo: string;
  descricao: string;
  grupo: "area" | "acao";
};

export const CATALOGO: ItemCatalogo[] = [
  { chave: "painel", rotulo: "Painel", descricao: "Visão geral com indicadores e próximas aulas", grupo: "area" },
  { chave: "meu_painel", rotulo: "Minha carteirinha", descricao: "Carteirinha e frequência pessoal", grupo: "area" },
  { chave: "cursos", rotulo: "Cursos", descricao: "Criar cursos e definir a ementa dos módulos", grupo: "area" },
  { chave: "salas", rotulo: "Salas", descricao: "Ver turmas, aulas e matrículas", grupo: "area" },
  { chave: "alunos", rotulo: "Alunos", descricao: "Lista de alunos por curso e turma", grupo: "area" },
  { chave: "chamada", rotulo: "Chamada", descricao: "Registrar presença por QR, código ou manual", grupo: "area" },
  { chave: "frequencia", rotulo: "Frequência", descricao: "Grade de presença e exportação", grupo: "area" },
  { chave: "carteirinhas", rotulo: "Carteirinhas", descricao: "Gerar carteirinhas para impressão", grupo: "area" },
  { chave: "pessoas", rotulo: "Pessoas", descricao: "Cadastrar, editar e definir papéis", grupo: "area" },
  { chave: "acessos", rotulo: "Níveis de acesso", descricao: "Configurar permissões de papéis e usuários", grupo: "area" },
  {
    chave: "turma_editar",
    rotulo: "Editar turma",
    descricao: "Alterar nome, turno e data de início da turma",
    grupo: "acao",
  },
  {
    chave: "turma_matricular",
    rotulo: "Matricular / remover alunos",
    descricao: "Adicionar, matricular e remover alunos da turma",
    grupo: "acao",
  },
  {
    chave: "turma_definir_professor",
    rotulo: "Definir professor",
    descricao: "Escolher ou trocar o professor responsável pela turma",
    grupo: "acao",
  },
];

export const AREAS = CATALOGO.filter((c) => c.grupo === "area");
export const ACOES = CATALOGO.filter((c) => c.grupo === "acao");


export type PermissaoPapel = { papel: Papel; chave: string; permitido: boolean };
export type PermissaoUsuario = { user_id: string; chave: string; permitido: boolean };

export async function listarPermissoesPapel(): Promise<PermissaoPapel[]> {
  const { data, error } = await supabase.from("permissoes_papel").select("*");
  if (error) throw error;
  return (data ?? []) as PermissaoPapel[];
}

export async function listarPermissoesUsuario(): Promise<PermissaoUsuario[]> {
  const { data, error } = await supabase.from("permissoes_usuario").select("*");
  if (error) throw error;
  return (data ?? []) as PermissaoUsuario[];
}

/** Permissão efetiva: exceção do usuário vence o padrão do papel. */
export function calcular(
  chave: string,
  papel: Papel | undefined,
  userId: string | undefined,
  porPapel: PermissaoPapel[],
  porUsuario: PermissaoUsuario[],
): boolean {
  const excecao = porUsuario.find((p) => p.user_id === userId && p.chave === chave);
  if (excecao) return excecao.permitido;
  const padrao = porPapel.find((p) => p.papel === papel && p.chave === chave);
  return padrao?.permitido ?? false;
}

/**
 * Salva o padrão do papel e, em seguida, remove as exceções individuais que
 * ficaram redundantes (mesmo valor do novo padrão) dos usuários desse papel.
 * Assim essas pessoas voltam a herdar automaticamente futuras mudanças.
 * Retorna quantas exceções foram removidas.
 */
export async function salvarPermissaoPapel(papel: Papel, chave: string, permitido: boolean) {
  const { error } = await supabase
    .from("permissoes_papel")
    .upsert({ papel, chave, permitido }, { onConflict: "papel,chave" });
  if (error) throw error;

  const { data: usuariosDoPapel, error: erroPapeis } = await supabase
    .from("papeis_usuario")
    .select("user_id")
    .eq("papel", papel);
  if (erroPapeis) throw erroPapeis;

  const ids = (usuariosDoPapel ?? []).map((p) => p.user_id);
  if (ids.length === 0) return 0;

  const { data: removidas, error: erroLimpeza } = await supabase
    .from("permissoes_usuario")
    .delete()
    .eq("chave", chave)
    .eq("permitido", permitido)
    .in("user_id", ids)
    .select("user_id");
  if (erroLimpeza) throw erroLimpeza;

  return removidas?.length ?? 0;
}


export async function salvarPermissaoUsuario(
  userId: string,
  chave: string,
  valor: boolean | null,
) {
  if (valor === null) {
    const { error } = await supabase
      .from("permissoes_usuario")
      .delete()
      .eq("user_id", userId)
      .eq("chave", chave);
    if (error) throw error;
    return;
  }
  const { error } = await supabase
    .from("permissoes_usuario")
    .upsert({ user_id: userId, chave, permitido: valor }, { onConflict: "user_id,chave" });
  if (error) throw error;
}
