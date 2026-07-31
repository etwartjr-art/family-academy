import logoAsset from "@/assets/logo-escola-financas-academy.jpg.asset.json";

/**
 * Marca d'água fixa da Escola de Finanças Academy usada como fundo do sistema
 * e da tela inicial. Puramente decorativa.
 */
export function FundoMarca({ tom = "claro" }: { tom?: "claro" | "escuro" }) {
  const escuro = tom === "escuro";
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-0 select-none"
      style={{
        backgroundImage: `url(${logoAsset.url})`,
        backgroundRepeat: "no-repeat",
        backgroundPosition: "center",
        backgroundSize: "min(70vw, 640px) auto",
        opacity: escuro ? 0.12 : 0.06,
      }}
    />
  );
}

