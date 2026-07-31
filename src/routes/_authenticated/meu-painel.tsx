import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useSessao } from "@/hooks/useSessao";
import {
  listarSalas,
  listarCursos,
  listarModulos,
  listarAulas,
  listarMatriculas,
  listarInscricoes,
  listarPresencas,
  FREQUENCIA_MINIMA,
  dataBR,
} from "@/lib/api";
import { QRCodeBox } from "@/components/QRCodeBox";
import { Card } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/meu-painel")({
  head: () => ({
    meta: [
      { title: "Minha carteirinha — Escola de Finanças" },
      {
        name: "description",
        content: "Sua carteirinha digital com QR code e o acompanhamento da sua frequência.",
      },
      { property: "og:title", content: "Minha carteirinha — Escola de Finanças" },
      { property: "og:description", content: "Carteirinha digital e frequência do aluno." },
    ],
  }),
  component: MeuPainel,
});

function MeuPainel() {
  const { data: sessao } = useSessao();
  const salas = useQuery({ queryKey: ["salas"], queryFn: () => listarSalas() });
  const cursos = useQuery({ queryKey: ["cursos"], queryFn: listarCursos });
  const modulos = useQuery({ queryKey: ["modulos"], queryFn: () => listarModulos() });
  const aulas = useQuery({ queryKey: ["aulas"], queryFn: () => listarAulas() });
  const matriculas = useQuery({ queryKey: ["matriculas"], queryFn: () => listarMatriculas() });
  const inscricoes = useQuery({ queryKey: ["inscricoes"], queryFn: listarInscricoes });
  const presencas = useQuery({ queryKey: ["presencas"], queryFn: () => listarPresencas() });

  const perfil = sessao?.perfil;
  const minhas = (matriculas.data ?? []).filter((m) => m.aluno_id === sessao?.user.id);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl">Minha carteirinha</h1>
        <p className="text-sm text-muted-foreground">
          Mostre o QR na entrada da aula para registrar sua presença.
        </p>
      </div>

      {perfil && (
        <div className="flex items-center gap-4 rounded-2xl bg-sidebar p-5 text-white shadow-diario">
          <QRCodeBox valor={`FA|ALUNO|${perfil.codigo}`} tamanho={112} />
          <div className="min-w-0">
            <div className="text-[11px] uppercase tracking-[0.08em] text-sidebar-foreground/70">
              Escola de Finanças
            </div>
            <div className="truncate font-display text-xl font-extrabold">{perfil.nome}</div>
            <div className="font-mono text-lg">{perfil.codigo}</div>
          </div>
        </div>
      )}

      <section className="space-y-3">
        <h2 className="text-lg">Meus módulos</h2>
        {minhas.length === 0 && (
          <p className="text-sm text-muted-foreground">Você ainda não está em nenhuma turma.</p>
        )}
        {minhas.map((mat) => {
          const sala = (salas.data ?? []).find((s) => s.id === mat.sala_id);
          const curso = (cursos.data ?? []).find((c) => c.id === sala?.curso_id);
          const mods = (modulos.data ?? []).filter(
            (m) =>
              m.sala_id === mat.sala_id &&
              (inscricoes.data ?? []).some(
                (i) => i.matricula_id === mat.id && i.modulo_id === m.id,
              ),
          );
          return (
            <Card key={mat.id} className="gap-3 p-4">
              <div>
                <h3 className="text-base font-semibold">{sala?.nome}</h3>
                <p className="text-xs text-muted-foreground">
                  {curso?.nome} · início {dataBR(sala?.data_inicio)}
                </p>
              </div>
              <ul className="divide-y rounded-xl border">
                {mods.map((m) => {
                  const aulasMod = (aulas.data ?? []).filter((a) => a.modulo_id === m.id);
                  const total = aulasMod.filter((a) =>
                    (presencas.data ?? []).some(
                      (p) => p.aula_id === a.id && p.aluno_id === sessao?.user.id,
                    ),
                  ).length;
                  const pct = aulasMod.length ? Math.round((total / aulasMod.length) * 100) : 0;
                  return (
                    <li key={m.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
                      <span className="text-sm">{m.nome}</span>
                      <span
                        className={`text-sm font-semibold ${
                          pct < FREQUENCIA_MINIMA ? "text-destructive" : "text-primary"
                        }`}
                      >
                        {total}/{aulasMod.length} · {pct}%
                      </span>
                    </li>
                  );
                })}
                {mods.length === 0 && (
                  <li className="px-3 py-2.5 text-sm text-muted-foreground">
                    Sem módulos inscritos.
                  </li>
                )}
              </ul>
            </Card>
          );
        })}
      </section>
    </div>
  );
}
