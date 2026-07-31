DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'tipo_matricula') THEN
    CREATE TYPE public.tipo_matricula AS ENUM ('individual', 'casal');
  END IF;
END $$;

ALTER TABLE public.matriculas
  ADD COLUMN IF NOT EXISTS tipo public.tipo_matricula NOT NULL DEFAULT 'individual',
  ADD COLUMN IF NOT EXISTS nome_casal text;

CREATE OR REPLACE FUNCTION public.matricular_por_convite(_convite text, _tipo public.tipo_matricula DEFAULT 'individual', _nome_casal text DEFAULT NULL)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    INSERT INTO public.matriculas (aluno_id, sala_id, status, tipo, nome_casal)
    VALUES (_uid, _sala_id, 'ativa', COALESCE(_tipo, 'individual'), NULLIF(btrim(COALESCE(_nome_casal, '')), ''))
    RETURNING id INTO _matricula_id;
  ELSE
    UPDATE public.matriculas
    SET tipo = COALESCE(_tipo, tipo),
        nome_casal = COALESCE(NULLIF(btrim(COALESCE(_nome_casal, '')), ''), nome_casal)
    WHERE id = _matricula_id;
  END IF;

  INSERT INTO public.matricula_modulos (matricula_id, modulo_id)
  SELECT _matricula_id, m.id
  FROM public.modulos m
  WHERE m.sala_id = _sala_id
  ON CONFLICT DO NOTHING;

  IF NOT EXISTS (SELECT 1 FROM public.papeis_usuario WHERE user_id = _uid) THEN
    INSERT INTO public.papeis_usuario (user_id, papel) VALUES (_uid, 'aluno')
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN _matricula_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.matricular_por_convite(text, public.tipo_matricula, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.matricular_por_convite(text, public.tipo_matricula, text) TO authenticated;