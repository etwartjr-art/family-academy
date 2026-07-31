import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { listarPerfis, listarPapeis, iniciais, type Papel } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/pessoas")({
  head: () => ({
    meta: [
      { title: "Pessoas — Family Academy" },
      {
        name: "description",
        content: "Gerencie os papéis de coordenadores, professores e alunos da Family Academy.",
      },
      { property: "og:title", content: "Pessoas — Family Academy" },
      { property: "og:description", content: "Papéis de acesso da plataforma." },
    ],
  }),
  component: Pessoas,
});

const PAPEIS: Papel[] = ["coordenador", "professor", "aluno"];

function Pessoas() {
  const qc = useQueryClient();
  const [busca, setBusca] = useState("");
  const perfis = useQuery({ queryKey: ["perfis"], queryFn: listarPerfis });
  const papeis = useQuery({ queryKey: ["papeis"], queryFn: listarPapeis });

  const alterar = useMutation({
    mutationFn: async ({ userId, papel }: { userId: string; papel: Papel }) => {
      const { error: erroDelete } = await supabase
        .from("papeis_usuario")
        .delete()
        .eq("user_id", userId);
      if (erroDelete) throw erroDelete;
      const { error } = await supabase.from("papeis_usuario").insert({ user_id: userId, papel });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Papel atualizado");
      qc.invalidateQueries({ queryKey: ["papeis"] });
      qc.invalidateQueries({ queryKey: ["sessao"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const lista = (perfis.data ?? []).filter((p) =>
    `${p.nome} ${p.email ?? ""} ${p.codigo}`.toLowerCase().includes(busca.toLowerCase()),
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl">Pessoas</h1>
        <p className="text-sm text-muted-foreground">
          Defina quem é coordenador, professor ou aluno.
        </p>
      </div>

      <Input
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
        placeholder="Buscar por nome, e-mail ou código"
        className="max-w-sm"
      />

      <Card className="gap-0 p-0">
        <ul className="divide-y">
          {lista.map((p) => {
            const atual =
              ((papeis.data ?? []).find((r) => r.user_id === p.id)?.papel as Papel) ?? "aluno";
            return (
              <li key={p.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <span className="grid size-9 place-items-center rounded-full bg-secondary text-xs font-bold text-secondary-foreground">
                  {iniciais(p.nome)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{p.nome}</span>
                  <span className="text-xs text-muted-foreground">
                    {p.email ?? "sem e-mail"} · <span className="font-mono">{p.codigo}</span>
                  </span>
                </span>
                <Select
                  value={atual}
                  onValueChange={(v) => alterar.mutate({ userId: p.id, papel: v as Papel })}
                >
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PAPEIS.map((r) => (
                      <SelectItem key={r} value={r} className="capitalize">
                        {r}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </li>
            );
          })}
          {lista.length === 0 && (
            <li className="px-4 py-3 text-sm text-muted-foreground">Ninguém encontrado.</li>
          )}
        </ul>
      </Card>
    </div>
  );
}
