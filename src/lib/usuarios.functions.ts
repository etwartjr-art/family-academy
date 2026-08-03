import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { mensagemAuth } from "@/lib/usuarios-erros";
import { SENHA_PADRAO, ehSenhaPadrao } from "@/lib/senha-padrao";

const esquema = z.object({
  nome: z.string().trim().min(2).max(100),
  email: z.string().trim().email().max(255),
  senha: z.string().max(72).optional().default(SENHA_PADRAO),
  telefone: z.string().trim().max(30).optional().or(z.literal("")),
  papel: z.enum(["coordenador", "professor", "aluno"]),
});


export const criarUsuario = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => {
    const d = esquema.parse(input);
    const senha = d.senha.trim() === "" ? SENHA_PADRAO : d.senha;
    if (senha.length < 6) throw new Error("A senha precisa de ao menos 6 caracteres");
    return { ...d, senha };
  })

  .handler(async ({ data, context }) => {
    const { data: ehCoordenador, error: erroPapel } = await context.supabase.rpc("tem_papel", {
      _user_id: context.userId,
      _papel: "coordenador",
    });
    if (erroPapel) throw new Error(erroPapel.message);
    if (!ehCoordenador) throw new Error("Apenas coordenadores podem cadastrar usuários");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: criado, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.senha,
      email_confirm: true,
      user_metadata: {
        nome: data.nome,
        telefone: data.telefone || null,
        papel: data.papel,
      },
    });
    if (error) throw new Error(mensagemAuth(error.message));
    const novoId = criado.user?.id;
    if (!novoId) throw new Error("Não foi possível criar o usuário");

    // O gatilho cria o perfil e um papel padrão; aqui garantimos o papel escolhido.
    await supabaseAdmin.from("papeis_usuario").delete().eq("user_id", novoId);
    const { error: erroInsert } = await supabaseAdmin
      .from("papeis_usuario")
      .insert({ user_id: novoId, papel: data.papel });
    if (erroInsert) throw new Error(erroInsert.message);

    await supabaseAdmin
      .from("perfis")
      .update({
        nome: data.nome,
        telefone: data.telefone || null,
        senha_provisoria: ehSenhaPadrao(data.senha),
      })
      .eq("id", novoId);


    return { id: novoId };
  });

const esquemaEdicao = z.object({
  id: z.string().uuid(),
  nome: z.string().trim().min(2).max(100),
  email: z.string().trim().email().max(255),
  telefone: z.string().trim().max(30).optional().or(z.literal("")),
  senha: z.string().min(6).max(72).optional().or(z.literal("")),
});

export const editarUsuario = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => esquemaEdicao.parse(input))
  .handler(async ({ data, context }) => {
    const { data: ehCoordenador, error: erroPapel } = await context.supabase.rpc("tem_papel", {
      _user_id: context.userId,
      _papel: "coordenador",
    });
    if (erroPapel) throw new Error(erroPapel.message);
    if (!ehCoordenador) throw new Error("Apenas coordenadores podem editar usuários");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const atualizacao: { email: string; password?: string; user_metadata: Record<string, unknown> } =
      {
        email: data.email,
        user_metadata: { nome: data.nome, telefone: data.telefone || null },
      };
    if (data.senha) atualizacao.password = data.senha;

    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.id, atualizacao);
    if (error) throw new Error(mensagemAuth(error.message));

    const camposPerfil: {
      nome: string;
      email: string;
      telefone: string | null;
      senha_provisoria?: boolean;
    } = {
      nome: data.nome,
      email: data.email,
      telefone: data.telefone || null,
    };
    // Se o coordenador redefiniu para a senha padrão, o usuário volta a ser obrigado a trocá-la.
    if (data.senha) camposPerfil.senha_provisoria = ehSenhaPadrao(data.senha);


    const { error: erroPerfil } = await supabaseAdmin
      .from("perfis")
      .update(camposPerfil)
      .eq("id", data.id);
    if (erroPerfil) throw new Error(erroPerfil.message);


    return { id: data.id };
  });
