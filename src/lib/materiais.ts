import { supabase } from "@/integrations/supabase/client";

export const BUCKET_MATERIAIS = "materiais";

export type TipoMaterial = "ebook" | "apostila" | "planilha" | "slides" | "video" | "link";

export const TIPOS_MATERIAL: { valor: TipoMaterial; rotulo: string }[] = [
  { valor: "ebook", rotulo: "E-book" },
  { valor: "apostila", rotulo: "Apostila" },
  { valor: "planilha", rotulo: "Planilha" },
  { valor: "slides", rotulo: "Slides" },
  { valor: "video", rotulo: "Vídeo" },
  { valor: "link", rotulo: "Link" },
];

export function rotuloTipo(tipo: TipoMaterial) {
  return TIPOS_MATERIAL.find((t) => t.valor === tipo)?.rotulo ?? tipo;
}

export type Material = {
  id: string;
  aula_id: string;
  titulo: string;
  tipo: TipoMaterial;
  url: string | null;
  storage_path: string | null;
  nome_arquivo: string | null;
  tamanho: number | null;
  publicado_por: string | null;
  criado_em: string;
};

/** Materiais visíveis ao usuário (RLS decide o alcance). */
export async function listarMateriais(aulaIds?: string[]) {
  let q = supabase.from("materiais").select("*").order("criado_em", { ascending: false });
  if (aulaIds) {
    if (aulaIds.length === 0) return [];
    q = q.in("aula_id", aulaIds);
  }
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as Material[];
}

export function formatarTamanho(bytes?: number | null) {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function caminhoSeguro(aulaId: string, nome: string) {
  const limpo = nome
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9.\-_]+/g, "-")
    .toLowerCase();
  return `${aulaId}/${Date.now()}-${limpo}`;
}

export async function publicarMaterial(entrada: {
  aulaId: string;
  titulo: string;
  tipo: TipoMaterial;
  url?: string;
  arquivo?: File | null;
}) {
  const { data: auth } = await supabase.auth.getUser();
  const publicadoPor = auth.user?.id ?? null;

  let storage_path: string | null = null;
  let nome_arquivo: string | null = null;
  let tamanho: number | null = null;

  if (entrada.arquivo) {
    const caminho = caminhoSeguro(entrada.aulaId, entrada.arquivo.name);
    const { error } = await supabase.storage
      .from(BUCKET_MATERIAIS)
      .upload(caminho, entrada.arquivo, { upsert: false });
    if (error) throw error;
    storage_path = caminho;
    nome_arquivo = entrada.arquivo.name;
    tamanho = entrada.arquivo.size;
  }

  const { error } = await supabase.from("materiais").insert({
    aula_id: entrada.aulaId,
    titulo: entrada.titulo,
    tipo: entrada.tipo,
    url: entrada.url?.trim() ? entrada.url.trim() : null,
    storage_path,
    nome_arquivo,
    tamanho,
    publicado_por: publicadoPor,
  });
  if (error) throw error;
}

export async function excluirMaterial(material: Material) {
  const { error } = await supabase.from("materiais").delete().eq("id", material.id);
  if (error) throw error;
  if (material.storage_path) {
    await supabase.storage.from(BUCKET_MATERIAIS).remove([material.storage_path]);
  }
}

/** Abre o material: link externo direto ou URL assinada de curta duração (5 min). */
export async function abrirMaterial(material: Material, modo: "baixar" | "visualizar" = "baixar") {
  if (material.storage_path) {
    const { data, error } = await supabase.storage
      .from(BUCKET_MATERIAIS)
      .createSignedUrl(
        material.storage_path,
        300,
        modo === "baixar" ? { download: material.nome_arquivo ?? true } : {},
      );
    if (error) throw error;
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
    return;
  }
  if (material.url) window.open(material.url, "_blank", "noopener,noreferrer");
}
