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
  | "acessos";

export const CATALOGO: { chave: ChaveAcesso; rotulo: string; descricao: string }[] = [
  { chave: "painel", rotulo: "Painel", descricao: "Visão geral com indicadores e próximas aulas" },
  { chave: "meu_painel", rotulo: "Minha carteirinha", descricao: "Carteirinha e frequência pessoal" },
  { chave: "cursos", rotulo: "Cursos", descricao: "Criar cursos e definir a ementa dos módulos" },
  { chave: "salas", rotulo: "Salas", descricao: "Criar e editar turmas, aulas e matrículas" },
  { chave: "alunos", rotulo: "Alunos", descricao: "Lista de alunos por curso e turma" },
  { chave: "chamada", rotulo: "Chamada", descricao: "Registrar presença por QR, código ou manual" },
  { chave: "frequencia", rotulo: "Frequência", descricao: "Grade de presença e exportação" },
  { chave: "carteirinhas", rotulo: "Carteirinhas", descricao: "Gerar carteirinhas para impressão" },
  { chave: "pessoas", rotulo: "Pessoas", descricao: "Cadastrar, editar e definir papéis" },
  { chave: "acessos", rotulo: "Níveis de acesso", descricao: "Configurar permissões de papéis e usuários" },
];

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

export async function salvarPermissaoPapel(papel: Papel, chave: string, permitido: boolean) {
  const { error } = await supabase
    .from("permissoes_papel")
    .upsert({ papel, chave, permitido }, { onConflict: "papel,chave" });
  if (error) throw error;
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
