import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { listarCursos, listarEmenta } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/cursos")({
  head: () => ({
    meta: [
      { title: "Cursos — Escola de Finanças Academy" },
      {
        name: "description",
        content: "Crie cursos e edite a ementa de módulos que gera as turmas da Escola de Finanças Academy.",
      },
      { property: "og:title", content: "Cursos — Escola de Finanças Academy" },
      { property: "og:description", content: "Cursos e ementa de módulos." },
    ],
  }),
  component: Cursos,
});

function Cursos() {
  const qc = useQueryClient();
  const cursos = useQuery({ queryKey: ["cursos"], queryFn: listarCursos });
  const ementa = useQuery({ queryKey: ["ementa"], queryFn: listarEmenta });
  const [nome, setNome] = useState("");
  const [novoModulo, setNovoModulo] = useState<Record<string, string>>({});

  const criarCurso = useMutation({
    mutationFn: async (nomeCurso: string) => {
      const { error } = await supabase
        .from("cursos")
        .insert({ nome: nomeCurso, ordem: (cursos.data?.length ?? 0) + 1 });
      if (error) throw error;
    },
    onSuccess: () => {
      setNome("");
      toast.success("Curso criado");
      qc.invalidateQueries({ queryKey: ["cursos"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const criarModulo = useMutation({
    mutationFn: async ({ cursoId, nomeModulo }: { cursoId: string; nomeModulo: string }) => {
      const ordem = (ementa.data ?? []).filter((m) => m.curso_id === cursoId).length + 1;
      const { error } = await supabase
        .from("curso_modulos")
        .insert({ curso_id: cursoId, nome: nomeModulo, ordem });
      if (error) throw error;
    },
    onSuccess: (_d, v) => {
      setNovoModulo((s) => ({ ...s, [v.cursoId]: "" }));
      qc.invalidateQueries({ queryKey: ["ementa"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removerModulo = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("curso_modulos").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ementa"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl">Cursos</h1>
        <p className="text-sm text-muted-foreground">
          A ementa do curso é replicada em toda turma nova — cada módulo já nasce com 5 aulas.
        </p>
      </div>

      <Card className="gap-3 p-4">
        <h2 className="text-lg">Novo curso</h2>
        <form
          className="flex flex-wrap gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (nome.trim().length < 3) return toast.error("Informe o nome do curso");
            criarCurso.mutate(nome.trim());
          }}
        >
          <Input
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Ex.: Escola de Finanças"
            className="min-w-48 flex-1"
          />
          <Button type="submit">
            <Plus className="size-4" /> Criar
          </Button>
        </form>
      </Card>

      <div className="space-y-3">
        {(cursos.data ?? []).map((c) => {
          const mods = (ementa.data ?? []).filter((m) => m.curso_id === c.id);
          return (
            <Card key={c.id} className="gap-3 p-4">
              <div className="flex items-baseline justify-between gap-3">
                <h2 className="text-lg">{c.nome}</h2>
                <span className="text-xs text-muted-foreground">
                  {mods.length} módulo(s) · {mods.length * 5} aulas por turma
                </span>
              </div>

              <ul className="divide-y rounded-xl border">
                {mods.map((m, i) => (
                  <li key={m.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
                    <span className="text-sm">
                      <span className="mr-2 font-mono text-xs text-muted-foreground">{i + 1}</span>
                      {m.nome}
                    </span>
                    <button
                      onClick={() => removerModulo.mutate(m.id)}
                      className="text-muted-foreground hover:text-destructive"
                      aria-label={`Remover ${m.nome}`}
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </li>
                ))}
                {mods.length === 0 && (
                  <li className="px-3 py-2.5 text-sm text-muted-foreground">Ementa vazia.</li>
                )}
              </ul>

              <form
                className="flex flex-wrap gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  const v = (novoModulo[c.id] ?? "").trim();
                  if (v.length < 3) return toast.error("Informe o nome do módulo");
                  criarModulo.mutate({ cursoId: c.id, nomeModulo: v });
                }}
              >
                <Label className="sr-only" htmlFor={`mod-${c.id}`}>
                  Novo módulo
                </Label>
                <Input
                  id={`mod-${c.id}`}
                  value={novoModulo[c.id] ?? ""}
                  onChange={(e) => setNovoModulo((s) => ({ ...s, [c.id]: e.target.value }))}
                  placeholder="Novo módulo da ementa"
                  className="min-w-48 flex-1"
                />
                <Button type="submit" variant="secondary">
                  <Plus className="size-4" /> Adicionar
                </Button>
              </form>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
