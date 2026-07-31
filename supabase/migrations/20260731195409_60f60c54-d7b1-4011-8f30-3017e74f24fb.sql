-- 1. Private schema (not exposed through the Data API)
CREATE SCHEMA IF NOT EXISTS interno;
GRANT USAGE ON SCHEMA interno TO anon, authenticated, service_role;

-- 2. Move SECURITY DEFINER helpers out of the exposed schema (keeps policy dependencies intact)
ALTER FUNCTION public.tem_papel(uuid, public.papel_app) SET SCHEMA interno;
ALTER FUNCTION public.e_coordenador() SET SCHEMA interno;
ALTER FUNCTION public.e_professor_da_sala(uuid) SET SCHEMA interno;
ALTER FUNCTION public.esta_matriculado(uuid) SET SCHEMA interno;
ALTER FUNCTION public.aluno_visivel(uuid) SET SCHEMA interno;
ALTER FUNCTION public.sala_da_aula(uuid) SET SCHEMA interno;
ALTER FUNCTION public.sala_do_modulo(uuid) SET SCHEMA interno;
ALTER FUNCTION public.sala_gerenciavel(uuid) SET SCHEMA interno;
ALTER FUNCTION public.sala_visivel(uuid) SET SCHEMA interno;
ALTER FUNCTION public.pode(uuid, text) SET SCHEMA interno;
ALTER FUNCTION public.sala_por_convite(text) SET SCHEMA interno;
ALTER FUNCTION public.matricular_por_convite(text, public.tipo_matricula, text) SET SCHEMA interno;
ALTER FUNCTION public.registrar_presenca(uuid, text, uuid, public.metodo_presenca, text) SET SCHEMA interno;

-- 3. Re-point bodies to the new schema
CREATE OR REPLACE FUNCTION interno.tem_papel(_user_id uuid, _papel public.papel_app)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public', 'interno' AS $$
  SELECT EXISTS (SELECT 1 FROM public.papeis_usuario WHERE user_id = _user_id AND papel = _papel);
$$;

CREATE OR REPLACE FUNCTION interno.e_coordenador()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public', 'interno' AS $$
  SELECT interno.tem_papel(auth.uid(), 'coordenador');
$$;

