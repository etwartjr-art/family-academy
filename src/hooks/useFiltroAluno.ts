import { useCallback, useEffect, useState } from "react";

/**
 * Filtro de aluno compartilhado entre as telas de Tarefas, Frequência e Chamada.
 * O valor "todos" significa sem filtro. Persistido em localStorage e sincronizado
 * entre componentes/abas por evento.
 */
const CHAVE = "filtro-aluno";
const EVENTO = "filtro-aluno-alterado";

export const TODOS_ALUNOS = "todos";

function ler(): string {
  if (typeof window === "undefined") return TODOS_ALUNOS;
  try {
    return window.localStorage.getItem(CHAVE) || TODOS_ALUNOS;
  } catch {
    return TODOS_ALUNOS;
  }
}

export function useFiltroAluno() {
  const [alunoSel, setEstado] = useState<string>(TODOS_ALUNOS);

  // Lê após a hidratação para não divergir do HTML do servidor.
  useEffect(() => {
    setEstado(ler());
  }, []);

  useEffect(() => {
    const sincronizar = () => setEstado(ler());
    window.addEventListener(EVENTO, sincronizar);
    window.addEventListener("storage", sincronizar);
    return () => {
      window.removeEventListener(EVENTO, sincronizar);
      window.removeEventListener("storage", sincronizar);
    };
  }, []);

  const setAlunoSel = useCallback((valor: string) => {
    setEstado(valor);
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(CHAVE, valor);
    } catch {
      // ignora armazenamento indisponível
    }
    window.dispatchEvent(new Event(EVENTO));
  }, []);

  return { alunoSel, setAlunoSel, filtrando: alunoSel !== TODOS_ALUNOS };
}
