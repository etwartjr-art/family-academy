-- remove duplicate enrollments (keep oldest), then enforce uniqueness
WITH dups AS (
  SELECT id, row_number() OVER (PARTITION BY aluno_id, sala_id ORDER BY criado_em) AS rn
  FROM public.matriculas
)
DELETE FROM public.matricula_modulos mm
USING dups d WHERE mm.matricula_id = d.id AND d.rn > 1;

WITH dups AS (
  SELECT id, row_number() OVER (PARTITION BY aluno_id, sala_id ORDER BY criado_em) AS rn
  FROM public.matriculas
)
DELETE FROM public.matriculas m
USING dups d WHERE m.id = d.id AND d.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS matriculas_aluno_sala_unico
  ON public.matriculas (aluno_id, sala_id);