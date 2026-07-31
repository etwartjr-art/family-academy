import { useQuery } from "@tanstack/react-query";
import { buscarSessao } from "@/lib/api";

export function useSessao() {
  return useQuery({ queryKey: ["sessao"], queryFn: buscarSessao, staleTime: 60_000 });
}
