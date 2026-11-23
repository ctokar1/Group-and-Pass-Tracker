import React, { useEffect, useRef, useState } from 'react';
import { Mic, MicOff, Volume2, X } from 'lucide-react';

export type NoiseModeId = 'silent' | 'whisper' | 'group';

interface NoiseModeConfig {
  id: NoiseModeId;
  label: string;
  targetThreshold: number;
  warnThreshold: number;
}

const NOISE_MODES: NoiseModeConfig[] = [
  { id: 'silent', label: 'Silent', targetThreshold: 22, warnThreshold: 14 },
  { id: 'whisper', label: 'Partner Whisper', targetThreshold: 48, warnThreshold: 32 },
  { id: 'group', label: 'Group Work', targetThreshold: 74, warnThreshold: 55 },
];

interface NoiseMeterWidgetProps {
  onClose?: () => void;
}

export const NoiseMeterWidget: React.FC<NoiseMeterWidgetProps> = ({ onClose }) => {
  const [mode, setMode] = useState<NoiseModeId>('whisper');
  const [listening, setListening] = useState(false);
  const [level, setLevel] = useState(0);
  const [sensitivity, setSensitivity] = useState(1.2);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const rafRef = useRef<number | null>(null);
  const sensitivityRef = useRef(sensitivity);

  useEffect(() => {
    sensitivityRef.current = sensitivity;
  }, [sensitivity]);

  const stopMeter = () => {
    if (rafRef.current !== null) {
      window.cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (audioCtxRef.current) {
      void audioCtxRef.current.close().catch(() => undefined);
      audioCtxRef.current = null;
    }
    setListening(false);
    setLevel(0);
  };

  useEffect(() => {
    return () => {
      stopMeter();
    };
  }, []);

  const startMeter = async () => {
    setErrorMsg(null);
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setErrorMsg('Microphone capture is not supported in this browser.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: false },
      });
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) {
        stream.getTracks().forEach((t) => t.stop());
        setErrorMsg('Web Audio API is unavailable in this browser.');
        return;
      }

      const ctx = new AudioCtx();
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 1024;
      analyser.smoothingTimeConstant = 0.78;
      source.connect(analyser);

      streamRef.current = stream;
      audioCtxRef.current = ctx;
      setListening(true);

      const data = new Uint8Array(analyser.fftSize);
      const sampleLoop = () => {
        analyser.getByteTimeDomainData(data);
        let sumSq = 0;
        for (let i = 0; i < data.length; i++) {
          const norm = (data[i] - 128) / 128;
          sumSq += norm * norm;
        }
        const rms = Math.sqrt(sumSq / data.length);
        // Logarithmic perceptual scaling 0–100
        const scaled = Math.min(
          100,
          Math.max(0, Math.round(rms * 240 * sensitivityRef.current))
        );
        setLevel(scaled);
        rafRef.current = window.requestAnimationFrame(sampleLoop);
      };
      sampleLoop();
    } catch {
      stopMeter();
      setErrorMsg('Microphone access denied or unavailable.');
    }
  };

  const activeConfig = NOISE_MODES.find((m) => m.id === mode) || NOISE_MODES[1];
  const zone =
    level >= activeConfig.targetThreshold
      ? 'loud'
      : level >= activeConfig.warnThreshold
      ? 'warn'
      : 'good';

  const statusText = !listening
    ? 'Mic Off'
    : zone === 'loud'
    ? 'Too Loud! Lower Voices'
    : zone === 'warn'
    ? 'Getting Loud'
    : 'On Target';

  return (
    <div className="no-print bg-slate-900/95 border border-slate-800 rounded-2xl px-4 py-2.5 mb-2 flex flex-wrap items-center justify-between gap-3 shrink-0">
      <div className="flex flex-wrap items-center gap-2.5">
        <button
          type="button"
          onClick={() => (listening ? stopMeter() : void startMeter())}
          className={`px-3 py-1.5 rounded-xl font-black text-xs flex items-center gap-1.5 cursor-pointer transition-colors ${
            listening
              ? 'bg-emerald-500 text-black hover:bg-emerald-400'
              : 'bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700'
          }`}
        >
          {listening ? <Mic className="w-3.5 h-3.5" /> : <MicOff className="w-3.5 h-3.5" />}
          {listening ? 'Stop Mic' : 'Enable Noise Meter'}
        </button>

        {/* Mode Selector */}
        <div className="flex items-center gap-1 p-0.5 bg-slate-950 border border-slate-800 rounded-xl text-xs">
          {NOISE_MODES.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setMode(m.id)}
              className={`px-2.5 py-1 rounded-lg font-bold transition-colors cursor-pointer ${
                mode === m.id
                  ? 'bg-amber-400 text-black'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {/* Live Decibel Gauge */}
      <div className="flex-1 min-w-[220px] max-w-md flex items-center gap-3">
        <Volume2
          className={`w-4 h-4 shrink-0 ${
            !listening
              ? 'text-slate-500'
              : zone === 'loud'
              ? 'text-rose-400 animate-bounce'
              : zone === 'warn'
              ? 'text-amber-300'
              : 'text-emerald-400'
          }`}
        />
        <div className="flex-1 space-y-1">
          <div className="relative h-4 bg-slate-950 border border-slate-800 rounded-full overflow-hidden">
            {/* Target threshold marker */}
            <div
              className="absolute top-0 bottom-0 w-0.5 bg-white/70 z-10"
              style={{ left: `${activeConfig.targetThreshold}%` }}
              title={`Target max: ${activeConfig.targetThreshold}%`}
            />
            <div
              className={`h-full transition-all duration-100 rounded-full ${
                zone === 'loud'
                  ? 'bg-rose-500'
                  : zone === 'warn'
                  ? 'bg-amber-400'
                  : 'bg-emerald-500'
              }`}
              style={{ width: `${listening ? level : 0}%` }}
            />
          </div>
          {errorMsg && <span className="text-[11px] text-rose-400 font-semibold block">{errorMsg}</span>}
        </div>
        <span
          className={`text-xs font-black whitespace-nowrap px-2.5 py-1 rounded-lg font-mono-tabular ${
            !listening
              ? 'bg-slate-950 text-slate-400'
              : zone === 'loud'
              ? 'bg-rose-500/20 text-rose-300 border border-rose-500/60 animate-pulse'
              : zone === 'warn'
              ? 'bg-amber-400/20 text-amber-300 border border-amber-400/50'
              : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
          }`}
        >
          {listening ? `${level}% · ${statusText}` : statusText}
        </span>
      </div>

      {/* Sensitivity & Close */}
      <div className="flex items-center gap-2">
        <label className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-400">
          <span>Mic Gain</span>
          <input
            type="range"
            min={0.5}
            max={2.4}
            step={0.1}
            value={sensitivity}
            onChange={(e) => setSensitivity(Number(e.target.value))}
            className="w-20 accent-amber-400 cursor-pointer"
          />
        </label>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white cursor-pointer"
            aria-label="Hide Noise Meter"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
};
