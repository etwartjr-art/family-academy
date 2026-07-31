CREATE OR REPLACE FUNCTION public.matricular_por_convite(_convite text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _sala_id uuid;
  _matricula_id uuid;
  _uid uuid := auth.uid();
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'É preciso estar autenticado para se matricular';
  END IF;

  SELECT id INTO _sala_id FROM public.salas WHERE upper(convite) = upper(_convite);
  IF _sala_id IS NULL THEN
    RAISE EXCEPTION 'Convite inválido';
  END IF;

  SELECT id INTO _matricula_id
  FROM public.matriculas
  WHERE aluno_id = _uid AND sala_id = _sala_id;

  IF _matricula_id IS NULL THEN
    INSERT INTO public.matriculas (aluno_id, sala_id, status)
    VALUES (_uid, _sala_id, 'ativa')
    RETURNING id INTO _matricula_id;
  END IF;

  INSERT INTO public.matricula_modulos (matricula_id, modulo_id)
  SELECT _matricula_id, m.id
  FROM public.modulos m
  WHERE m.sala_id = _sala_id
  ON CONFLICT DO NOTHING;

  IF NOT EXISTS (
    SELECT 1 FROM public.papeis_usuario WHERE user_id = _uid
  ) THEN
    INSERT INTO public.papeis_usuario (user_id, papel) VALUES (_uid, 'aluno')
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN _matricula_id;
END;
$$;

REVOKE ALL ON FUNCTION public.matricular_por_convite(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.matricular_por_convite(text) TO authenticated;