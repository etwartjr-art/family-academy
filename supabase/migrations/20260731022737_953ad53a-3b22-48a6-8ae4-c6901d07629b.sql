-- ENUMS
CREATE TYPE public.papel_app AS ENUM ('coordenador','professor','aluno');
CREATE TYPE public.metodo_presenca AS ENUM ('qr','codigo','manual');
CREATE TYPE public.status_matricula AS ENUM ('ativa','pendente','cancelada');

-- GERADORES
CREATE OR REPLACE FUNCTION public.gerar_codigo(_tamanho int)
RETURNS text LANGUAGE plpgsql SET search_path = public AS $$
DECLARE alfa text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; r text := ''; i int;
BEGIN
  FOR i IN 1.._tamanho LOOP
    r := r || substr(alfa, 1 + floor(random()*length(alfa))::int, 1);
  END LOOP;
  RETURN r;
END; $$;

-- TABELAS
CREATE TABLE public.perfis (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nome text NOT NULL,
  codigo text UNIQUE NOT NULL DEFAULT public.gerar_codigo(6),
  email text,
  telefone text,
  criado_em timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.papeis_usuario (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  papel public.papel_app NOT NULL,
  UNIQUE (user_id, papel)
);

CREATE TABLE public.cursos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  descricao text,
  ordem int NOT NULL DEFAULT 0,
  criado_em timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.curso_modulos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  curso_id uuid NOT NULL REFERENCES public.cursos(id) ON DELETE CASCADE,
  nome text NOT NULL,
  ordem int NOT NULL DEFAULT 0
);

CREATE TABLE public.salas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  curso_id uuid NOT NULL REFERENCES public.cursos(id) ON DELETE CASCADE,
  nome text NOT NULL,
  professor_id uuid REFERENCES public.perfis(id) ON DELETE SET NULL,
  turno text,
  convite text UNIQUE NOT NULL DEFAULT ('SALA-' || public.gerar_codigo(6)),
  data_inicio date NOT NULL DEFAULT current_date,
  criado_em timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.modulos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sala_id uuid NOT NULL REFERENCES public.salas(id) ON DELETE CASCADE,
  curso_modulo_id uuid REFERENCES public.curso_modulos(id) ON DELETE SET NULL,
  nome text NOT NULL,
  ordem int NOT NULL DEFAULT 0,
  data_inicio date NOT NULL DEFAULT current_date
);

CREATE TABLE public.aulas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  modulo_id uuid NOT NULL REFERENCES public.modulos(id) ON DELETE CASCADE,
  numero int NOT NULL CHECK (numero BETWEEN 1 AND 5),
  titulo text NOT NULL,
  data date,
  UNIQUE (modulo_id, numero)
);

CREATE TABLE public.matriculas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  aluno_id uuid NOT NULL REFERENCES public.perfis(id) ON DELETE CASCADE,
  sala_id uuid NOT NULL REFERENCES public.salas(id) ON DELETE CASCADE,
  status public.status_matricula NOT NULL DEFAULT 'ativa',
  criado_em timestamptz NOT NULL DEFAULT now(),
  UNIQUE (aluno_id, sala_id)
);

CREATE TABLE public.matricula_modulos (
  matricula_id uuid NOT NULL REFERENCES public.matriculas(id) ON DELETE CASCADE,
  modulo_id uuid NOT NULL REFERENCES public.modulos(id) ON DELETE CASCADE,
  PRIMARY KEY (matricula_id, modulo_id)
);

CREATE TABLE public.sessoes_chamada (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  aula_id uuid NOT NULL REFERENCES public.aulas(id) ON DELETE CASCADE,
  codigo text UNIQUE NOT NULL DEFAULT public.gerar_codigo(8),
  aberta_em timestamptz NOT NULL DEFAULT now(),
  expira_em timestamptz NOT NULL DEFAULT (now() + interval '15 minutes'),
  aberta boolean NOT NULL DEFAULT true,
  criada_por uuid REFERENCES public.perfis(id) ON DELETE SET NULL
);

CREATE TABLE public.presencas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  aula_id uuid NOT NULL REFERENCES public.aulas(id) ON DELETE CASCADE,
  aluno_id uuid NOT NULL REFERENCES public.perfis(id) ON DELETE CASCADE,
  sessao_id uuid REFERENCES public.sessoes_chamada(id) ON DELETE SET NULL,
  metodo public.metodo_presenca NOT NULL DEFAULT 'manual',
  registrado_por uuid REFERENCES public.perfis(id) ON DELETE SET NULL,
  criado_em timestamptz NOT NULL DEFAULT now(),
  UNIQUE (aula_id, aluno_id)
);

