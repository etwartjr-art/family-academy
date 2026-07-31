import logoAsset from "@/assets/logo-escola-financas-academy.jpg.asset.json";

/**
 * Imagem de fundo da Escola de Finanças Academy usada no sistema
 * e na tela inicial. Puramente decorativa.
 */
export function FundoMarca({ tom = "claro" }: { tom?: "claro" | "escuro" }) {
  const escuro = tom === "escuro";
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-0 select-none overflow-hidden"
    >
      <div
        className="absolute -inset-[10%]"
        style={{
          backgroundImage: `url(${logoAsset.url})`,
          backgroundRepeat: "no-repeat",
          backgroundPosition: "center",
          backgroundSize: "cover",
          filter: escuro
            ? "blur(48px) brightness(0.55) saturate(1.1)"
            : "blur(48px) brightness(1.05) saturate(1.05)",
          opacity: escuro ? 0.22 : 0.12,

        }}
      />
    </div>
  );
}


