import { QRCodeSVG } from "qrcode.react";

export function QRCodeBox({
  valor,
  tamanho = 160,
  cor = "#0A2A66",
}: {
  valor: string;
  tamanho?: number;
  cor?: string;
}) {
  return (
    <div className="inline-flex rounded-xl bg-white p-2.5 shadow-diario">
      <QRCodeSVG value={valor} size={tamanho} fgColor={cor} bgColor="#FFFFFF" level="M" />
    </div>
  );
}
