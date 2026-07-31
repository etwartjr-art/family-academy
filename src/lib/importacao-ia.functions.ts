import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const esquema = z.object({
  conteudo: z.string().trim().min(3).max(60000),
});

const SISTEMA = `Você organiza listas de alunos para importação escolar.
Receberá o conteúdo bruto de uma planilha ou texto (colunas em qualquer ordem, com ou sem cabeçalho, podendo ter linhas de título, totais ou vazias).
Devolva APENAS um JSON no formato:
{"linhas":[{"nome":"","email":"","telefone":"","tipo":"individual|casal","nome_casal":""}]}
Regras:
- ignore linhas que não representam um aluno;
- nome próprio com maiúsculas corretas; e-mail em minúsculas;
- telefone somente dígitos (mantenha DDD quando existir);
- tipo "casal" quando a linha indicar casal ou dois nomes unidos por "e"/"&"; nesse caso nome_casal recebe o nome do casal, senão string vazia;
- campos desconhecidos vão como string vazia. Nunca invente e-mails.`;

export type LinhaIA = {
  nome: string;
  email: string;
  telefone: string;
  tipo: "individual" | "casal";
  nome_casal: string;
};

export const mapearAlunosComIA = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => esquema.parse(input))
  .handler(async ({ data }) => {
    const chave = process.env["LOVABLE_API_KEY"];
    if (!chave) throw new Error("IA indisponível: chave não configurada");

    const resposta = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${chave}`,
      },
      body: JSON.stringify({
        model: "openai/gpt-5.6-sol",
        reasoning_effort: "none",
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SISTEMA },
          { role: "user", content: data.conteudo },
        ],
      }),
    });

    if (!resposta.ok) {
      const corpo = await resposta.text();
      if (resposta.status === 429) throw new Error("Limite de uso da IA atingido. Tente novamente em instantes.");
      if (resposta.status === 402) throw new Error("Créditos de IA esgotados. Recarregue para continuar.");
      throw new Error(`Falha na IA [${resposta.status}]: ${corpo.slice(0, 300)}`);
    }

    const json = (await resposta.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const texto = json.choices?.[0]?.message?.content ?? "";
    let bruto: unknown;
    try {
      bruto = JSON.parse(texto);
    } catch {
      throw new Error("A IA não devolveu um resultado válido. Tente novamente.");
    }

    const saida = z
      .object({
        linhas: z
          .array(
            z.object({
              nome: z.string().trim().default(""),
              email: z.string().trim().default(""),
              telefone: z.string().trim().default(""),
              tipo: z.enum(["individual", "casal"]).default("individual"),
              nome_casal: z.string().trim().default(""),
            }),
          )
          .max(400),
      })
      .safeParse(bruto);

    if (!saida.success) throw new Error("A IA devolveu um formato inesperado. Tente novamente.");

    const linhas: LinhaIA[] = saida.data.linhas.filter((l) => l.nome || l.email);
    const csv =
      "nome;email;telefone;tipo;nome_casal;senha\n" +
      linhas
        .map((l) =>
          [l.nome, l.email.toLowerCase(), l.telefone, l.tipo, l.tipo === "casal" ? l.nome_casal : "", ""]
            .map((v) => (v.includes(";") ? `"${v.replace(/"/g, '""')}"` : v))
            .join(";"),
        )
        .join("\n");

    return { csv, total: linhas.length };
  });
