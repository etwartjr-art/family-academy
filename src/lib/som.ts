/**
 * Sons curtos de retorno para a chamada por câmera.
 * Usa Web Audio API — sem arquivos externos e sem depender de rede.
 */
let ctx: AudioContext | null = null;

function contexto(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  if (!ctx) ctx = new Ctor();
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

function bip(notas: Array<{ hz: number; inicio: number; dur: number }>, volume = 0.18) {
  const ac = contexto();
  if (!ac) return;
  const agora = ac.currentTime;
  for (const n of notas) {
    const osc = ac.createOscillator();
    const ganho = ac.createGain();
    osc.type = "sine";
    osc.frequency.value = n.hz;
    const t0 = agora + n.inicio;
    ganho.gain.setValueAtTime(0.0001, t0);
    ganho.gain.exponentialRampToValueAtTime(volume, t0 + 0.012);
    ganho.gain.exponentialRampToValueAtTime(0.0001, t0 + n.dur);
    osc.connect(ganho).connect(ac.destination);
    osc.start(t0);
    osc.stop(t0 + n.dur + 0.02);
  }
}

/** Dois bips ascendentes — presença registrada. */
export function somSucesso() {
  bip([
    { hz: 880, inicio: 0, dur: 0.11 },
    { hz: 1320, inicio: 0.1, dur: 0.16 },
  ]);
}

/** Bip grave — leitura recusada. */
export function somErro() {
  bip([
    { hz: 300, inicio: 0, dur: 0.18 },
    { hz: 200, inicio: 0.16, dur: 0.24 },
  ]);
}
