import { supabase } from "@/integrations/supabase/client";

export type Notificacao = {
  id: string;
  usuario_id: string;
  tipo: "tarefa_publicada" | "tarefa_atualizada";
  titulo: string;
  mensagem: string | null;
  aula_id: string | null;
  tarefa_id: string | null;
  lida_em: string | null;
  criado_em: string;
};

/** Notificações do usuário logado (RLS limita ao próprio destinatário). */
export async function listarNotificacoes(limite = 30) {
  const { data, error } = await supabase
    .from("notificacoes")
    .select("*")
    .order("criado_em", { ascending: false })
    .limit(limite);
  if (error) throw error;
  return (data ?? []) as Notificacao[];
}

export async function marcarLida(id: string) {
  const { error } = await supabase
    .from("notificacoes")
    .update({ lida_em: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

export async function marcarTodasLidas() {
  const { error } = await supabase
    .from("notificacoes")
    .update({ lida_em: new Date().toISOString() })
    .is("lida_em", null);
  if (error) throw error;
}

export function quandoBR(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}
