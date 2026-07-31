-- 1. Restringir leitura das sessões de chamada
DROP POLICY IF EXISTS sessoes_select ON public.sessoes_chamada;
CREATE POLICY sessoes_select ON public.sessoes_chamada
FOR SELECT TO authenticated
USING (
  public.sala_gerenciavel(public.sala_da_aula(aula_id))
  OR public.esta_matriculado(public.sala_da_aula(aula_id))
);

-- 2. Funções internas (gatilhos e utilitários) não devem ser chamáveis pela API
REVOKE ALL ON FUNCTION public.handle_new_user() FROM anon, authenticated, PUBLIC;
REVOKE ALL ON FUNCTION public.aplicar_ementa_na_sala() FROM anon, authenticated, PUBLIC;
REVOKE ALL ON FUNCTION public.criar_aulas_do_modulo() FROM anon, authenticated, PUBLIC;
REVOKE ALL ON FUNCTION public.inscrever_em_modulos() FROM anon, authenticated, PUBLIC;
REVOKE ALL ON FUNCTION public.gerar_codigo(integer) FROM anon, authenticated, PUBLIC;

-- 3. Funções sensíveis exigem login (nunca anon)
REVOKE ALL ON FUNCTION public.registrar_presenca(uuid, text, uuid, public.metodo_presenca, text) FROM anon, PUBLIC;
REVOKE ALL ON FUNCTION public.matricular_por_convite(text) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.registrar_presenca(uuid, text, uuid, public.metodo_presenca, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.matricular_por_convite(text) TO authenticated;

-- 4. Auxiliares de RLS: apenas usuários autenticados
REVOKE ALL ON FUNCTION public.tem_papel(uuid, public.papel_app) FROM anon, PUBLIC;
REVOKE ALL ON FUNCTION public.e_coordenador() FROM anon, PUBLIC;
REVOKE ALL ON FUNCTION public.e_professor_da_sala(uuid) FROM anon, PUBLIC;
REVOKE ALL ON FUNCTION public.esta_matriculado(uuid) FROM anon, PUBLIC;
REVOKE ALL ON FUNCTION public.sala_gerenciavel(uuid) FROM anon, PUBLIC;
REVOKE ALL ON FUNCTION public.sala_visivel(uuid) FROM anon, PUBLIC;
REVOKE ALL ON FUNCTION public.aluno_visivel(uuid) FROM anon, PUBLIC;
REVOKE ALL ON FUNCTION public.sala_da_aula(uuid) FROM anon, PUBLIC;
REVOKE ALL ON FUNCTION public.sala_do_modulo(uuid) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.tem_papel(uuid, public.papel_app) TO authenticated;
GRANT EXECUTE ON FUNCTION public.e_coordenador() TO authenticated;
GRANT EXECUTE ON FUNCTION public.e_professor_da_sala(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.esta_matriculado(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sala_gerenciavel(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sala_visivel(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.aluno_visivel(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sala_da_aula(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sala_do_modulo(uuid) TO authenticated;

-- 5. Consulta pública de sala por convite continua acessível (página de matrícula)
GRANT EXECUTE ON FUNCTION public.sala_por_convite(text) TO anon, authenticated;