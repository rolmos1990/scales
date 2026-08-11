/**
 * Síntesis de cuerda pulsada (algoritmo Karplus-Strong) usando la Web Audio API.
 * No usa muestras de audio ni servicios externos: genera la forma de onda por completo en
 * el navegador a partir de la frecuencia real de la nota, así que funciona sin conexión y
 * puede afinar cualquier traste de cualquier cuerda con su altura exacta.
 */
const GuitarSynth = (function () {
  let ctx = null;
  let masterGain = null;

  function getContext() {
    if (!ctx) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return null;
      ctx = new AudioContextClass();
      masterGain = ctx.createGain();
      masterGain.gain.value = 1;
      masterGain.connect(ctx.destination);
    }
    if (ctx.state === "suspended") {
      ctx.resume().catch(() => {});
    }
    return ctx;
  }

  /**
   * Sintetiza y reproduce el pulso de una cuerda a la frecuencia dada.
   * @param {number} frequency - Frecuencia en Hz de la nota a sonar.
   * @param {object} [options]
   * @param {number} [options.duration=1.7] - Duración total en segundos (incluye el decaimiento).
   * @param {number} [options.volume=0.55] - Volumen relativo (0-1).
   */
  function pluck(frequency, options = {}) {
    const audioCtx = getContext();
    if (!audioCtx || !frequency || frequency <= 0) return null;

    const duration = options.duration || 1.7;
    const volume = options.volume != null ? options.volume : 0.55;

    const sampleRate = audioCtx.sampleRate;
    const totalSamples = Math.floor(sampleRate * duration);
    // N = periodo de la onda en muestras: define la altura (frecuencia) de la cuerda.
    const N = Math.max(2, Math.round(sampleRate / frequency));
    const decay = 0.9965; // controla cuánto "suena" la cuerda antes de apagarse

    const y = new Float32Array(totalSamples);

    // Excitación inicial: ráfaga de ruido blanco (el pulso del dedo/púa), suavizada un poco
    // para que el ataque no sea un "click" seco sino algo más parecido a una cuerda real.
    for (let i = 0; i < N; i++) {
      y[i] = Math.random() * 2 - 1;
    }
    for (let i = 1; i < N; i++) {
      y[i] = y[i] * 0.55 + y[i - 1] * 0.45;
    }

    // Recurrencia de Karplus-Strong: cada muestra es el promedio (con decaimiento) de la
    // muestra un período atrás y la siguiente — un filtro paso-bajo recirculante que simula
    // la pérdida de energía de una cuerda vibrando.
    for (let i = N; i < totalSamples; i++) {
      y[i] = decay * 0.5 * (y[i - N] + y[i - N + 1]);
    }

    // Fade-out final para evitar un corte brusco (click) al terminar el buffer.
    const fadeSamples = Math.min(totalSamples, Math.floor(sampleRate * 0.08));
    for (let i = 0; i < fadeSamples; i++) {
      y[totalSamples - 1 - i] *= i / fadeSamples;
    }

    const buffer = audioCtx.createBuffer(1, totalSamples, sampleRate);
    buffer.getChannelData(0).set(y);

    const source = audioCtx.createBufferSource();
    source.buffer = buffer;

    const gain = audioCtx.createGain();
    gain.gain.value = volume;

    source.connect(gain).connect(masterGain);
    source.start();
    return source;
  }

  function setMuted(muted) {
    const audioCtx = getContext();
    if (!audioCtx || !masterGain) return;
    masterGain.gain.setTargetAtTime(muted ? 0 : 1, audioCtx.currentTime, 0.01);
  }

  return { pluck, setMuted, getContext };
})();

window.GuitarSynth = GuitarSynth;
