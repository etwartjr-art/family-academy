import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  listarSalas,
  listarCursos,
  listarModulos,
  listarAulas,
  listarMatriculas,
  listarPerfis,
  listarPapeis,
  listarInscricoes,
  dataBR,
  iniciais,
} from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { QRCodeBox } from "@/components/QRCodeBox";
import { toast } from "sonner";
import { ArrowLeft, Pencil } from "lucide-react";


export const Route = createFileRoute("/_authenticated/salas/$id")({
  head: () => ({
    meta: [
      { title: "Sala — Family Academy" },
      {
        name: "description",
        content: "Módulos, aulas e alunos inscritos da turma, com controle de datas e inscrições.",
      },
      { property: "og:title", content: "Sala — Family Academy" },
      { property: "og:description", content: "Módulos, aulas e inscrições da turma." },
    ],
  }),
  component: SalaDetalhe,
});

function SalaDetalhe() {
  const { id } = Route.useParams();
  const qc = useQueryClient();

  const salas = useQuery({ queryKey: ["salas"], queryFn: () => listarSalas() });
  const cursos = useQuery({ queryKey: ["cursos"], queryFn: listarCursos });
  const modulos = useQuery({ queryKey: ["modulos", id], queryFn: () => listarModulos(id) });
  const matriculas = useQuery({ queryKey: ["matriculas", id], queryFn: () => listarMatriculas(id) });
  const inscricoes = useQuery({ queryKey: ["inscricoes"], queryFn: listarInscricoes });
  const perfis = useQuery({ queryKey: ["perfis"], queryFn: listarPerfis });

  const idsModulos = (modulos.data ?? []).map((m) => m.id);
  const aulas = useQuery({
    queryKey: ["aulas", idsModulos],
    queryFn: () => listarAulas(idsModulos),
    enabled: idsModulos.length > 0,
  });

  const sala = (salas.data ?? []).find((s) => s.id === id);
  const curso = (cursos.data ?? []).find((c) => c.id === sala?.curso_id);
  const origem = typeof window !== "undefined" ? window.location.origin : "";

  const salvarData = useMutation({
    mutationFn: async ({ aulaId, data }: { aulaId: string; data: string }) => {
      const { error } = await supabase
        .from("aulas")
        .update({ data: data || null })
        .eq("id", aulaId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["aulas"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const alternarInscricao = useMutation({
    mutationFn: async ({
      matriculaId,
      moduloId,
      inscrito,
    }: {
      matriculaId: string;
      moduloId: string;
      inscrito: boolean;
    }) => {
      if (inscrito) {
        const { error } = await supabase
          .from("matricula_modulos")
          .delete()
          .eq("matricula_id", matriculaId)
          .eq("modulo_id", moduloId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("matricula_modulos")
          .insert({ matricula_id: matriculaId, modulo_id: moduloId });
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["inscricoes"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  if (!sala) {
    return <p className="text-sm text-muted-foreground">Carregando sala…</p>;
  }

  return (
    <div className="space-y-6">
      <Link
        to="/salas"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Salas
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl">{sala.nome}</h1>
          <p className="text-sm text-muted-foreground">
            {curso?.nome} · {sala.turno ?? "—"} · início {dataBR(sala.data_inicio)}
          </p>
          <p className="mt-1 font-mono text-sm">{sala.convite}</p>
        </div>
        <QRCodeBox valor={`${origem}/matricula/${sala.convite}`} tamanho={104} />
      </div>

      <section className="space-y-3">
        <h2 className="text-lg">Módulos e aulas</h2>
        {(modulos.data ?? []).map((m) => (
          <Card key={m.id} className="gap-3 p-4">
            <h3 className="text-base font-semibold">{m.nome}</h3>
            <ul className="divide-y rounded-xl border">
              {(aulas.data ?? [])
                .filter((a) => a.modulo_id === m.id)
                .map((a) => (
                  <li key={a.id} className="flex items-center gap-3 px-3 py-2.5">
                    <span className="flex-1 text-sm">
                      Aula {a.numero} · {a.titulo}
                    </span>
                    <Input
                      type="date"
                      defaultValue={a.data?.slice(0, 10) ?? ""}
                      onBlur={(e) => salvarData.mutate({ aulaId: a.id, data: e.target.value })}
                      className="w-40"
                    />
                  </li>
                ))}
            </ul>
          </Card>
        ))}
        {(modulos.data ?? []).length === 0 && (
          <p className="text-sm text-muted-foreground">
            Esta sala não tem módulos — cadastre a ementa do curso e crie a sala novamente.
          </p>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg">Alunos e inscrição por módulo</h2>
        <Card className="overflow-x-auto p-4">
          <table className="w-full min-w-[520px] text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="py-2 pr-3 font-medium">Aluno</th>
                {(modulos.data ?? []).map((m) => (
                  <th key={m.id} className="px-2 py-2 text-center font-medium">
                    {m.ordem}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {(matriculas.data ?? []).map((mat) => {
                const perfil = (perfis.data ?? []).find((p) => p.id === mat.aluno_id);
                return (
                  <tr key={mat.id}>
                    <td className="py-2 pr-3">
                      <span className="flex items-center gap-2">
                        <span className="grid size-8 place-items-center rounded-full bg-secondary text-[11px] font-bold text-secondary-foreground">
                          {iniciais(perfil?.nome ?? "?")}
                        </span>
                        <span>
                          <span className="block font-medium">{perfil?.nome ?? "—"}</span>
                          <span className="font-mono text-xs text-muted-foreground">
                            {perfil?.codigo}
                          </span>
                        </span>
                      </span>
                    </td>
                    {(modulos.data ?? []).map((m) => {
                      const inscrito = (inscricoes.data ?? []).some(
                        (i) => i.matricula_id === mat.id && i.modulo_id === m.id,
                      );
                      return (
                        <td key={m.id} className="px-2 py-2 text-center">
                          <Checkbox
                            checked={inscrito}
                            aria-label={`${perfil?.nome} em ${m.nome}`}
                            onCheckedChange={() =>
                              alternarInscricao.mutate({
                                matriculaId: mat.id,
                                moduloId: m.id,
                                inscrito,
                              })
                            }
                          />
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
              {(matriculas.data ?? []).length === 0 && (
                <tr>
                  <td
                    colSpan={(modulos.data ?? []).length + 1}
                    className="py-3 text-muted-foreground"
                  >
                    Nenhum aluno matriculado. Compartilhe o QR de convite.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </Card>
      </section>
    </div>
  );
}
