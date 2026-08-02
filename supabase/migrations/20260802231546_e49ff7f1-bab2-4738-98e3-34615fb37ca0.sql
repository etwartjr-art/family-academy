CREATE TABLE public.tarefas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  aula_id uuid NOT NULL REFERENCES public.aulas(id) ON DELETE CASCADE,
  titulo text NOT NULL,
  instrucoes text,
  link text,
  rotulo_link text,
  ordem integer NOT NULL DEFAULT 0,
  criado_por uuid REFERENCES public.perfis(id),
  criado_em timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX tarefas_aula_idx ON public.tarefas(aula_id, ordem);

CREATE TABLE public.conclusoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tarefa_id uuid NOT NULL REFERENCES public.tarefas(id) ON DELETE CASCADE,
  aluno_id uuid NOT NULL REFERENCES public.perfis(id) ON DELETE CASCADE,
  em timestamptz NOT NULL DEFAULT now(),
  por text NOT NULL DEFAULT 'aluno' CHECK (por IN ('aluno','professor')),
  UNIQUE (tarefa_id, aluno_id)
);
CREATE INDEX conclusoes_tarefa_idx ON public.conclusoes(tarefa_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tarefas TO authenticated;
GRANT ALL ON public.tarefas TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.conclusoes TO authenticated;
GRANT ALL ON public.conclusoes TO service_role;

CREATE OR REPLACE FUNCTION interno.aula_da_tarefa(_tarefa_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, interno
AS $$ SELECT aula_id FROM public.tarefas WHERE id = _tarefa_id $$;

REVOKE ALL ON FUNCTION interno.aula_da_tarefa(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION interno.aula_da_tarefa(uuid) TO authenticated;

ALTER TABLE public.tarefas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conclusoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY tarefas_select ON public.tarefas
  FOR SELECT TO authenticated
  USING (
    interno.sala_gerenciavel(interno.sala_da_aula(aula_id))
    OR interno.aluno_ve_aula(aula_id)
  );

CREATE POLICY tarefas_write ON public.tarefas
  FOR ALL TO authenticated
  USING (interno.sala_gerenciavel(interno.sala_da_aula(aula_id)))
  WITH CHECK (interno.sala_gerenciavel(interno.sala_da_aula(aula_id)));

CREATE POLICY conclusoes_select ON public.conclusoes
  FOR SELECT TO authenticated
  USING (
    aluno_id = auth.uid()
    OR interno.sala_gerenciavel(interno.sala_da_aula(interno.aula_da_tarefa(tarefa_id)))
  );

CREATE POLICY conclusoes_insert_propria ON public.conclusoes
  FOR INSERT TO authenticated
  WITH CHECK (
    aluno_id = auth.uid()
    AND por = 'aluno'
    AND interno.aluno_ve_aula(interno.aula_da_tarefa(tarefa_id))
  );

CREATE POLICY conclusoes_delete_propria ON public.conclusoes
  FOR DELETE TO authenticated
  USING (aluno_id = auth.uid());

CREATE POLICY conclusoes_professor ON public.conclusoes
  FOR ALL TO authenticated
  USING (interno.sala_gerenciavel(interno.sala_da_aula(interno.aula_da_tarefa(tarefa_id))))
  WITH CHECK (interno.sala_gerenciavel(interno.sala_da_aula(interno.aula_da_tarefa(tarefa_id))));