CREATE OR REPLACE FUNCTION interno.e_professor_da_sala(_sala_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public', 'interno' AS $$
  SELECT EXISTS (SELECT 1 FROM public.salas s WHERE s.id = _sala_id AND s.professor_id = auth.uid())
      OR EXISTS (SELECT 1 FROM public.sala_professores sp WHERE sp.sala_id = _sala_id AND sp.professor_id = auth.uid());
$$;

CREATE OR REPLACE FUNCTION interno.esta_matriculado(_sala_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public', 'interno' AS $$
  SELECT EXISTS (SELECT 1 FROM public.matriculas m WHERE m.sala_id = _sala_id AND m.aluno_id = auth.uid());
$$;

CREATE OR REPLACE FUNCTION interno.aluno_visivel(_aluno_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public', 'interno' AS $$
  SELECT _aluno_id = auth.uid()
      OR interno.e_coordenador()
      OR EXISTS (
        SELECT 1 FROM public.matriculas m
        JOIN public.salas s ON s.id = m.sala_id
        WHERE m.aluno_id = _aluno_id AND s.professor_id = auth.uid()
      );
$$;

CREATE OR REPLACE FUNCTION interno.sala_da_aula(_aula_id uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public', 'interno' AS $$
  SELECT m.sala_id FROM public.aulas a JOIN public.modulos m ON m.id = a.modulo_id WHERE a.id = _aula_id;
$$;

CREATE OR REPLACE FUNCTION interno.sala_do_modulo(_modulo_id uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public', 'interno' AS $$
  SELECT sala_id FROM public.modulos WHERE id = _modulo_id;
$$;

CREATE OR REPLACE FUNCTION interno.sala_gerenciavel(_sala_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public', 'interno' AS $$
  SELECT interno.e_coordenador() OR interno.e_professor_da_sala(_sala_id);
$$;

CREATE OR REPLACE FUNCTION interno.sala_visivel(_sala_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public', 'interno' AS $$
  SELECT interno.e_coordenador() OR interno.e_professor_da_sala(_sala_id) OR interno.esta_matriculado(_sala_id);
$$;

CREATE OR REPLACE FUNCTION interno.pode(_user_id uuid, _chave text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public', 'interno' AS $$
  SELECT COALESCE(
    (SELECT permitido FROM public.permissoes_usuario WHERE user_id = _user_id AND chave = _chave),
    (SELECT pp.permitido FROM public.permissoes_papel pp
      JOIN public.papeis_usuario pu ON pu.papel = pp.papel
      WHERE pu.user_id = _user_id AND pp.chave = _chave
      ORDER BY pp.permitido DESC LIMIT 1),
    false
  );
$$;

CREATE OR REPLACE FUNCTION interno.registrar_presenca(_aula_id uuid, _codigo_aluno text DEFAULT NULL::text, _aluno_id uuid DEFAULT NULL::uuid, _metodo public.metodo_presenca DEFAULT 'manual'::public.metodo_presenca, _sessao_codigo text DEFAULT NULL::text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'interno' AS $$
DECLARE
  v_aluno uuid; v_nome text; v_modulo uuid; v_modulo_nome text; v_sala uuid;
  v_sessao uuid; v_gerente boolean;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'É preciso estar autenticado'; END IF;

  SELECT m.id, m.nome, m.sala_id INTO v_modulo, v_modulo_nome, v_sala
  FROM public.aulas a JOIN public.modulos m ON m.id = a.modulo_id WHERE a.id = _aula_id;
  IF v_modulo IS NULL THEN RETURN jsonb_build_object('ok', false, 'mensagem', 'Aula não encontrada'); END IF;

  v_gerente := interno.sala_gerenciavel(v_sala);

  IF _aluno_id IS NOT NULL THEN
    v_aluno := _aluno_id;
  ELSIF _codigo_aluno IS NOT NULL THEN
    SELECT id INTO v_aluno FROM public.perfis WHERE upper(codigo) = upper(trim(_codigo_aluno));
    IF v_aluno IS NULL THEN
      RETURN jsonb_build_object('ok', false, 'mensagem', 'Código não encontrado: ' || _codigo_aluno);
    END IF;
  ELSE
    v_aluno := auth.uid();
  END IF;

  IF NOT v_gerente THEN
    IF v_aluno <> auth.uid() THEN
      RETURN jsonb_build_object('ok', false, 'mensagem', 'Você só pode registrar a própria presença');
    END IF;
    IF _sessao_codigo IS NULL THEN
      RETURN jsonb_build_object('ok', false, 'mensagem', 'Sessão de chamada não informada');
    END IF;
    SELECT id INTO v_sessao FROM public.sessoes_chamada
    WHERE upper(codigo) = upper(_sessao_codigo) AND aula_id = _aula_id AND aberta AND expira_em > now();
    IF v_sessao IS NULL THEN
      RETURN jsonb_build_object('ok', false, 'mensagem', 'Sessão expirada ou inválida');
    END IF;
  ELSIF _sessao_codigo IS NOT NULL THEN
    SELECT id INTO v_sessao FROM public.sessoes_chamada WHERE upper(codigo) = upper(_sessao_codigo);
  END IF;

  SELECT nome INTO v_nome FROM public.perfis WHERE id = v_aluno;
  IF v_nome IS NULL THEN RETURN jsonb_build_object('ok', false, 'mensagem', 'Aluno não encontrado'); END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.matricula_modulos mm
    JOIN public.matriculas mt ON mt.id = mm.matricula_id
    WHERE mm.modulo_id = v_modulo AND mt.aluno_id = v_aluno AND mt.status = 'ativa'
  ) THEN
    RETURN jsonb_build_object('ok', false, 'aluno', v_nome, 'modulo', v_modulo_nome,
      'mensagem', v_nome || ' não está inscrito no módulo ' || v_modulo_nome);
  END IF;

  IF EXISTS (SELECT 1 FROM public.presencas WHERE aula_id = _aula_id AND aluno_id = v_aluno) THEN
    RETURN jsonb_build_object('ok', true, 'duplicada', true, 'aluno', v_nome,
      'mensagem', v_nome || ' já teve presença registrada');
  END IF;

  INSERT INTO public.presencas (aula_id, aluno_id, sessao_id, metodo, registrado_por)
  VALUES (_aula_id, v_aluno, v_sessao, _metodo, auth.uid());

  RETURN jsonb_build_object('ok', true, 'aluno', v_nome, 'mensagem', 'Presença de ' || v_nome || ' registrada');
END; $$;

-- 4. Trigger function that referenced public.pode
CREATE OR REPLACE FUNCTION public.checar_definir_professor()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'interno' AS $$
BEGIN
  IF NEW.professor_id IS DISTINCT FROM OLD.professor_id
     AND NOT interno.pode(auth.uid(), 'turma_definir_professor') THEN
    RAISE EXCEPTION 'Sem permissão para definir o professor da turma';
  END IF;
  RETURN NEW;
END;
$$;

-- 5. Lock down execution on the private helpers
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA interno FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION
  interno.tem_papel(uuid, public.papel_app),
  interno.e_coordenador(),
  interno.e_professor_da_sala(uuid),
  interno.esta_matriculado(uuid),
  interno.aluno_visivel(uuid),
  interno.sala_da_aula(uuid),
  interno.sala_do_modulo(uuid),
  interno.sala_gerenciavel(uuid),
  interno.sala_visivel(uuid),
  interno.pode(uuid, text),
  interno.matricular_por_convite(text, public.tipo_matricula, text),
  interno.registrar_presenca(uuid, text, uuid, public.metodo_presenca, text),
  interno.sala_por_convite(text)
TO authenticated;
GRANT EXECUTE ON FUNCTION interno.sala_por_convite(text) TO anon;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA interno TO service_role;

-- 6. Thin, non-privileged public entry points used by the app
CREATE OR REPLACE FUNCTION public.tem_papel(_user_id uuid, _papel public.papel_app)
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path TO 'public', 'interno' AS $$
  SELECT interno.tem_papel(_user_id, _papel);
$$;

CREATE OR REPLACE FUNCTION public.pode(_user_id uuid, _chave text)
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path TO 'public', 'interno' AS $$
  SELECT interno.pode(_user_id, _chave);
$$;

CREATE OR REPLACE FUNCTION public.sala_gerenciavel(_sala_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path TO 'public', 'interno' AS $$
  SELECT interno.sala_gerenciavel(_sala_id);
$$;

CREATE OR REPLACE FUNCTION public.sala_por_convite(_convite text)
RETURNS TABLE(sala_nome text, curso_nome text, turno text)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path TO 'public', 'interno' AS $$
  SELECT * FROM interno.sala_por_convite(_convite);
$$;

CREATE OR REPLACE FUNCTION public.matricular_por_convite(_convite text, _tipo public.tipo_matricula DEFAULT 'individual'::public.tipo_matricula, _nome_casal text DEFAULT NULL::text)
RETURNS uuid LANGUAGE sql SECURITY INVOKER SET search_path TO 'public', 'interno' AS $$
  SELECT interno.matricular_por_convite(_convite, _tipo, _nome_casal);
$$;

CREATE OR REPLACE FUNCTION public.registrar_presenca(_aula_id uuid, _codigo_aluno text DEFAULT NULL::text, _aluno_id uuid DEFAULT NULL::uuid, _metodo public.metodo_presenca DEFAULT 'manual'::public.metodo_presenca, _sessao_codigo text DEFAULT NULL::text)
RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path TO 'public', 'interno' AS $$
  SELECT interno.registrar_presenca(_aula_id, _codigo_aluno, _aluno_id, _metodo, _sessao_codigo);
$$;

REVOKE ALL ON FUNCTION public.tem_papel(uuid, public.papel_app) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.pode(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.sala_gerenciavel(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.matricular_por_convite(text, public.tipo_matricula, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.registrar_presenca(uuid, text, uuid, public.metodo_presenca, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.sala_por_convite(text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION
  public.tem_papel(uuid, public.papel_app),
  public.pode(uuid, text),
  public.sala_gerenciavel(uuid),
  public.matricular_por_convite(text, public.tipo_matricula, text),
  public.registrar_presenca(uuid, text, uuid, public.metodo_presenca, text),
  public.sala_por_convite(text)
TO authenticated;
GRANT EXECUTE ON FUNCTION public.sala_por_convite(text) TO anon;