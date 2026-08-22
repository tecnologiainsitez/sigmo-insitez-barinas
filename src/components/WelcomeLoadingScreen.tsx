import React, { useEffect, useState } from 'react';
import { InsitezLogo } from './InsitezLogo';
import { UserAccount } from '../types';
import { INSITEZ_LOGO_URL, INSITEZ_LOGO_FALLBACK } from '../config/constants';
import { CheckCircle2, CloudDownload, Database, Server, Sparkles } from 'lucide-react';

interface WelcomeLoadingScreenProps {
  user: UserAccount;
  onFinish: () => void;
  isOnline?: boolean;
}

export const WelcomeLoadingScreen: React.FC<WelcomeLoadingScreenProps> = ({
  user,
  onFinish,
  isOnline = true,
}) => {
  const [progress, setProgress] = useState(15);
  const [currentStepText, setCurrentStepText] = useState('Iniciando sesión segura...');
  const [stepIndex, setStepIndex] = useState(1);

  useEffect(() => {
    const steps = [
      { p: 30, text: 'Conectando con almacenamiento local IndexedDB...', delay: 400 },
      { p: 60, text: 'Descargando padrón de pacientes y beneficiarios...', delay: 900 },
      { p: 85, text: 'Sincronizando agenda clínica y turnos médicos...', delay: 1400 },
      { p: 100, text: '¡Datos cargados con éxito!', delay: 1900 },
    ];

    const timeouts = steps.map((s, idx) => {
      return setTimeout(() => {
        setProgress(s.p);
        setCurrentStepText(s.text);
        setStepIndex(idx + 1);
        if (s.p === 100) {
          setTimeout(() => {
            onFinish();
          }, 450);
        }
      }, s.delay);
    });

    return () => {
      timeouts.forEach(clearTimeout);
    };
  }, [onFinish]);

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col justify-center items-center p-4 select-none font-sans">
      {/* Centered Clean Card matching reference view */}
      <div className="w-full max-w-md bg-white rounded-3xl shadow-xl border border-slate-200/80 p-8 sm:p-10 flex flex-col items-center text-center relative overflow-hidden animate-in fade-in zoom-in-95 duration-300">
        
        {/* Top subtle blue accent gradient bar */}
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-blue-600 via-sky-500 to-emerald-500" />

        {/* Logo Card Box */}
        <div className="mb-6 bg-white p-3 rounded-2xl shadow-sm border border-slate-200/70 inline-flex items-center justify-center">
          <img
            src={INSITEZ_LOGO_URL}
            alt="INSITEZ UNELLEZ"
            referrerPolicy="no-referrer"
            className="h-24 w-auto object-contain"
            onError={(e) => {
              const target = e.currentTarget;
              if (target.src !== window.location.origin + INSITEZ_LOGO_FALLBACK && !target.src.endsWith(INSITEZ_LOGO_FALLBACK)) {
                target.src = INSITEZ_LOGO_FALLBACK;
              }
            }}
          />
        </div>

        {/* Modern Circular Blue Spinner matching mockup */}
        <div className="relative my-4 flex items-center justify-center">
          <div className="w-14 h-14 rounded-full border-4 border-blue-100 border-t-[#1a56db] animate-spin" />
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-[10px] font-bold text-blue-700 font-mono">
              {progress}%
            </span>
          </div>
        </div>

        {/* Welcome Title */}
        <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight mt-2">
          Bienvenido a INSITEZ 1.0
        </h2>
        <p className="text-sm font-semibold text-blue-700 mt-1">
          {user.nombre}
        </p>

        {/* Status Text with dynamic updates */}
        <div className="mt-3 min-h-[3rem] flex flex-col items-center justify-center">
          <p className="text-xs text-slate-500 font-medium animate-pulse">
            {currentStepText}
          </p>
          
          {/* Progress bar line */}
          <div className="w-48 bg-slate-100 h-1.5 rounded-full mt-3 overflow-hidden border border-slate-200">
            <div
              className="h-full bg-gradient-to-r from-blue-600 to-sky-500 transition-all duration-300 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Skip button if user doesn't want to wait */}
        <button
          type="button"
          onClick={onFinish}
          className="mt-4 text-[11px] text-slate-400 hover:text-blue-600 transition underline cursor-pointer"
        >
          Continuar ahora →
        </button>

        {/* Footer info matching the reference document */}
        <div className="mt-8 pt-6 border-t border-slate-100 w-full text-center">
          <p className="text-[10px] text-slate-400 font-medium leading-relaxed">
            Desarrollado por Subgerencia de Sistemas e Innovación Tecnológica de{' '}
            <span className="font-semibold text-slate-600">INSITEZ (2026)</span>
          </p>
        </div>
      </div>
    </div>
  );
};
