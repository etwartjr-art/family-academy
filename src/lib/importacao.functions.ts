import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { mensagemAuth } from "@/lib/usuarios-erros";
import { SENHA_PADRAO, ehSenhaPadrao } from "@/lib/senha-padrao";


const linha = z
  .object({
    nome: z.string().trim().min(2).max(100),
    email: z.string().trim().email().max(255),
    telefone: z.string().trim().max(30).optional().default(""),
    senha: z.string().max(72).optional().default(""),
    tipo: z.enum(["individual", "casal"]),
    nome_casal: z.string().trim().max(120).optional().default(""),
  })
  .refine((l) => l.tipo !== "casal" || l.nome_casal.trim().length >= 2, {
    message: "Nome do casal é obrigatório quando o tipo é Casal",
    path: ["nome_casal"],
  })
  .refine((l) => l.senha === "" || l.senha.length >= 6, {
    message: "Senha precisa ter 6+ caracteres",
    path: ["senha"],
  });

const esquema = z.object({
  salaId: z.string().uuid(),
  linhas: z.array(linha).min(1).max(300),
});

export type ResultadoImportacao = {
  email: string;
  nome: string;
  status: "criado" | "matriculado" | "ja_matriculado" | "erro";
  mensagem: string;
};

export const importarAlunosLote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => esquema.parse(input))
  .handler(async ({ data, context }) => {
    const { data: gerencia, error: erroGer } = await context.supabase.rpc("sala_gerenciavel", {
      _sala_id: data.salaId,
    });
    if (erroGer) throw new Error(erroGer.message);
    if (!gerencia) throw new Error("Você não gerencia esta turma");

    const { data: podeMatricular, error: erroPode } = await context.supabase.rpc("pode", {
      _user_id: context.userId,
      _chave: "turma_matricular",
    });
    if (erroPode) throw new Error(erroPode.message);
    if (!podeMatricular) throw new Error("Sem permissão para matricular alunos nesta turma");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: modulos, error: erroMod } = await supabaseAdmin
      .from("modulos")
      .select("id")
      .eq("sala_id", data.salaId);
    if (erroMod) throw new Error(erroMod.message);
    const idsModulos = (modulos ?? []).map((m) => m.id);

    const resultados: ResultadoImportacao[] = [];

    for (const l of data.linhas) {
      const email = l.email.toLowerCase();
      try {
        const { data: existente } = await supabaseAdmin
          .from("perfis")
          .select("id")
          .ilike("email", email)
          .maybeSingle();

        let alunoId = existente?.id ?? null;
        let criado = false;

        if (!alunoId) {
          const senha = l.senha || SENHA_PADRAO;
          const { data: novo, error } = await supabaseAdmin.auth.admin.createUser({
            email,
            password: senha,
            email_confirm: true,
            user_metadata: { nome: l.nome, telefone: l.telefone || null, papel: "aluno" },
          });
          if (error) throw new Error(mensagemAuth(error.message));
          alunoId = novo.user?.id ?? null;
          if (!alunoId) throw new Error("Não foi possível criar o usuário");
          criado = true;

          await supabaseAdmin
            .from("perfis")
            .update({
              nome: l.nome,
              telefone: l.telefone || null,
              senha_provisoria: ehSenhaPadrao(senha),
            })
            .eq("id", alunoId);

        }

        const { data: matriculaExistente } = await supabaseAdmin
          .from("matriculas")
          .select("id")
          .eq("sala_id", data.salaId)
          .eq("aluno_id", alunoId)
          .maybeSingle();

        let matriculaId = matriculaExistente?.id ?? null;

        if (matriculaId) {
          await supabaseAdmin
            .from("matriculas")
            .update({
              tipo: l.tipo,
              nome_casal: l.tipo === "casal" ? l.nome_casal.trim() : null,
            })
            .eq("id", matriculaId);
        } else {
          const { data: nova, error } = await supabaseAdmin
            .from("matriculas")
            .insert({
              aluno_id: alunoId,
              sala_id: data.salaId,
              status: "ativa",
              tipo: l.tipo,
              nome_casal: l.tipo === "casal" ? l.nome_casal.trim() : null,
            })
            .select("id")
            .single();
          if (error) throw new Error(error.message);
          matriculaId = nova.id;
        }

        if (idsModulos.length > 0) {
          await supabaseAdmin
            .from("matricula_modulos")
            .upsert(
              idsModulos.map((moduloId) => ({ matricula_id: matriculaId!, modulo_id: moduloId })),
              { onConflict: "matricula_id,modulo_id", ignoreDuplicates: true },
            );
        }

        resultados.push({
          email,
          nome: l.nome,
          status: criado ? "criado" : matriculaExistente ? "ja_matriculado" : "matriculado",
          mensagem: criado
            ? "Usuário criado e matriculado"
            : matriculaExistente
              ? "Já estava matriculado — dados atualizados"
              : "Aluno já cadastrado, matriculado na turma",
        });
      } catch (e) {
        resultados.push({
          email,
          nome: l.nome,
          status: "erro",
          mensagem: e instanceof Error ? e.message : "Erro desconhecido",
        });
      }
    }

    return { resultados };
  });
