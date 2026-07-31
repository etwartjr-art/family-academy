CREATE TABLE public.permissoes_papel (
  papel public.papel_app NOT NULL,
  chave text NOT NULL,
  permitido boolean NOT NULL DEFAULT false,
  PRIMARY KEY (papel, chave)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.permissoes_papel TO authenticated;
GRANT ALL ON public.permissoes_papel TO service_role;
ALTER TABLE public.permissoes_papel ENABLE ROW LEVEL SECURITY;
CREATE POLICY permissoes_papel_select ON public.permissoes_papel FOR SELECT TO authenticated USING (true);
CREATE POLICY permissoes_papel_write ON public.permissoes_papel FOR ALL TO authenticated USING (public.e_coordenador()) WITH CHECK (public.e_coordenador());

CREATE TABLE public.permissoes_usuario (
  user_id uuid NOT NULL REFERENCES public.perfis(id) ON DELETE CASCADE,
  chave text NOT NULL,
  permitido boolean NOT NULL,
  PRIMARY KEY (user_id, chave)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.permissoes_usuario TO authenticated;
GRANT ALL ON public.permissoes_usuario TO service_role;
ALTER TABLE public.permissoes_usuario ENABLE ROW LEVEL SECURITY;
CREATE POLICY permissoes_usuario_select ON public.permissoes_usuario FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.e_coordenador());
CREATE POLICY permissoes_usuario_write ON public.permissoes_usuario FOR ALL TO authenticated USING (public.e_coordenador()) WITH CHECK (public.e_coordenador());

CREATE OR REPLACE FUNCTION public.pode(_user_id uuid, _chave text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT permitido FROM public.permissoes_usuario WHERE user_id = _user_id AND chave = _chave),
    (SELECT pp.permitido FROM public.permissoes_papel pp
      JOIN public.papeis_usuario pu ON pu.papel = pp.papel
      WHERE pu.user_id = _user_id AND pp.chave = _chave
      ORDER BY pp.permitido DESC LIMIT 1),
    false
  );
$$;
REVOKE ALL ON FUNCTION public.pode(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pode(uuid, text) TO authenticated;

INSERT INTO public.permissoes_papel (papel, chave, permitido) VALUES
  ('coordenador','painel',true),('coordenador','meu_painel',true),('coordenador','cursos',true),('coordenador','salas',true),('coordenador','alunos',true),('coordenador','chamada',true),('coordenador','frequencia',true),('coordenador','carteirinhas',true),('coordenador','pessoas',true),('coordenador','acessos',true),
  ('professor','painel',true),('professor','meu_painel',false),('professor','cursos',false),('professor','salas',true),('professor','alunos',true),('professor','chamada',true),('professor','frequencia',true),('professor','carteirinhas',true),('professor','pessoas',false),('professor','acessos',false),
  ('aluno','painel',true),('aluno','meu_painel',true),('aluno','cursos',false),('aluno','salas',false),('aluno','alunos',false),('aluno','chamada',false),('aluno','frequencia',true),('aluno','carteirinhas',false),('aluno','pessoas',false),('aluno','acessos',false);