import React, { useState } from 'react';
import { RotateCcw } from 'lucide-react';

interface DefinedSectionCardProps {
  title: string;
  subtitle?: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}

export const DefinedSectionCard: React.FC<DefinedSectionCardProps> = ({
  title,
  subtitle,
  icon,
  children,
}) => {
  return (
    <section className="rounded-[18px] border border-[var(--fc-outline-variant)] bg-[var(--fc-surface)] p-4">
      <div className="mb-3 flex items-center gap-2.5">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-[var(--fc-surface-variant)] text-[var(--fc-primary)]">
          {icon}
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-[15px] leading-tight font-semibold text-[var(--fc-on-surface)]">
            {title}
          </h2>
          {subtitle && (
            <p className="mt-0.5 text-[12px] leading-tight text-[var(--fc-on-surface-variant)]">
              {subtitle}
            </p>
          )}
        </div>
      </div>
      <div className="space-y-3">{children}</div>
    </section>
  );
};

interface DefinedOptionTileProps {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  selected: boolean;
  enabled: boolean;
  onClick: () => void;
  testTag: string;
}

export const DefinedOptionTile: React.FC<DefinedOptionTileProps> = ({
  title,
  subtitle,
  icon,
  selected,
  enabled,
  onClick,
  testTag,
}) => {
  return (
    <button
      type="button"
      disabled={!enabled}
      data-testid={testTag}
      aria-pressed={selected}
      onClick={onClick}
      className={`flex min-h-[72px] flex-1 cursor-pointer items-start gap-2.5 rounded-[14px] p-3 text-left transition-colors ${
        selected
          ? 'bg-[var(--fc-primary-container)] text-[var(--fc-on-primary-container)] ring-[1.5px] ring-[var(--fc-primary)]'
          : 'border border-[var(--fc-outline)] bg-transparent text-[var(--fc-on-surface)] hover:bg-[var(--fc-surface-variant)]/50'
      }`}
    >
      <span
        className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-[8px] ${
          selected
            ? 'bg-[var(--fc-primary)] text-[var(--fc-on-primary)]'
            : 'bg-[var(--fc-surface-variant)] text-[var(--fc-on-surface-variant)]'
        }`}
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[13px] leading-snug font-semibold">{title}</span>
        <span
          className={`mt-0.5 block text-[11px] leading-snug ${
            selected
              ? 'text-[var(--fc-on-primary-container)]/85'
              : 'text-[var(--fc-on-surface-variant)]'
          }`}
        >
          {subtitle}
        </span>
      </span>
    </button>
  );
};

export function filterNumericInput(input: string, allowDecimal: boolean): string {
  let seenDot = false;
  let out = '';
  for (const ch of input) {
    if (ch >= '0' && ch <= '9') {
      out += ch;
    } else if (allowDecimal && ch === '.' && !seenDot) {
      seenDot = true;
      if (out.length === 0) out += '0';
      out += '.';
    }
  }
  return out;
}

export function parseCustomGopInput(raw: string): number | null {
  const parsed = Number.parseFloat(raw.trim());
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  if (parsed <= 1.0) {
    return Math.max(0.05, parsed);
  }
  return Math.max(1, Math.round(parsed));
}

export function formatGopDisplay(seconds: number | null): string {
  if (seconds == null) return '';
  if (seconds <= 1.0) {
    return String(seconds).replace(/\.0+$/, '').replace(/(\.\d*?)0+$/, '$1');
  }
  return String(Math.round(seconds));
}

function formatKhz(sampleRateHz: number | null): string {
  if (sampleRateHz == null) return '';
  if (sampleRateHz % 1000 === 0) return String(sampleRateHz / 1000);
  return String(sampleRateHz / 1000).replace(/0+$/, '').replace(/\.$/, '');
}

interface CustomNumericInputBoxProps {
  label: string;
  placeholder: string;
  suffixText: string;
  savedValueText: string;
  activeBadgeText: string | null;
  allowDecimal: boolean;
  enabled: boolean;
  testTagPrefix: string;
  supportingHint?: string;
  draftText: string | null;
  onDraftChange: (v: string | null) => void;
  onParseAndSave: (raw: string) => boolean;
  onReset: () => void;
}

export const CustomNumericInputBox: React.FC<CustomNumericInputBoxProps> = ({
  label,
  placeholder,
  suffixText,
  savedValueText,
  activeBadgeText,
  allowDecimal,
  enabled,
  testTagPrefix,
  supportingHint,
  draftText,
  onDraftChange,
  onParseAndSave,
  onReset,
}) => {
  const value = draftText ?? savedValueText;
  const isPartialDecimal = allowDecimal && (value === '0' || value === '0.' || value.endsWith('.'));
  const parsedVal = Number.parseFloat(value);
  const isError = value.trim().length > 0 && !isPartialDecimal && (!Number.isFinite(parsedVal) || parsedVal <= 0);

  return (
    <div className="space-y-2 pt-1">
      {activeBadgeText && (
        <span className="font-mono-tnum inline-block rounded-[8px] bg-[var(--fc-secondary-container)] px-2.5 py-1 text-[12px] font-medium text-[var(--fc-on-secondary-container)]">
          {activeBadgeText}
        </span>
      )}

      <div>
        <label className="mb-1 block text-[12px] font-medium text-[var(--fc-on-surface-variant)]">
          {label}
        </label>
        <div
          className={`flex h-11 items-center rounded-[12px] border px-3 transition-colors ${
            isError
              ? 'border-[var(--fc-error)]'
              : 'border-[var(--fc-outline)] focus-within:border-[var(--fc-primary)]'
          } ${!enabled ? 'opacity-60' : ''}`}
        >
          <input
            type="text"
            inputMode={allowDecimal ? 'decimal' : 'numeric'}
            disabled={!enabled}
            data-testid={`${testTagPrefix}_input`}
            value={value}
            placeholder={placeholder}
            onChange={(e) => {
              const filtered = filterNumericInput(e.target.value, allowDecimal);
              onDraftChange(filtered);
              if (filtered.length === 0) {
                onReset();
              } else {
                onParseAndSave(filtered);
              }
            }}
            className="font-mono-tnum min-w-0 flex-1 bg-transparent text-[13px] text-[var(--fc-on-surface)] outline-none placeholder:text-[var(--fc-on-surface-variant)]/60"
          />
          <span className="font-mono-tnum ml-2 shrink-0 text-[12px] text-[var(--fc-on-surface-variant)]">
            {suffixText}
          </span>
        </div>
        {supportingHint && (
          <p className="mt-1 text-[11px] text-[var(--fc-on-surface-variant)]">{supportingHint}</p>
        )}
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          disabled={!enabled}
          data-testid={`${testTagPrefix}_reset`}
          onClick={() => {
            onReset();
            onDraftChange(null);
          }}
          className="inline-flex h-10 cursor-pointer items-center gap-1.5 rounded-[10px] border border-[var(--fc-outline)] px-3.5 text-[12px] font-semibold text-[var(--fc-on-surface)] hover:bg-[var(--fc-surface-variant)]"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          <span>Reset</span>
        </button>
      </div>
    </div>
  );
};

interface AudioFormatCustomBoxesProps {
  savedSampleRateHz: number | null;
  savedBitrateBps: number | null;
  enabled: boolean;
  khzDraft: string | null;
  kbpsDraft: string | null;
  onKhzDraftChange: (v: string | null) => void;
  onKbpsDraftChange: (v: string | null) => void;
  onSaveCustomAudio: (sampleRateHz: number | null, bitrateBps: number | null) => void;
  onResetCustomAudio: () => void;
}

export const AudioFormatCustomBoxes: React.FC<AudioFormatCustomBoxesProps> = ({
  savedSampleRateHz,
  savedBitrateBps,
  enabled,
  khzDraft,
  kbpsDraft,
  onKhzDraftChange,
  onKbpsDraftChange,
  onSaveCustomAudio,
  onResetCustomAudio,
}) => {
  const [localDummy] = useState(0);
  void localDummy;

  const initialKhz = formatKhz(savedSampleRateHz);
  const initialKbps = savedBitrateBps != null ? String(Math.round(savedBitrateBps / 1000)) : '';
  const khzText = khzDraft ?? initialKhz;
  const kbpsText = kbpsDraft ?? initialKbps;

  const applyAudio = (rawKhz: string, rawKbps: string) => {
    if (rawKhz.trim().length === 0 && rawKbps.trim().length === 0) {
      onResetCustomAudio();
      return;
    }
    let parsedHz: number | null = null;
    if (rawKhz.trim().length > 0) {
      const f = Number.parseFloat(rawKhz);
      parsedHz =
        Number.isFinite(f) && f > 0
          ? Math.min(192_000, Math.max(8_000, Math.round(f * 1000)))
          : savedSampleRateHz;
    }
    let parsedBps: number | null = null;
    if (rawKbps.trim().length > 0) {
      const k = Number.parseInt(rawKbps, 10);
      parsedBps =
        Number.isFinite(k) && k > 0
          ? Math.min(1_000_000, Math.max(16_000, k * 1000))
          : savedBitrateBps;
    }
    if (parsedHz != null || parsedBps != null) {
      onSaveCustomAudio(parsedHz, parsedBps);
    }
  };

  return (
    <div className="space-y-2.5 pt-1">
      {(savedSampleRateHz != null || savedBitrateBps != null) && (
        <span className="font-mono-tnum inline-block rounded-[8px] bg-[var(--fc-secondary-container)] px-2.5 py-1 text-[12px] font-medium text-[var(--fc-on-secondary-container)]">
          Custom Audio: {formatKhz(savedSampleRateHz ?? 48_000)} kHz ·{' '}
          {Math.round((savedBitrateBps ?? 128_000) / 1000)} kbps
        </span>
      )}

      <div className="grid grid-cols-2 gap-2.5">
        <div>
          <label className="mb-1 block text-[12px] font-medium text-[var(--fc-on-surface-variant)]">
            Sample Rate (kHz)
          </label>
          <div className="flex h-11 items-center rounded-[12px] border border-[var(--fc-outline)] px-3 focus-within:border-[var(--fc-primary)]">
            <input
              type="text"
              inputMode="decimal"
              disabled={!enabled}
              data-testid="custom_audio_khz_input"
              value={khzText}
              placeholder="e.g. 48"
              onChange={(e) => {
                const filtered = filterNumericInput(e.target.value, true);
                onKhzDraftChange(filtered);
                applyAudio(filtered, kbpsText);
              }}
              className="font-mono-tnum min-w-0 flex-1 bg-transparent text-[13px] text-[var(--fc-on-surface)] outline-none placeholder:text-[var(--fc-on-surface-variant)]/60"
            />
            <span className="font-mono-tnum ml-1.5 text-[12px] text-[var(--fc-on-surface-variant)]">
              kHz
            </span>
          </div>
        </div>

        <div>
          <label className="mb-1 block text-[12px] font-medium text-[var(--fc-on-surface-variant)]">
            Audio Bitrate (kbps)
          </label>
          <div className="flex h-11 items-center rounded-[12px] border border-[var(--fc-outline)] px-3 focus-within:border-[var(--fc-primary)]">
            <input
              type="text"
              inputMode="numeric"
              disabled={!enabled}
              data-testid="custom_audio_kbps_input"
              value={kbpsText}
              placeholder="e.g. 192"
              onChange={(e) => {
                const filtered = filterNumericInput(e.target.value, false);
                onKbpsDraftChange(filtered);
                applyAudio(khzText, filtered);
              }}
              className="font-mono-tnum min-w-0 flex-1 bg-transparent text-[13px] text-[var(--fc-on-surface)] outline-none placeholder:text-[var(--fc-on-surface-variant)]/60"
            />
            <span className="font-mono-tnum ml-1.5 text-[12px] text-[var(--fc-on-surface-variant)]">
              kbps
            </span>
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          disabled={!enabled}
          data-testid="custom_audio_reset"
          onClick={() => {
            onResetCustomAudio();
            onKhzDraftChange(null);
            onKbpsDraftChange(null);
          }}
          className="inline-flex h-10 cursor-pointer items-center gap-1.5 rounded-[10px] border border-[var(--fc-outline)] px-3.5 text-[12px] font-semibold text-[var(--fc-on-surface)] hover:bg-[var(--fc-surface-variant)]"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          <span>Reset</span>
        </button>
      </div>
    </div>
  );
};
