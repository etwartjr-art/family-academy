import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { listarPerfis, listarPapeis, iniciais, type Papel } from "@/lib/api";
import {
  ACOES,
  AREAS,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MENU } from "@/components/AppShell";
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
    onSuccess: (removidas) => {
      toast.success(
        removidas
          ? `Permissão do papel atualizada — ${removidas} exceção${removidas > 1 ? "ões" : ""} individual${removidas > 1 ? "is" : ""} redundante${removidas > 1 ? "s" : ""} removida${removidas > 1 ? "s" : ""} e voltou a herdar o padrão`
          : "Permissão do papel atualizada",
      );
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

  const [verComo, setVerComo] = useState("");
  const verComoPerfil = (perfis.data ?? []).find((p) => p.id === verComo);
  const verComoLiberadas = verComoPerfil
    ? MENU.filter((item) =>
        calcular(
          item.chave,
          papelDe(verComoPerfil.id),
          verComoPerfil.id,
          porPapel.data ?? [],
          porUsuario.data ?? [],
        ),
      )
    : [];


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

      {(
        [
          { titulo: "Padrão por papel — áreas", coluna: "Área", itens: AREAS },
          { titulo: "Padrão por papel — ações", coluna: "Ação", itens: ACOES },
        ] as const
      ).map((grupo) => (
        <section key={grupo.titulo} className="space-y-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide">{grupo.titulo}</h2>
          <Card className="gap-0 overflow-x-auto p-0">
            <table className="w-full min-w-[560px] text-sm">
              <thead className="bg-muted/50 text-left">
                <tr>
                  <th className="px-4 py-2 font-medium">{grupo.coluna}</th>
                  {PAPEIS.map((p) => (
                    <th key={p} className="px-4 py-2 font-medium capitalize">
                      {p}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {grupo.itens.map((c) => (
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
      ))}

      <section className="space-y-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide">Ver como</h2>
        <p className="text-sm text-muted-foreground">
          Escolha uma pessoa para conferir exatamente quais páginas e itens de menu ela consegue
          acessar hoje.
        </p>
        <Select value={verComo} onValueChange={setVerComo}>
          <SelectTrigger className="max-w-sm">
            <SelectValue placeholder="Selecione um usuário" />
          </SelectTrigger>
          <SelectContent>
            {(perfis.data ?? []).map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.nome} — {papelDe(p.id)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {verComoPerfil && (
          <Card className="gap-0 overflow-hidden p-0">
            <div className="flex items-center gap-3 border-b bg-muted/40 px-4 py-3">
              <span className="grid size-9 place-items-center rounded-full bg-secondary text-xs font-bold text-secondary-foreground">
                {iniciais(verComoPerfil.nome)}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{verComoPerfil.nome}</span>
                <span className="text-xs capitalize text-muted-foreground">
                  {papelDe(verComoPerfil.id)} · {verComoLiberadas.length} de {MENU.length} áreas
                  liberadas
                </span>
              </span>
              <Button variant="ghost" size="sm" onClick={() => setVerComo("")}>
                Limpar
              </Button>
            </div>
            <ul className="divide-y">
              {MENU.map((item) => {
                const papel = papelDe(verComoPerfil.id);
                const excecao = (porUsuario.data ?? []).find(
                  (x) => x.user_id === verComoPerfil.id && x.chave === item.chave,
                );
                const liberado = calcular(
                  item.chave,
                  papel,
                  verComoPerfil.id,
                  porPapel.data ?? [],
                  porUsuario.data ?? [],
                );
                const Icone = item.icone;
                return (
                  <li key={item.chave} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                    <Icone
                      className={
                        liberado ? "size-4 shrink-0" : "size-4 shrink-0 text-muted-foreground"
                      }
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{item.rotulo}</span>
                      <span className="font-mono text-xs text-muted-foreground">{item.para}</span>
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {excecao ? "exceção do usuário" : "padrão do papel"}
                    </span>
                    <span
                      className={
                        liberado
                          ? "shrink-0 rounded-full bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground"
                          : "shrink-0 rounded-full border px-2 py-0.5 text-xs text-muted-foreground"
                      }
                    >
                      {liberado ? "Acessa" : "Bloqueado"}
                    </span>
                  </li>
                );
              })}
            </ul>
            <div className="border-t bg-muted/40 px-4 py-2 text-xs font-semibold uppercase tracking-wide">
              Ações na turma
            </div>
            <ul className="divide-y">
              {ACOES.map((c) => {
                const excecao = (porUsuario.data ?? []).find(
                  (x) => x.user_id === verComoPerfil.id && x.chave === c.chave,
                );
                const liberado = calcular(
                  c.chave,
                  papelDe(verComoPerfil.id),
                  verComoPerfil.id,
                  porPapel.data ?? [],
                  porUsuario.data ?? [],
                );
                return (
                  <li key={c.chave} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{c.rotulo}</span>
                      <span className="text-xs text-muted-foreground">{c.descricao}</span>
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {excecao ? "exceção do usuário" : "padrão do papel"}
                    </span>
                    <span
                      className={
                        liberado
                          ? "shrink-0 rounded-full bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground"
                          : "shrink-0 rounded-full border px-2 py-0.5 text-xs text-muted-foreground"
                      }
                    >
                      {liberado ? "Pode" : "Bloqueado"}
                    </span>
                  </li>
                );
              })}
            </ul>
          </Card>
        )}
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
                                setAlvo({
                                  userId: p.id,
                                  nome: p.nome,
                                  papel,
                                  chaves: [c.chave],
                                })
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

      <AlertDialog open={!!alvo} onOpenChange={(o) => !o && setAlvo(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Voltar ao padrão do papel?</AlertDialogTitle>
            <AlertDialogDescription>
              {alvo && (
                <>
                  As exceções de <span className="font-medium">{alvo.nome}</span> serão removidas e
                  as permissões passarão a seguir o padrão do papel{" "}
                  <span className="capitalize">{alvo.papel}</span>.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {alvo && (
            <ul className="divide-y rounded-lg border text-sm">
              {diffs(alvo.userId, alvo.papel, alvo.chaves).map((d) => (
                <li key={d.chave} className="flex items-center justify-between gap-3 px-3 py-2">
                  <span className="min-w-0 flex-1 truncate">{d.rotulo}</span>
                  {d.muda ? (
                    <span className="shrink-0 font-mono text-xs">
                      <span className="text-destructive">{d.atual ? "liberado" : "bloqueado"}</span>
                      {" → "}
                      <span className="font-semibold">{d.padrao ? "liberado" : "bloqueado"}</span>
                    </span>
                  ) : (
                    <span className="shrink-0 text-xs text-muted-foreground">
                      sem mudança ({d.padrao ? "liberado" : "bloqueado"})
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={aplicarPadrao.isPending}
              onClick={(e) => {
                e.preventDefault();
                if (alvo) aplicarPadrao.mutate({ userId: alvo.userId, chaves: alvo.chaves });
              }}
            >
              Confirmar sobrescrita
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>

  );
}
