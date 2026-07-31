import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Camera, CameraOff } from "lucide-react";

/**
 * Leitor de QR pela câmera. A câmera pode falhar — por isso todas as telas que
 * usam este componente oferecem também código digitado e marcação manual.
 */
export function LeitorQR({ aoLer }: { aoLer: (texto: string) => void }) {
  const [ligado, setLigado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const scannerRef = useRef<{ stop: () => Promise<void>; clear: () => void } | null>(null);
  const idRef = useRef(`leitor-${Math.random().toString(36).slice(2, 8)}`);
  const callbackRef = useRef(aoLer);
  callbackRef.current = aoLer;

  useEffect(() => {
    let cancelado = false;

    async function iniciar() {
      try {
        const { Html5Qrcode } = await import("html5-qrcode");
        if (cancelado) return;
        const scanner = new Html5Qrcode(idRef.current, { verbose: false });
        scannerRef.current = scanner as unknown as typeof scannerRef.current;
        await scanner.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 220, height: 220 } },
          (texto) => callbackRef.current(texto),
          () => undefined,
        );
      } catch {
        if (!cancelado) {
          setErro("Não foi possível abrir a câmera. Use o código digitado ou a marcação manual.");
          setLigado(false);
        }
      }
    }

    if (ligado) iniciar();

    return () => {
      cancelado = true;
      const s = scannerRef.current;
      scannerRef.current = null;
      if (s) s.stop().then(() => s.clear()).catch(() => undefined);
    };
  }, [ligado]);

  return (
    <div className="space-y-3">
      <Button
        type="button"
        variant={ligado ? "secondary" : "default"}
        onClick={() => {
          setErro(null);
          setLigado((v) => !v);
        }}
        className="w-full"
      >
        {ligado ? <CameraOff className="size-4" /> : <Camera className="size-4" />}
        {ligado ? "Desligar câmera" : "Ligar câmera"}
      </Button>
      <div
        id={idRef.current}
        className={ligado ? "overflow-hidden rounded-xl border bg-black" : "hidden"}
      />
      {erro && <p className="text-sm font-medium text-destructive">{erro}</p>}
    </div>
  );
}