-- GRANTS
GRANT SELECT, INSERT, UPDATE, DELETE ON public.perfis TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.papeis_usuario TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cursos TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.curso_modulos TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.salas TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.modulos TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.aulas TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.matriculas TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.matricula_modulos TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sessoes_chamada TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.presencas TO authenticated;
GRANT ALL ON public.perfis, public.papeis_usuario, public.cursos, public.curso_modulos,
  public.salas, public.modulos, public.aulas, public.matriculas, public.matricula_modulos,
  public.sessoes_chamada, public.presencas TO service_role;

-- HELPERS (SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.tem_papel(_user_id uuid, _papel public.papel_app)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.papeis_usuario WHERE user_id = _user_id AND papel = _papel);
$$;

CREATE OR REPLACE FUNCTION public.e_coordenador()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.tem_papel(auth.uid(), 'coordenador');
$$;

CREATE OR REPLACE FUNCTION public.e_professor_da_sala(_sala_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.salas s WHERE s.id = _sala_id AND s.professor_id = auth.uid());
$$;

CREATE OR REPLACE FUNCTION public.esta_matriculado(_sala_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.matriculas m WHERE m.sala_id = _sala_id AND m.aluno_id = auth.uid());
$$;

CREATE OR REPLACE FUNCTION public.sala_visivel(_sala_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.e_coordenador() OR public.e_professor_da_sala(_sala_id) OR public.esta_matriculado(_sala_id);
$$;

CREATE OR REPLACE FUNCTION public.sala_gerenciavel(_sala_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.e_coordenador() OR public.e_professor_da_sala(_sala_id);
$$;

CREATE OR REPLACE FUNCTION public.sala_da_aula(_aula_id uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT m.sala_id FROM public.aulas a JOIN public.modulos m ON m.id = a.modulo_id WHERE a.id = _aula_id;
$$;

CREATE OR REPLACE FUNCTION public.sala_do_modulo(_modulo_id uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT sala_id FROM public.modulos WHERE id = _modulo_id;
$$;

CREATE OR REPLACE FUNCTION public.aluno_visivel(_aluno_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT _aluno_id = auth.uid()
      OR public.e_coordenador()
      OR EXISTS (
        SELECT 1 FROM public.matriculas m
        JOIN public.salas s ON s.id = m.sala_id
        WHERE m.aluno_id = _aluno_id AND s.professor_id = auth.uid()
      );
$$;

-- RLS
ALTER TABLE public.perfis ENABLE ROW LEVEL SECURITY;
CREATE POLICY perfis_select ON public.perfis FOR SELECT TO authenticated USING (public.aluno_visivel(id) OR public.e_coordenador() OR id = auth.uid());
CREATE POLICY perfis_insert_own ON public.perfis FOR INSERT TO authenticated WITH CHECK (id = auth.uid() OR public.e_coordenador());
CREATE POLICY perfis_update ON public.perfis FOR UPDATE TO authenticated USING (id = auth.uid() OR public.e_coordenador()) WITH CHECK (id = auth.uid() OR public.e_coordenador());
CREATE POLICY perfis_delete ON public.perfis FOR DELETE TO authenticated USING (public.e_coordenador());

ALTER TABLE public.papeis_usuario ENABLE ROW LEVEL SECURITY;
CREATE POLICY papeis_select ON public.papeis_usuario FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.e_coordenador());
CREATE POLICY papeis_insert ON public.papeis_usuario FOR INSERT TO authenticated WITH CHECK (public.e_coordenador());
CREATE POLICY papeis_delete ON public.papeis_usuario FOR DELETE TO authenticated USING (public.e_coordenador());

ALTER TABLE public.cursos ENABLE ROW LEVEL SECURITY;
CREATE POLICY cursos_select ON public.cursos FOR SELECT TO authenticated USING (true);
CREATE POLICY cursos_write ON public.cursos FOR ALL TO authenticated USING (public.e_coordenador()) WITH CHECK (public.e_coordenador());

ALTER TABLE public.curso_modulos ENABLE ROW LEVEL SECURITY;
CREATE POLICY curso_modulos_select ON public.curso_modulos FOR SELECT TO authenticated USING (true);
CREATE POLICY curso_modulos_write ON public.curso_modulos FOR ALL TO authenticated USING (public.e_coordenador()) WITH CHECK (public.e_coordenador());

ALTER TABLE public.salas ENABLE ROW LEVEL SECURITY;
CREATE POLICY salas_select ON public.salas FOR SELECT TO authenticated USING (public.sala_visivel(id));
CREATE POLICY salas_insert ON public.salas FOR INSERT TO authenticated WITH CHECK (public.e_coordenador());
CREATE POLICY salas_update ON public.salas FOR UPDATE TO authenticated USING (public.sala_gerenciavel(id)) WITH CHECK (public.sala_gerenciavel(id));
CREATE POLICY salas_delete ON public.salas FOR DELETE TO authenticated USING (public.e_coordenador());

ALTER TABLE public.modulos ENABLE ROW LEVEL SECURITY;
CREATE POLICY modulos_select ON public.modulos FOR SELECT TO authenticated USING (public.sala_visivel(sala_id));
CREATE POLICY modulos_write ON public.modulos FOR ALL TO authenticated USING (public.sala_gerenciavel(sala_id)) WITH CHECK (public.sala_gerenciavel(sala_id));

ALTER TABLE public.aulas ENABLE ROW LEVEL SECURITY;
CREATE POLICY aulas_select ON public.aulas FOR SELECT TO authenticated USING (public.sala_visivel(public.sala_do_modulo(modulo_id)));
CREATE POLICY aulas_write ON public.aulas FOR ALL TO authenticated USING (public.sala_gerenciavel(public.sala_do_modulo(modulo_id))) WITH CHECK (public.sala_gerenciavel(public.sala_do_modulo(modulo_id)));

ALTER TABLE public.matriculas ENABLE ROW LEVEL SECURITY;
CREATE POLICY matriculas_select ON public.matriculas FOR SELECT TO authenticated USING (aluno_id = auth.uid() OR public.sala_gerenciavel(sala_id));
CREATE POLICY matriculas_write ON public.matriculas FOR ALL TO authenticated USING (public.sala_gerenciavel(sala_id)) WITH CHECK (public.sala_gerenciavel(sala_id));

ALTER TABLE public.matricula_modulos ENABLE ROW LEVEL SECURITY;
CREATE POLICY matricula_modulos_select ON public.matricula_modulos FOR SELECT TO authenticated USING (public.sala_visivel(public.sala_do_modulo(modulo_id)));
CREATE POLICY matricula_modulos_write ON public.matricula_modulos FOR ALL TO authenticated USING (public.sala_gerenciavel(public.sala_do_modulo(modulo_id))) WITH CHECK (public.sala_gerenciavel(public.sala_do_modulo(modulo_id)));

ALTER TABLE public.sessoes_chamada ENABLE ROW LEVEL SECURITY;
CREATE POLICY sessoes_select ON public.sessoes_chamada FOR SELECT TO authenticated USING (true);
CREATE POLICY sessoes_write ON public.sessoes_chamada FOR ALL TO authenticated USING (public.sala_gerenciavel(public.sala_da_aula(aula_id))) WITH CHECK (public.sala_gerenciavel(public.sala_da_aula(aula_id)));

ALTER TABLE public.presencas ENABLE ROW LEVEL SECURITY;
CREATE POLICY presencas_select ON public.presencas FOR SELECT TO authenticated USING (aluno_id = auth.uid() OR public.sala_gerenciavel(public.sala_da_aula(aula_id)));
CREATE POLICY presencas_write ON public.presencas FOR ALL TO authenticated USING (public.sala_gerenciavel(public.sala_da_aula(aula_id))) WITH CHECK (public.sala_gerenciavel(public.sala_da_aula(aula_id)));

-- AUTOMAÇÕES
CREATE OR REPLACE FUNCTION public.criar_aulas_do_modulo()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE i int;
BEGIN
  FOR i IN 1..5 LOOP
    INSERT INTO public.aulas (modulo_id, numero, titulo, data)
    VALUES (NEW.id, i, 'Aula ' || i, NEW.data_inicio + ((i-1) * 7));
  END LOOP;
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_criar_aulas AFTER INSERT ON public.modulos FOR EACH ROW EXECUTE FUNCTION public.criar_aulas_do_modulo();

CREATE OR REPLACE FUNCTION public.aplicar_ementa_na_sala()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE cm record; idx int := 0;
BEGIN
  FOR cm IN SELECT * FROM public.curso_modulos WHERE curso_id = NEW.curso_id ORDER BY ordem, nome LOOP
    INSERT INTO public.modulos (sala_id, curso_modulo_id, nome, ordem, data_inicio)
    VALUES (NEW.id, cm.id, cm.nome, cm.ordem, NEW.data_inicio + (idx * 35));
    idx := idx + 1;
  END LOOP;
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_aplicar_ementa AFTER INSERT ON public.salas FOR EACH ROW EXECUTE FUNCTION public.aplicar_ementa_na_sala();

CREATE OR REPLACE FUNCTION public.inscrever_em_modulos()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.matricula_modulos (matricula_id, modulo_id)
  SELECT NEW.id, m.id FROM public.modulos m WHERE m.sala_id = NEW.sala_id
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_inscrever_modulos AFTER INSERT ON public.matriculas FOR EACH ROW EXECUTE FUNCTION public.inscrever_em_modulos();

-- perfil automático no cadastro
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.perfis (id, nome, email, telefone)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nome', split_part(NEW.email, '@', 1)),
    NEW.email,
    NEW.raw_user_meta_data->>'telefone'
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.papeis_usuario (user_id, papel)
  VALUES (NEW.id, COALESCE((NEW.raw_user_meta_data->>'papel')::public.papel_app, 'aluno'))
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END; $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- MATRÍCULA POR CONVITE (aluno logado)
CREATE OR REPLACE FUNCTION public.matricular_por_convite(_convite text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_sala uuid; v_matricula uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'É preciso estar autenticado'; END IF;
  SELECT id INTO v_sala FROM public.salas WHERE upper(convite) = upper(_convite);
  IF v_sala IS NULL THEN RAISE EXCEPTION 'Código de convite inválido'; END IF;

  SELECT id INTO v_matricula FROM public.matriculas WHERE sala_id = v_sala AND aluno_id = auth.uid();
  IF v_matricula IS NOT NULL THEN RETURN v_matricula; END IF;

  INSERT INTO public.matriculas (aluno_id, sala_id, status) VALUES (auth.uid(), v_sala, 'ativa')
  RETURNING id INTO v_matricula;
  RETURN v_matricula;
END; $$;

-- SALA PÚBLICA POR CONVITE (dados mínimos para a tela de matrícula)
CREATE OR REPLACE FUNCTION public.sala_por_convite(_convite text)
RETURNS TABLE (sala_nome text, curso_nome text, turno text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT s.nome, c.nome, s.turno
  FROM public.salas s JOIN public.cursos c ON c.id = s.curso_id
  WHERE upper(s.convite) = upper(_convite);
$$;
GRANT EXECUTE ON FUNCTION public.sala_por_convite(text) TO anon, authenticated;

-- REGISTRO DE PRESENÇA VALIDADO
CREATE OR REPLACE FUNCTION public.registrar_presenca(
  _aula_id uuid, _codigo_aluno text DEFAULT NULL, _aluno_id uuid DEFAULT NULL,
  _metodo public.metodo_presenca DEFAULT 'manual', _sessao_codigo text DEFAULT NULL
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_aluno uuid; v_nome text; v_modulo uuid; v_modulo_nome text; v_sala uuid;
  v_sessao uuid; v_gerente boolean;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'É preciso estar autenticado'; END IF;

  SELECT m.id, m.nome, m.sala_id INTO v_modulo, v_modulo_nome, v_sala
  FROM public.aulas a JOIN public.modulos m ON m.id = a.modulo_id WHERE a.id = _aula_id;
  IF v_modulo IS NULL THEN RETURN jsonb_build_object('ok', false, 'mensagem', 'Aula não encontrada'); END IF;

  v_gerente := public.sala_gerenciavel(v_sala);

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

  -- quem não gerencia a sala só pode marcar a própria presença, e só por sessão válida
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

-- SEED: curso inicial
INSERT INTO public.cursos (id, nome, descricao, ordem)
VALUES ('11111111-1111-4111-8111-111111111111', 'Escola de Finanças', 'Curso inicial da Family Academy', 1);

INSERT INTO public.curso_modulos (curso_id, nome, ordem) VALUES
  ('11111111-1111-4111-8111-111111111111', 'Finanças Pessoais', 1),
  ('11111111-1111-4111-8111-111111111111', 'Finanças Empresariais: começando um novo negócio', 2),
  ('11111111-1111-4111-8111-111111111111', 'Finanças para Investimento', 3);