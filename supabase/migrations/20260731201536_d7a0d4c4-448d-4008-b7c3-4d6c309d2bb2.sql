CREATE TYPE public.tipo_material AS ENUM ('ebook','apostila','planilha','slides','video','link');

CREATE TABLE public.materiais (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  aula_id uuid NOT NULL REFERENCES public.aulas(id) ON DELETE CASCADE,
  titulo text NOT NULL,
  tipo public.tipo_material NOT NULL DEFAULT 'link',
  url text,
  storage_path text,
  nome_arquivo text,
  tamanho bigint,
  publicado_por uuid REFERENCES public.perfis(id),
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT materiais_origem_check CHECK (url IS NOT NULL OR storage_path IS NOT NULL)
);

CREATE INDEX materiais_aula_id_idx ON public.materiais(aula_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.materiais TO authenticated;
GRANT ALL ON public.materiais TO service_role;

ALTER TABLE public.materiais ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION interno.aluno_ve_aula(_aula_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.aulas a
    JOIN public.matricula_modulos mm ON mm.modulo_id = a.modulo_id
    JOIN public.matriculas m ON m.id = mm.matricula_id
    WHERE a.id = _aula_id
      AND m.aluno_id = auth.uid()
      AND m.status = 'ativa'
  )
$$;

REVOKE ALL ON FUNCTION interno.aluno_ve_aula(uuid) FROM PUBLIC, anon, authenticated;

CREATE POLICY materiais_select ON public.materiais
  FOR SELECT TO authenticated
  USING (
    interno.sala_gerenciavel(interno.sala_da_aula(aula_id))
    OR interno.aluno_ve_aula(aula_id)
  );

CREATE POLICY materiais_write ON public.materiais
  FOR ALL TO authenticated
  USING (interno.sala_gerenciavel(interno.sala_da_aula(aula_id)))
  WITH CHECK (interno.sala_gerenciavel(interno.sala_da_aula(aula_id)));

CREATE OR REPLACE FUNCTION public.materiais_touch()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$ BEGIN NEW.atualizado_em = now(); RETURN NEW; END; $$;

CREATE TRIGGER materiais_atualizado_em
  BEFORE UPDATE ON public.materiais
  FOR EACH ROW EXECUTE FUNCTION public.materiais_touch();
