import { useQuery } from "@tanstack/react-query";
import { useSessao } from "@/hooks/useSessao";
import {
  calcular,
  listarPermissoesPapel,
  listarPermissoesUsuario,
  type ChaveAcesso,
} from "@/lib/permissoes";

/** Permissões efetivas do usuário logado. */
export function usePermissoes() {
  const sessao = useSessao();
  const porPapel = useQuery({
    queryKey: ["permissoes-papel"],
    queryFn: listarPermissoesPapel,
    staleTime: 60_000,
  });
  const porUsuario = useQuery({
    queryKey: ["permissoes-usuario"],
    queryFn: listarPermissoesUsuario,
    staleTime: 60_000,
  });

  const carregando = sessao.isLoading || porPapel.isLoading || porUsuario.isLoading;

  const pode = (chave: ChaveAcesso) =>
    calcular(
      chave,
      sessao.data?.papel,
      sessao.data?.perfil?.id,
      porPapel.data ?? [],
      porUsuario.data ?? [],
    );

  return { pode, carregando };
}
