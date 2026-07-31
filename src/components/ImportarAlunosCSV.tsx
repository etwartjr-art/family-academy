import { useMemo, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { importarAlunosLote, type ResultadoImportacao } from "@/lib/importacao.functions";
import { mapearAlunosComIA } from "@/lib/importacao-ia.functions";
import {
  analisarCSVAlunos,
  linhasImportaveis,
  resolverDuplicados,
  MODELO_CSV,
  type LinhaCSV,
} from "@/lib/csv-alunos";
import { arquivoParaTexto, ACEITA_ARQUIVOS, baixarModeloXLSX } from "@/lib/planilha-alunos";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { AlertTriangle, Download, Sparkles, Upload } from "lucide-react";


const ROTULO_STATUS: Record<ResultadoImportacao["status"], string> = {
  criado: "Criado",
  matriculado: "Matriculado",
  ja_matriculado: "Já matriculado",
  erro: "Erro",
};

export function ImportarAlunosCSV({ salaId }: { salaId: string }) {
  const qc = useQueryClient();
  const arquivoRef = useRef<HTMLInputElement>(null);
  const [texto, setTexto] = useState("");
  const [resultados, setResultados] = useState<ResultadoImportacao[] | null>(null);
  const [soErros, setSoErros] = useState(false);

  const linhas: LinhaCSV[] = useMemo(() => analisarCSVAlunos(texto), [texto]);
  const validas = linhasImportaveis(linhas);
  const invalidas = linhas.filter((l) => l.erros.length > 0);
  const duplicadas = linhas.filter((l) => l.duplicado);
  const conflitos = duplicadas.filter((l) => l.duplicado === "email");
  const problemas = linhas.filter((l) => l.erros.length > 0 || l.duplicado);
  const exibidas = soErros ? problemas : linhas;

  const resumoErros = useMemo(() => {
    const contagem = new Map<string, number>();
    for (const l of linhas) for (const e of l.erros) contagem.set(e, (contagem.get(e) ?? 0) + 1);
    return [...contagem.entries()].sort((a, b) => b[1] - a[1]);
  }, [linhas]);


  const importar = useServerFn(importarAlunosLote);
  const mapearIA = useServerFn(mapearAlunosComIA);

  const organizarComIA = useMutation({
    mutationFn: async () => mapearIA({ data: { conteudo: texto.slice(0, 60000) } }),
    onSuccess: (r) => {
      if (r.total === 0) {
        toast.error("A IA não encontrou alunos nesse conteúdo");
        return;
      }
      setResultados(null);
      setTexto(r.csv);
      toast.success(`${r.total} aluno(s) organizados pela IA — revise antes de importar`);
    },
    onError: (e: Error) => toast.error(e.message),
  });


  const enviar = useMutation({
    mutationFn: async () =>
      importar({
        data: {
          salaId,
          linhas: validas.map((l) => ({
            nome: l.nome,
            email: l.email,
            telefone: l.telefone,
            senha: l.senha,
            tipo: l.tipo,
            nome_casal: l.nome_casal,
          })),
        },
      }),
    onSuccess: (r) => {
      setResultados(r.resultados);
      const erros = r.resultados.filter((x) => x.status === "erro").length;
      if (erros === 0) toast.success(`${r.resultados.length} aluno(s) importado(s)`);
      else toast.warning(`${r.resultados.length - erros} importado(s), ${erros} com erro`);
      qc.invalidateQueries({ queryKey: ["matriculas"] });
      qc.invalidateQueries({ queryKey: ["perfis"] });
      qc.invalidateQueries({ queryKey: ["inscricoes"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function baixarModelo() {
    const url = URL.createObjectURL(new Blob([MODELO_CSV], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "modelo-alunos.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Card className="gap-4 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold">Importar alunos (CSV, Excel ou IA)</h3>
          <p className="text-sm text-muted-foreground">
            Envie um arquivo .csv ou .xlsx, ou cole qualquer lista e use a IA para organizar as
            colunas (nome, e-mail, telefone, tipo individual/casal e nome do casal).
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={baixarModelo}>
            <Download className="size-4" /> Modelo CSV
          </Button>
          <Button size="sm" variant="outline" onClick={baixarModeloXLSX}>
            <Download className="size-4" /> Modelo XLSX
          </Button>
        </div>

      </div>

      <div className="space-y-1.5">
        <Label htmlFor="arquivo-csv">Arquivo (.csv ou .xlsx)</Label>
        <input
          id="arquivo-csv"
          ref={arquivoRef}
          type="file"
          accept={ACEITA_ARQUIVOS}
          className="block w-full text-sm"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            setResultados(null);
            try {
              setTexto(await arquivoParaTexto(f));
            } catch {
              toast.error("Não foi possível ler este arquivo");
            }
          }}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="texto-csv">…ou cole os dados</Label>
        <Textarea
          id="texto-csv"
          rows={5}
          className="font-mono text-xs"
          placeholder={MODELO_CSV}
          value={texto}
          onChange={(e) => {
            setResultados(null);
            setTexto(e.target.value);
          }}
        />
        <Button
          size="sm"
          variant="secondary"
          onClick={() => organizarComIA.mutate()}
          disabled={organizarComIA.isPending || texto.trim().length < 3}
        >
          <Sparkles className="size-4" />
          {organizarComIA.isPending ? "Organizando com IA…" : "Organizar com IA"}
        </Button>
      </div>


      {linhas.length > 0 && (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm">
              <strong>{validas.length}</strong> linha(s) prontas
              {invalidas.length > 0 && (
                <>
                  {" · "}
                  <span className="text-destructive">{invalidas.length} com problema</span>
                </>
              )}
              {duplicadas.length > 0 && (
                <>
                  {" · "}
                  <span className="text-amber-600 dark:text-amber-500">
                    {duplicadas.length} duplicada(s)
                  </span>
                </>
              )}
            </p>
            {problemas.length > 0 && (
              <Button size="sm" variant="ghost" onClick={() => setSoErros((v) => !v)}>
                {soErros ? "Mostrar todas" : "Ver só as com problema"}
              </Button>
            )}
          </div>

          {invalidas.length > 0 && (
            <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3">
              <p className="flex items-center gap-1.5 text-sm font-medium text-destructive">
                <AlertTriangle className="size-4" /> Corrija antes de importar
              </p>
              <ul className="mt-1.5 space-y-0.5 text-sm text-muted-foreground">
                {resumoErros.map(([erro, qtd]) => (
                  <li key={erro}>
                    • {erro} — {qtd} linha(s)
                  </li>
                ))}
              </ul>
              <p className="mt-1.5 text-xs text-muted-foreground">
                As linhas com problema não serão importadas.
              </p>
            </div>
          )}

          {duplicadas.length > 0 && (
            <div className="rounded-md border border-amber-500/40 bg-amber-500/5 p-3">
              <p className="flex items-center gap-1.5 text-sm font-medium text-amber-700 dark:text-amber-500">
                <Copy className="size-4" /> {duplicadas.length} aluno(s) duplicado(s) por
                nome+e-mail
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {duplicadas.length - conflitos.length} repetição(ões) idêntica(s)
                {conflitos.length > 0 && (
                  <> · {conflitos.length} com o mesmo e-mail e nome diferente</>
                )}
                . As linhas duplicadas ficam de fora da importação.
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => aplicarDuplicados(false)}>
                  Remover duplicados
                </Button>
                <Button size="sm" variant="outline" onClick={() => aplicarDuplicados(true)}>
                  <Merge className="size-4" /> Mesclar duplicados
                </Button>
              </div>
              <p className="mt-1.5 text-xs text-muted-foreground">
                Mesclar agrupa pelo e-mail e completa os campos vazios (telefone, senha, casal) com
                os dados das linhas repetidas.
              </p>
            </div>
          )}


          <div className="max-h-64 overflow-auto rounded-md border">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="bg-muted/50 text-left">
                <tr>
                  <th className="px-3 py-2 font-medium">#</th>
                  <th className="px-3 py-2 font-medium">Nome</th>
                  <th className="px-3 py-2 font-medium">E-mail</th>
                  <th className="px-3 py-2 font-medium">Telefone</th>
                  <th className="px-3 py-2 font-medium">Tipo</th>
                  <th className="px-3 py-2 font-medium">Situação</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {exibidas.map((l) => (
                  <tr key={l.linha} className={l.erros.length ? "bg-destructive/5" : undefined}>
                    <td className="px-3 py-2 text-muted-foreground">{l.linha}</td>
                    <td className="px-3 py-2">{l.nome || "—"}</td>
                    <td className="px-3 py-2">{l.email || "—"}</td>
                    <td className="px-3 py-2">{l.telefone || "—"}</td>
                    <td className="px-3 py-2">
                      {l.tipo === "casal" ? `Casal · ${l.nome_casal || "—"}` : "Individual"}
                    </td>
                    <td className="px-3 py-2">
                      {l.erros.length ? (
                        <span className="text-destructive">{l.erros.join("; ")}</span>
                      ) : (
                        <span className="text-muted-foreground">OK</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}


      <div className="flex flex-wrap items-center gap-2">
        <Button
          onClick={() => enviar.mutate()}
          disabled={enviar.isPending || validas.length === 0}
        >
          <Upload className="size-4" />
          {enviar.isPending ? "Importando…" : `Importar ${validas.length} aluno(s)`}
        </Button>
        {texto && (
          <Button
            variant="ghost"
            onClick={() => {
              setTexto("");
              setResultados(null);
              if (arquivoRef.current) arquivoRef.current.value = "";
            }}
          >
            Limpar
          </Button>
        )}
      </div>

      {resultados && (
        <div className="max-h-64 overflow-auto rounded-md border">
          <table className="w-full min-w-[480px] text-sm">
            <thead className="bg-muted/50 text-left">
              <tr>
                <th className="px-3 py-2 font-medium">Aluno</th>
                <th className="px-3 py-2 font-medium">Resultado</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {resultados.map((r) => (
                <tr key={r.email} className={r.status === "erro" ? "bg-destructive/5" : undefined}>
                  <td className="px-3 py-2">
                    <span className="block font-medium">{r.nome}</span>
                    <span className="text-xs text-muted-foreground">{r.email}</span>
                  </td>
                  <td className="px-3 py-2">
                    <span className={r.status === "erro" ? "text-destructive" : undefined}>
                      {ROTULO_STATUS[r.status]} — {r.mensagem}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
