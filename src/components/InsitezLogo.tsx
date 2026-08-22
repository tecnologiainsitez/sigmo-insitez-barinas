import React, { useState } from 'react';
import { INSITEZ_LOGO_URL, INSITEZ_LOGO_FALLBACK } from '../config/constants';

interface InsitezLogoProps {
  variant?: 'full' | 'horizontal' | 'symbol' | 'badge';
  theme?: 'dark' | 'light' | 'color';
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  showSubtitle?: boolean;
}

export const InsitezLogo: React.FC<InsitezLogoProps> = ({
  variant = 'horizontal',
  theme = 'dark',
  size = 'md',
  className = '',
  showSubtitle = true,
}) => {
  const [logoSrc, setLogoSrc] = useState<string>(INSITEZ_LOGO_URL);

  const handleImageError = () => {
    if (logoSrc !== INSITEZ_LOGO_FALLBACK) {
      setLogoSrc(INSITEZ_LOGO_FALLBACK);
    }
  };

  const dimensions = {
    xs: { h: 'h-7', w: 'w-auto', fullH: 'h-16' },
    sm: { h: 'h-9', w: 'w-auto', fullH: 'h-24' },
    md: { h: 'h-11', w: 'w-auto', fullH: 'h-32' },
    lg: { h: 'h-14', w: 'w-auto', fullH: 'h-40' },
    xl: { h: 'h-20', w: 'w-auto', fullH: 'h-56' },
  }[size];

  const textColor = {
    dark: {
      title: 'text-white',
      subtitle: 'text-slate-300',
      unellez: 'text-amber-400',
    },
    light: {
      title: 'text-slate-900',
      subtitle: 'text-slate-600',
      unellez: 'text-emerald-800',
    },
    color: {
      title: 'text-slate-900',
      subtitle: 'text-slate-700',
      unellez: 'text-emerald-800',
    },
  }[theme];

  if (variant === 'full') {
    return (
      <div className={`flex flex-col items-center text-center select-none ${className}`}>
        <div className="relative inline-block bg-white p-2.5 rounded-2xl shadow-xs border border-slate-200/80">
          <img
            src={logoSrc}
            alt="INSITEZ - Instituto de Salud Integral UNELLEZ"
            referrerPolicy="no-referrer"
            className={`${dimensions.fullH} w-auto object-contain mx-auto transition-transform hover:scale-102`}
            onError={handleImageError}
          />
        </div>
      </div>
    );
  }

  if (variant === 'symbol') {
    return (
      <div className={`inline-flex items-center justify-center select-none ${className}`}>
        <div className="bg-white p-1 rounded-xl shadow-xs border border-slate-200/60 inline-flex items-center justify-center">
          <img
            src={logoSrc}
            alt="Logo INSITEZ"
            referrerPolicy="no-referrer"
            className={`${dimensions.h} w-auto object-contain`}
            onError={handleImageError}
          />
        </div>
      </div>
    );
  }

  if (variant === 'badge') {
    return (
      <div
        className={`inline-flex items-center gap-2.5 px-3 py-1.5 rounded-xl border select-none ${
          theme === 'dark'
            ? 'bg-slate-900/95 border-slate-700/80 text-white'
            : 'bg-white border-slate-200 text-slate-900 shadow-xs'
        } ${className}`}
      >
        <div className="bg-white p-0.5 rounded-lg shadow-2xs">
          <img
            src={logoSrc}
            alt="INSITEZ"
            referrerPolicy="no-referrer"
            className="h-6 w-auto object-contain"
            onError={handleImageError}
          />
        </div>
        <div className="leading-tight">
          <div className="font-black tracking-wider text-xs">INSITEZ</div>
          <div className="text-[9px] text-emerald-600 font-bold">UNELLEZ BARINAS</div>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-3 select-none ${className}`}>
      <div className="bg-white p-1.5 rounded-xl shadow-xs border border-slate-200/70 flex-shrink-0 flex items-center justify-center">
        <img
          src={logoSrc}
          alt="INSITEZ - UNELLEZ Barinas"
          referrerPolicy="no-referrer"
          className={`${dimensions.h} w-auto object-contain max-h-12`}
          onError={handleImageError}
        />
      </div>

      <div className="flex flex-col justify-center">
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className={`text-base sm:text-lg font-black tracking-tight ${textColor.title}`}
            style={{ letterSpacing: '0.02em' }}
          >
            INSITEZ
          </span>
          <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-md bg-emerald-950/70 text-emerald-300 border border-emerald-700/40 font-mono">
            Barinas
          </span>
          <span className="hidden sm:inline-block text-[10px] bg-slate-800 text-slate-300 border border-slate-700 px-2 py-0.5 rounded-md font-mono">
            UNELLEZ
          </span>
        </div>

        {showSubtitle && (
          <div className="leading-tight mt-0.5">
            <p className={`text-[10px] sm:text-[11px] font-medium tracking-tight ${textColor.subtitle}`}>
              Instituto de Salud Integral de los Trabajadores de la UNELLEZ
            </p>
            <p className="text-[9px] text-slate-400 font-medium hidden md:block">
              &ldquo;Ezequiel Zamora&rdquo; — Sistema de Gestión Clínica y Citas Odontológicas
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
