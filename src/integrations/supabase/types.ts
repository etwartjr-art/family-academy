export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      aulas: {
        Row: {
          data: string | null
          id: string
          modulo_id: string
          numero: number
          professor_id: string | null
          titulo: string
        }
        Insert: {
          data?: string | null
          id?: string
          modulo_id: string
          numero: number
          professor_id?: string | null
          titulo: string
        }
        Update: {
          data?: string | null
          id?: string
          modulo_id?: string
          numero?: number
          professor_id?: string | null
          titulo?: string
        }
        Relationships: [
          {
            foreignKeyName: "aulas_modulo_id_fkey"
            columns: ["modulo_id"]
            isOneToOne: false
            referencedRelation: "modulos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aulas_professor_id_fkey"
            columns: ["professor_id"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
        ]
      }
      curso_modulos: {
        Row: {
          curso_id: string
          id: string
          nome: string
          ordem: number
        }
        Insert: {
          curso_id: string
          id?: string
          nome: string
          ordem?: number
        }
        Update: {
          curso_id?: string
          id?: string
          nome?: string
          ordem?: number
        }
        Relationships: [
          {
            foreignKeyName: "curso_modulos_curso_id_fkey"
            columns: ["curso_id"]
            isOneToOne: false
            referencedRelation: "cursos"
            referencedColumns: ["id"]
          },
        ]
      }
      cursos: {
        Row: {
          criado_em: string
          descricao: string | null
          id: string
          nome: string
          ordem: number
        }
        Insert: {
          criado_em?: string
          descricao?: string | null
          id?: string
          nome: string
          ordem?: number
        }
        Update: {
          criado_em?: string
          descricao?: string | null
          id?: string
          nome?: string
          ordem?: number
        }
        Relationships: []
      }
      matricula_modulos: {
        Row: {
          matricula_id: string
          modulo_id: string
        }
        Insert: {
          matricula_id: string
          modulo_id: string
        }
        Update: {
          matricula_id?: string
          modulo_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "matricula_modulos_matricula_id_fkey"
            columns: ["matricula_id"]
            isOneToOne: false
            referencedRelation: "matriculas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matricula_modulos_modulo_id_fkey"
            columns: ["modulo_id"]
            isOneToOne: false
            referencedRelation: "modulos"
            referencedColumns: ["id"]
          },
        ]
      }
      matriculas: {
        Row: {
          aluno_id: string
          criado_em: string
          id: string
          nome_casal: string | null
          sala_id: string
          status: Database["public"]["Enums"]["status_matricula"]
          tipo: Database["public"]["Enums"]["tipo_matricula"]
        }
        Insert: {
          aluno_id: string
          criado_em?: string
          id?: string
          nome_casal?: string | null
          sala_id: string
          status?: Database["public"]["Enums"]["status_matricula"]
          tipo?: Database["public"]["Enums"]["tipo_matricula"]
        }
        Update: {
          aluno_id?: string
          criado_em?: string
          id?: string
          nome_casal?: string | null
          sala_id?: string
          status?: Database["public"]["Enums"]["status_matricula"]
          tipo?: Database["public"]["Enums"]["tipo_matricula"]
        }
        Relationships: [
          {
            foreignKeyName: "matriculas_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matriculas_sala_id_fkey"
            columns: ["sala_id"]
            isOneToOne: false
            referencedRelation: "salas"
            referencedColumns: ["id"]
          },
        ]
      }
      modulos: {
        Row: {
          curso_modulo_id: string | null
          data_inicio: string
          id: string
          nome: string
          ordem: number
          sala_id: string
        }
        Insert: {
          curso_modulo_id?: string | null
          data_inicio?: string
          id?: string
          nome: string
          ordem?: number
          sala_id: string
        }
        Update: {
          curso_modulo_id?: string | null
          data_inicio?: string
          id?: string
          nome?: string
          ordem?: number
          sala_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "modulos_curso_modulo_id_fkey"
            columns: ["curso_modulo_id"]
            isOneToOne: false
            referencedRelation: "curso_modulos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "modulos_sala_id_fkey"
            columns: ["sala_id"]
            isOneToOne: false
            referencedRelation: "salas"
            referencedColumns: ["id"]
          },
        ]
      }
      papeis_usuario: {
        Row: {
          id: string
          papel: Database["public"]["Enums"]["papel_app"]
          user_id: string
        }
        Insert: {
          id?: string
          papel: Database["public"]["Enums"]["papel_app"]
          user_id: string
        }
        Update: {
          id?: string
          papel?: Database["public"]["Enums"]["papel_app"]
          user_id?: string
        }
        Relationships: []
      }
      perfis: {
        Row: {
          codigo: string
          criado_em: string
          email: string | null
          id: string
          nome: string
          telefone: string | null
        }
        Insert: {
          codigo?: string
          criado_em?: string
          email?: string | null
          id: string
          nome: string
          telefone?: string | null
        }
        Update: {
          codigo?: string
          criado_em?: string
          email?: string | null
          id?: string
          nome?: string
          telefone?: string | null
        }
        Relationships: []
      }
      permissoes_papel: {
        Row: {
          chave: string
          papel: Database["public"]["Enums"]["papel_app"]
          permitido: boolean
        }
        Insert: {
          chave: string
          papel: Database["public"]["Enums"]["papel_app"]
          permitido?: boolean
        }
        Update: {
          chave?: string
          papel?: Database["public"]["Enums"]["papel_app"]
          permitido?: boolean
        }
        Relationships: []
      }
      permissoes_usuario: {
        Row: {
          chave: string
          permitido: boolean
          user_id: string
        }
        Insert: {
          chave: string
          permitido: boolean
          user_id: string
        }
        Update: {
          chave?: string
          permitido?: boolean
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "permissoes_usuario_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
        ]
      }
      presencas: {
        Row: {
          aluno_id: string
          aula_id: string
          criado_em: string
          id: string
          metodo: Database["public"]["Enums"]["metodo_presenca"]
          registrado_por: string | null
          sessao_id: string | null
        }
        Insert: {
          aluno_id: string
          aula_id: string
          criado_em?: string
          id?: string
          metodo?: Database["public"]["Enums"]["metodo_presenca"]
          registrado_por?: string | null
          sessao_id?: string | null
        }
        Update: {
          aluno_id?: string
          aula_id?: string
          criado_em?: string
          id?: string
          metodo?: Database["public"]["Enums"]["metodo_presenca"]
          registrado_por?: string | null
          sessao_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "presencas_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "presencas_aula_id_fkey"
            columns: ["aula_id"]
            isOneToOne: false
            referencedRelation: "aulas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "presencas_registrado_por_fkey"
            columns: ["registrado_por"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "presencas_sessao_id_fkey"
            columns: ["sessao_id"]
            isOneToOne: false
            referencedRelation: "sessoes_chamada"
            referencedColumns: ["id"]
          },
        ]
      }
      sala_professores: {
        Row: {
          criado_em: string
          professor_id: string
          sala_id: string
        }
        Insert: {
          criado_em?: string
          professor_id: string
          sala_id: string
        }
        Update: {
          criado_em?: string
          professor_id?: string
          sala_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sala_professores_professor_id_fkey"
            columns: ["professor_id"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sala_professores_sala_id_fkey"
            columns: ["sala_id"]
            isOneToOne: false
            referencedRelation: "salas"
            referencedColumns: ["id"]
          },
        ]
      }
      salas: {
        Row: {
          convite: string
          criado_em: string
          curso_id: string
          data_inicio: string
          id: string
          modulo_ativo_id: string | null
          nome: string
          professor_id: string | null
          turno: string | null
        }
        Insert: {
          convite?: string
          criado_em?: string
          curso_id: string
          data_inicio?: string
          id?: string
          modulo_ativo_id?: string | null
          nome: string
          professor_id?: string | null
          turno?: string | null
        }
        Update: {
          convite?: string
          criado_em?: string
          curso_id?: string
          data_inicio?: string
          id?: string
          modulo_ativo_id?: string | null
          nome?: string
          professor_id?: string | null
          turno?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "salas_curso_id_fkey"
            columns: ["curso_id"]
            isOneToOne: false
            referencedRelation: "cursos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "salas_modulo_ativo_id_fkey"
            columns: ["modulo_ativo_id"]
            isOneToOne: false
            referencedRelation: "modulos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "salas_professor_id_fkey"
            columns: ["professor_id"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
        ]
      }
      salas_auditoria: {
        Row: {
          alterado_por: string | null
          campo: string
          criado_em: string
          id: string
          sala_id: string
          valor_antigo: string | null
          valor_novo: string | null
        }
        Insert: {
          alterado_por?: string | null
          campo: string
          criado_em?: string
          id?: string
          sala_id: string
          valor_antigo?: string | null
          valor_novo?: string | null
        }
        Update: {
          alterado_por?: string | null
          campo?: string
          criado_em?: string
          id?: string
          sala_id?: string
          valor_antigo?: string | null
          valor_novo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "salas_auditoria_alterado_por_fkey"
            columns: ["alterado_por"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "salas_auditoria_sala_id_fkey"
            columns: ["sala_id"]
            isOneToOne: false
            referencedRelation: "salas"
            referencedColumns: ["id"]
          },
        ]
      }
      sessoes_chamada: {
        Row: {
          aberta: boolean
          aberta_em: string
          aula_id: string
          codigo: string
          criada_por: string | null
          expira_em: string
          id: string
        }
        Insert: {
          aberta?: boolean
          aberta_em?: string
          aula_id: string
          codigo?: string
          criada_por?: string | null
          expira_em?: string
          id?: string
        }
        Update: {
          aberta?: boolean
          aberta_em?: string
          aula_id?: string
          codigo?: string
          criada_por?: string | null
          expira_em?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sessoes_chamada_aula_id_fkey"
            columns: ["aula_id"]
            isOneToOne: false
            referencedRelation: "aulas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessoes_chamada_criada_por_fkey"
            columns: ["criada_por"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      aluno_visivel: { Args: { _aluno_id: string }; Returns: boolean }
      e_coordenador: { Args: never; Returns: boolean }
      e_professor_da_sala: { Args: { _sala_id: string }; Returns: boolean }
      esta_matriculado: { Args: { _sala_id: string }; Returns: boolean }
      gerar_codigo: { Args: { _tamanho: number }; Returns: string }
      matricular_por_convite: {
        Args: {
          _convite: string
          _nome_casal?: string
          _tipo?: Database["public"]["Enums"]["tipo_matricula"]
        }
        Returns: string
      }
      pode: { Args: { _chave: string; _user_id: string }; Returns: boolean }
      registrar_presenca: {
        Args: {
          _aluno_id?: string
          _aula_id: string
          _codigo_aluno?: string
          _metodo?: Database["public"]["Enums"]["metodo_presenca"]
          _sessao_codigo?: string
        }
        Returns: Json
      }
      sala_da_aula: { Args: { _aula_id: string }; Returns: string }
      sala_do_modulo: { Args: { _modulo_id: string }; Returns: string }
      sala_gerenciavel: { Args: { _sala_id: string }; Returns: boolean }
      sala_por_convite: {
        Args: { _convite: string }
        Returns: {
          curso_nome: string
          sala_nome: string
          turno: string
        }[]
      }
      sala_visivel: { Args: { _sala_id: string }; Returns: boolean }
      tem_papel: {
        Args: {
          _papel: Database["public"]["Enums"]["papel_app"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      metodo_presenca: "qr" | "codigo" | "manual"
      papel_app: "coordenador" | "professor" | "aluno"
      status_matricula: "ativa" | "pendente" | "cancelada"
      tipo_matricula: "individual" | "casal"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      metodo_presenca: ["qr", "codigo", "manual"],
      papel_app: ["coordenador", "professor", "aluno"],
      status_matricula: ["ativa", "pendente", "cancelada"],
      tipo_matricula: ["individual", "casal"],
    },
  },
} as const
