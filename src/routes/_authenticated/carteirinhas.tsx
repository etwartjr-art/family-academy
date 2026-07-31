import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { listarSalas, listarMatriculas, listarPerfis, listarCursos } from "@/lib/api";
import { QRCodeBox } from "@/components/QRCodeBox";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Printer } from "lucide-react";

export const Route = createFileRoute("/_authenticated/carteirinhas")({
  head: () => ({
    meta: [
      { title: "Carteirinhas — Escola de Finanças" },
      {
        name: "description",
        content: "Gere e imprima as carteirinhas dos alunos com QR code para a chamada.",
      },
      { property: "og:title", content: "Carteirinhas — Escola de Finanças" },
      { property: "og:description", content: "Carteirinhas com QR para chamada." },
    ],
  }),
  component: Carteirinhas,
});

function Carteirinhas() {
  const [salaId, setSalaId] = useState("");
  const salas = useQuery({ queryKey: ["salas"], queryFn: () => listarSalas() });
  const cursos = useQuery({ queryKey: ["cursos"], queryFn: listarCursos });
  const matriculas = useQuery({ queryKey: ["matriculas"], queryFn: () => listarMatriculas() });
  const perfis = useQuery({ queryKey: ["perfis"], queryFn: listarPerfis });

  const sala = (salas.data ?? []).find((s) => s.id === salaId);
  const curso = (cursos.data ?? []).find((c) => c.id === sala?.curso_id);
  const alunos = (matriculas.data ?? [])
    .filter((m) => m.sala_id === salaId)
    .map((m) => (perfis.data ?? []).find((p) => p.id === m.aluno_id))
    .filter((p): p is NonNullable<typeof p> => !!p)
    .sort((a, b) => a.nome.localeCompare(b.nome));

  return (
    <div className="space-y-6">
      <div className="sem-impressao flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl">Carteirinhas</h1>
          <p className="text-sm text-muted-foreground">
            Cada QR contém o código do aluno usado na chamada.
          </p>
        </div>
        <Button variant="secondary" onClick={() => window.print()} disabled={!salaId}>
          <Printer className="size-4" /> Imprimir
        </Button>
      </div>

      <Card className="sem-impressao gap-3 p-4">
        <div className="space-y-1.5">
          <Label>Sala</Label>
          <Select value={salaId} onValueChange={setSalaId}>
            <SelectTrigger className="max-w-sm">
              <SelectValue placeholder="Escolha a sala" />
            </SelectTrigger>
            <SelectContent>
              {(salas.data ?? []).map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2">
        {alunos.map((a) => (
          <div
            key={a.id}
            className="flex items-center gap-3 rounded-2xl border bg-card p-4 shadow-diario"
          >
            <QRCodeBox valor={`FA|ALUNO|${a.codigo}`} tamanho={84} />
            <div className="min-w-0">
              <div className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
                {curso?.nome ?? "Escola de Finanças"}
              </div>
              <div className="truncate font-display text-base font-extrabold">{a.nome}</div>
              <div className="font-mono text-sm">{a.codigo}</div>
              <div className="text-xs text-muted-foreground">{sala?.nome}</div>
            </div>
          </div>
        ))}
        {salaId && alunos.length === 0 && (
          <p className="text-sm text-muted-foreground">Nenhum aluno matriculado nesta sala.</p>
        )}
      </div>
    </div>
  );
}
