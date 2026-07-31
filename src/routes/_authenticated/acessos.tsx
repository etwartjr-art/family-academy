import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { listarPerfis, listarPapeis, iniciais, type Papel } from "@/lib/api";
import {
  CATALOGO,
  PAPEIS,
  calcular,
  listarPermissoesPapel,
  listarPermissoesUsuario,
  salvarPermissaoPapel,
  salvarPermissaoUsuario,
} from "@/lib/permissoes";
import { useSessao } from "@/hooks/useSessao";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";

type AlvoPadrao = {
  userId: string;
  nome: string;
  papel: Papel;
  chaves: string[];
};


export const Route = createFileRoute("/_authenticated/acessos")({
  head: () => ({
    meta: [
      { title: "Níveis de acesso — Family Academy" },
      {
        name: "description",
        content:
          "Configure o que coordenadores, professores e alunos podem acessar na plataforma Family Academy.",
      },
      { property: "og:title", content: "Níveis de acesso — Family Academy" },
      { property: "og:description", content: "Permissões por papel e por usuário." },
    ],
  }),
  component: Acessos,
});

function Acessos() {
  const qc = useQueryClient();
  const sessao = useSessao();
  const ehCoordenador = sessao.data?.papel === "coordenador";
  const [busca, setBusca] = useState("");

  const porPapel = useQuery({ queryKey: ["permissoes-papel"], queryFn: listarPermissoesPapel });
  const porUsuario = useQuery({
    queryKey: ["permissoes-usuario"],
    queryFn: listarPermissoesUsuario,
  });
  const perfis = useQuery({ queryKey: ["perfis"], queryFn: listarPerfis });
  const papeis = useQuery({ queryKey: ["papeis"], queryFn: listarPapeis });

  const invalidar = () => {
    qc.invalidateQueries({ queryKey: ["permissoes-papel"] });
    qc.invalidateQueries({ queryKey: ["permissoes-usuario"] });
  };

  const mudarPapel = useMutation({
    mutationFn: ({ papel, chave, permitido }: { papel: Papel; chave: string; permitido: boolean }) =>
      salvarPermissaoPapel(papel, chave, permitido),
    onSuccess: () => {
      toast.success("Permissão do papel atualizada");
      invalidar();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const mudarUsuario = useMutation({
    mutationFn: ({
      userId,
      chave,
      valor,
    }: {
      userId: string;
      chave: string;
      valor: boolean | null;
    }) => salvarPermissaoUsuario(userId, chave, valor),
    onSuccess: () => {
      toast.success("Permissão do usuário atualizada");
      invalidar();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const [alvo, setAlvo] = useState<AlvoPadrao | null>(null);

  const aplicarPadrao = useMutation({
    mutationFn: async ({ userId, chaves }: { userId: string; chaves: string[] }) => {
      for (const chave of chaves) await salvarPermissaoUsuario(userId, chave, null);
    },
    onSuccess: (_d, v) => {
      toast.success(
        v.chaves.length === 1
          ? "Exceção removida — voltou ao padrão do papel"
          : `${v.chaves.length} exceções removidas — voltaram ao padrão do papel`,
      );
      setAlvo(null);
      invalidar();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  /** Diferenças entre a exceção do usuário e o padrão do papel. */
  const diffs = (userId: string, papel: Papel, chaves: string[]) =>
    chaves.map((chave) => {
      const item = CATALOGO.find((c) => c.chave === chave);
      const excecao = (porUsuario.data ?? []).find(
        (x) => x.user_id === userId && x.chave === chave,
      );
      const padrao =
        (porPapel.data ?? []).find((x) => x.papel === papel && x.chave === chave)?.permitido ??
        false;
      return {
        chave,
        rotulo: item?.rotulo ?? chave,
        atual: excecao?.permitido ?? padrao,
        padrao,
        muda: (excecao?.permitido ?? padrao) !== padrao,
      };
    });

  const excecoesDe = (userId: string) =>
    (porUsuario.data ?? []).filter((x) => x.user_id === userId).map((x) => x.chave);



  const papelDe = (id: string): Papel =>
    ((papeis.data ?? []).find((r) => r.user_id === id)?.papel as Papel) ?? "aluno";

  const pessoas = (perfis.data ?? []).filter((p) =>
    `${p.nome} ${p.email ?? ""} ${p.codigo}`.toLowerCase().includes(busca.toLowerCase()),
  );

  if (!ehCoordenador) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl">Níveis de acesso</h1>
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">
            Estas são as áreas liberadas para o seu acesso (
            <span className="capitalize">{sessao.data?.papel ?? "aluno"}</span>):
          </p>
          <ul className="mt-3 space-y-1 text-sm">
            {CATALOGO.filter((c) =>
              calcular(
                c.chave,
                sessao.data?.papel,
                sessao.data?.perfil?.id,
                porPapel.data ?? [],
                porUsuario.data ?? [],
              ),
            ).map((c) => (
              <li key={c.chave}>
                <span className="font-medium">{c.rotulo}</span> —{" "}
                <span className="text-muted-foreground">{c.descricao}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl">Níveis de acesso</h1>
        <p className="text-sm text-muted-foreground">
          Defina o padrão de cada papel e, se precisar, exceções individuais. Professores continuam
          vendo apenas as turmas em que são o professor responsável.
        </p>
      </div>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide">Padrão por papel</h2>
        <Card className="gap-0 overflow-x-auto p-0">
          <table className="w-full min-w-[560px] text-sm">
            <thead className="bg-muted/50 text-left">
              <tr>
                <th className="px-4 py-2 font-medium">Área</th>
                {PAPEIS.map((p) => (
                  <th key={p} className="px-4 py-2 font-medium capitalize">
                    {p}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {CATALOGO.map((c) => (
                <tr key={c.chave}>
                  <td className="px-4 py-3">
                    <div className="font-medium">{c.rotulo}</div>
                    <div className="text-xs text-muted-foreground">{c.descricao}</div>
                  </td>
                  {PAPEIS.map((papel) => {
                    const atual =
                      (porPapel.data ?? []).find((x) => x.papel === papel && x.chave === c.chave)
                        ?.permitido ?? false;
                    return (
                      <td key={papel} className="px-4 py-3">
                        <Switch
                          checked={atual}
                          onCheckedChange={(v) =>
                            mudarPapel.mutate({ papel, chave: c.chave, permitido: v })
                          }
                        />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide">Exceções por usuário</h2>
        <Input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar pessoa por nome, e-mail ou código"
          className="max-w-sm"
        />
        <Card className="gap-0 p-0">
          <ul className="divide-y">
            {pessoas.map((p) => {
              const papel = papelDe(p.id);
              return (
                <li key={p.id} className="space-y-3 px-4 py-3">
                  <div className="flex items-center gap-3">
                    <span className="grid size-9 place-items-center rounded-full bg-secondary text-xs font-bold text-secondary-foreground">
                      {iniciais(p.nome)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{p.nome}</span>
                      <span className="text-xs capitalize text-muted-foreground">
                        {papel}
                        {excecoesDe(p.id).length > 0 &&
                          ` · ${excecoesDe(p.id).length} exceção(ões)`}
                      </span>
                    </span>
                    {excecoesDe(p.id).length > 0 && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          setAlvo({
                            userId: p.id,
                            nome: p.nome,
                            papel,
                            chaves: excecoesDe(p.id),
                          })
                        }
                      >
                        Usar padrão em tudo
                      </Button>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {CATALOGO.map((c) => {
                      const excecao = (porUsuario.data ?? []).find(
                        (x) => x.user_id === p.id && x.chave === c.chave,
                      );
                      const efetivo = calcular(
                        c.chave,
                        papel,
                        p.id,
                        porPapel.data ?? [],
                        porUsuario.data ?? [],
                      );
                      return (
                        <div
                          key={c.chave}
                          className="flex items-center gap-2 rounded-lg border px-2.5 py-1.5"
                        >
                          <span className="text-xs">{c.rotulo}</span>
                          <Switch
                            checked={efetivo}
                            onCheckedChange={(v) =>
                              mudarUsuario.mutate({ userId: p.id, chave: c.chave, valor: v })
                            }
                          />
                          {excecao && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 px-1.5 text-[11px]"
                              onClick={() =>
                                mudarUsuario.mutate({ userId: p.id, chave: c.chave, valor: null })
                              }
                            >
                              usar padrão
                            </Button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </li>
              );
            })}
            {pessoas.length === 0 && (
              <li className="px-4 py-3 text-sm text-muted-foreground">Ninguém encontrado.</li>
            )}
          </ul>
        </Card>
      </section>
    </div>
  );
}
