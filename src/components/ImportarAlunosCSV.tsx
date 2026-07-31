import { useMemo, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { importarAlunosLote, type ResultadoImportacao } from "@/lib/importacao.functions";
import { mapearAlunosComIA } from "@/lib/importacao-ia.functions";
import { analisarCSVAlunos, MODELO_CSV, type LinhaCSV } from "@/lib/csv-alunos";
import { arquivoParaTexto, ACEITA_ARQUIVOS } from "@/lib/planilha-alunos";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Download, Sparkles, Upload } from "lucide-react";


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

  const linhas: LinhaCSV[] = useMemo(() => analisarCSVAlunos(texto), [texto]);
  const validas = linhas.filter((l) => l.erros.length === 0);
  const invalidas = linhas.filter((l) => l.erros.length > 0);

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
          <h3 className="text-base font-semibold">Importar alunos por CSV</h3>
          <p className="text-sm text-muted-foreground">
            Colunas: nome, email, telefone, tipo (individual/casal), nome_casal, senha (opcional).
            Para casal, o nome do casal é obrigatório.
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={baixarModelo}>
          <Download className="size-4" /> Modelo CSV
        </Button>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="arquivo-csv">Arquivo CSV</Label>
        <input
          id="arquivo-csv"
          ref={arquivoRef}
          type="file"
          accept=".csv,text/csv,text/plain"
          className="block w-full text-sm"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            setResultados(null);
            setTexto(await f.text());
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
      </div>

      {linhas.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm">
            <strong>{validas.length}</strong> linha(s) prontas
            {invalidas.length > 0 && <> · {invalidas.length} com problema</>}
          </p>
          <div className="max-h-64 overflow-auto rounded-md border">
            <table className="w-full min-w-[560px] text-sm">
              <thead className="bg-muted/50 text-left">
                <tr>
                  <th className="px-3 py-2 font-medium">#</th>
                  <th className="px-3 py-2 font-medium">Nome</th>
                  <th className="px-3 py-2 font-medium">E-mail</th>
                  <th className="px-3 py-2 font-medium">Tipo</th>
                  <th className="px-3 py-2 font-medium">Situação</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {linhas.map((l) => (
                  <tr key={l.linha} className={l.erros.length ? "bg-destructive/5" : undefined}>
                    <td className="px-3 py-2 text-muted-foreground">{l.linha}</td>
                    <td className="px-3 py-2">{l.nome || "—"}</td>
                    <td className="px-3 py-2">{l.email || "—"}</td>
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
