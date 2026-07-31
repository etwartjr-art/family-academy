CREATE OR REPLACE FUNCTION interno.aula_do_caminho(_nome text)
RETURNS uuid
LANGUAGE sql
IMMUTABLE
SET search_path = interno, public
AS $$
  SELECT CASE
    WHEN split_part(_nome, '/', 1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      THEN split_part(_nome, '/', 1)::uuid
    ELSE NULL
  END;
$$;

REVOKE ALL ON FUNCTION interno.aula_do_caminho(text) FROM PUBLIC;

DROP POLICY IF EXISTS materiais_arquivos_insert ON storage.objects;
CREATE POLICY materiais_arquivos_insert
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'materiais'
  AND interno.sala_gerenciavel(
        interno.sala_da_aula(interno.aula_do_caminho(name))
      )
);

DROP POLICY IF EXISTS materiais_arquivos_delete ON storage.objects;
CREATE POLICY materiais_arquivos_delete
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'materiais'
  AND (
    interno.sala_gerenciavel(
      interno.sala_da_aula(interno.aula_do_caminho(name))
    )
    OR owner_id = auth.uid()::text
  )
);