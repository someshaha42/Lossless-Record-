import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Download, Film, Play, Trash2, Video, X } from 'lucide-react';
import { RecordedVideoItem } from '../types/recorder';
import { getRecordingBlob } from '../utils/recordingsDb';
import { formatDateShort, formatDuration, formatMediaSize } from '../utils/mediaCropInspector';

interface RecordingsScreenProps {
  recordings: RecordedVideoItem[];
  isLoading: boolean;
  playingRecordingId: number | null;
  playbackPositionMs: number;
  onBack: () => void;
  onDelete: (item: RecordedVideoItem) => void;
  onPlayingRecordingChange: (id: number | null, posMs?: number) => void;
  onPlaybackPositionChange: (posMs: number) => void;
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

export const RecordingsScreen: React.FC<RecordingsScreenProps> = ({
  recordings,
  isLoading,
  playingRecordingId,
  playbackPositionMs,
  onBack,
  onDelete,
  onPlayingRecordingChange,
  onPlaybackPositionChange,
}) => {
  const [pendingDelete, setPendingDelete] = useState<RecordedVideoItem | null>(null);
  const [playerUrl, setPlayerUrl] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const playingItem =
    playingRecordingId != null
      ? recordings.find((r) => r.id === playingRecordingId) ?? null
      : null;

  useEffect(() => {
    let cancelled = false;
    let activeUrl: string | null = null;

    if (playingItem) {
      getRecordingBlob(playingItem.id).then((blob) => {
        if (cancelled || !blob) return;
        activeUrl = URL.createObjectURL(blob);
        setPlayerUrl(activeUrl);
      });
    } else {
      setPlayerUrl(null);
    }

    return () => {
      cancelled = true;
      if (activeUrl) URL.revokeObjectURL(activeUrl);
    };
  }, [playingItem?.id]);

  const handleDownload = async (item: RecordedVideoItem) => {
    const blob = await getRecordingBlob(item.id);
    if (blob) {
      triggerDownload(blob, item.displayName);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--fc-bg)] text-[var(--fc-on-surface)]">
      <header className="sticky top-0 z-30 border-b border-[var(--fc-outline-variant)] bg-[var(--fc-bg)]/95 backdrop-blur-sm">
        <div className="mx-auto flex h-16 max-w-[1240px] items-center gap-3 px-4 sm:px-6">
          <button
            type="button"
            data-testid="recordings_back_button"
            aria-label="Navigate back"
            onClick={onBack}
            className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-full text-[var(--fc-on-surface)] transition-colors hover:bg-[var(--fc-surface-variant)]"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="font-display text-[18px] font-bold text-[var(--fc-on-surface)]">
            Recorded Videos
          </h1>
        </div>
      </header>

      <main className="mx-auto max-w-[1240px] px-4 py-6 sm:px-6">
        {isLoading && recordings.length === 0 ? (
          <div className="flex min-h-[320px] items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--fc-outline)] border-t-[var(--fc-primary)]" />
          </div>
        ) : recordings.length === 0 ? (
          <div className="flex min-h-[360px] flex-col items-center justify-center p-8 text-center">
            <div className="mb-4 flex h-[72px] w-[72px] items-center justify-center rounded-[20px] bg-[var(--fc-surface-variant)] text-[var(--fc-on-surface-variant)]">
              <Video className="h-8 w-8" />
            </div>
            <h2 className="font-display text-[16px] font-semibold text-[var(--fc-on-surface)]">
              No recordings yet
            </h2>
            <p className="mt-1.5 max-w-sm text-[13px] text-[var(--fc-on-surface-variant)]">
              Captured MP4 videos will appear here ready to play, download, or share.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {recordings.map((item) => {
              const details = [
                item.width > 0 && item.height > 0 ? `${item.width}×${item.height}` : null,
                item.durationMs > 0 ? formatDuration(item.durationMs) : null,
                formatMediaSize(item.sizeBytes),
                item.dateAddedSec > 0 ? formatDateShort(item.dateAddedSec) : null,
              ]
                .filter(Boolean)
                .join(' · ');

              return (
                <div
                  key={item.id}
                  data-testid={`recording_card_${item.id}`}
                  onClick={() => onPlayingRecordingChange(item.id, 0)}
                  className="flex cursor-pointer items-center gap-3 rounded-[16px] border border-[var(--fc-outline-variant)] bg-[var(--fc-surface)] p-3.5 transition-colors hover:border-[var(--fc-outline)] hover:bg-[var(--fc-surface-variant)]/40"
                >
                  <div className="flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-[12px] bg-[var(--fc-record-container)] text-[var(--fc-record-accent)]">
                    <Film className="h-6 w-6" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[14px] font-semibold text-[var(--fc-on-surface)]">
                      {item.displayName}
                    </div>
                    <div className="font-mono-tnum mt-0.5 truncate text-[11px] text-[var(--fc-on-surface-variant)]">
                      {details}
                    </div>
                  </div>
                  <div
                    className="flex shrink-0 items-center gap-1"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      type="button"
                      aria-label="Play"
                      onClick={() => onPlayingRecordingChange(item.id, 0)}
                      className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-full text-[var(--fc-on-surface)] hover:bg-[var(--fc-surface-variant)]"
                    >
                      <Play className="h-4.5 w-4.5" />
                    </button>
                    <button
                      type="button"
                      aria-label="Download recording"
                      onClick={() => handleDownload(item)}
                      className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-full text-[var(--fc-on-surface)] hover:bg-[var(--fc-surface-variant)]"
                    >
                      <Download className="h-4.5 w-4.5" />
                    </button>
                    <button
                      type="button"
                      aria-label="Delete"
                      onClick={() => setPendingDelete(item)}
                      className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-full text-[var(--fc-on-surface)] hover:bg-[var(--fc-error-container)] hover:text-[var(--fc-error)]"
                    >
                      <Trash2 className="h-4.5 w-4.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {playingItem && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
          aria-label={playingItem.displayName}
          onClick={() => {
            const posMs = videoRef.current
              ? Math.round(videoRef.current.currentTime * 1000)
              : 0;
            onPlaybackPositionChange(posMs);
            onPlayingRecordingChange(null, 0);
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="flex max-h-[90vh] w-full max-w-[1080px] flex-col overflow-hidden rounded-[20px] border border-[var(--fc-outline)] bg-[var(--fc-surface)] shadow-2xl"
          >
            <div className="flex items-center justify-between gap-3 border-b border-[var(--fc-outline-variant)] px-4 py-3">
              <span className="truncate text-[14px] font-semibold text-[var(--fc-on-surface)]">
                {playingItem.displayName}
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => handleDownload(playingItem)}
                  className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-[10px] border border-[var(--fc-outline)] px-3 text-[12px] font-medium text-[var(--fc-on-surface)] hover:bg-[var(--fc-surface-variant)]"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>Download</span>
                </button>
                <button
                  type="button"
                  aria-label="Close"
                  onClick={() => {
                    const posMs = videoRef.current
                      ? Math.round(videoRef.current.currentTime * 1000)
                      : 0;
                    onPlaybackPositionChange(posMs);
                    onPlayingRecordingChange(null, 0);
                  }}
                  className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-full text-[var(--fc-on-surface)] hover:bg-[var(--fc-surface-variant)]"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>
            <div className="flex flex-1 items-center justify-center bg-black p-2">
              {playerUrl ? (
                <video
                  ref={videoRef}
                  src={playerUrl}
                  controls
                  autoPlay
                  onLoadedMetadata={() => {
                    if (videoRef.current && playbackPositionMs > 0) {
                      videoRef.current.currentTime = playbackPositionMs / 1000;
                    }
                  }}
                  onTimeUpdate={() => {
                    if (videoRef.current) {
                      onPlaybackPositionChange(Math.round(videoRef.current.currentTime * 1000));
                    }
                  }}
                  className="max-h-[75vh] w-full rounded-[8px]"
                />
              ) : (
                <div className="py-16 text-[13px] text-white/70">Loading video stream…</div>
              )}
            </div>
          </div>
        </div>
      )}

      {pendingDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Delete recording?"
        >
          <div className="w-full max-w-md rounded-[20px] border border-[var(--fc-outline)] bg-[var(--fc-surface)] p-6 shadow-2xl">
            <h2 className="font-display text-[18px] font-bold text-[var(--fc-on-surface)]">
              Delete recording?
            </h2>
            <p className="mt-2 text-[14px] text-[var(--fc-on-surface-variant)]">
              Remove {pendingDelete.displayName} permanently from browser storage?
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setPendingDelete(null)}
                className="h-10 cursor-pointer rounded-[10px] px-4 text-[13px] font-semibold text-[var(--fc-on-surface)] hover:bg-[var(--fc-surface-variant)]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  onDelete(pendingDelete);
                  setPendingDelete(null);
                }}
                className="h-10 cursor-pointer rounded-[10px] bg-[var(--fc-record-accent)] px-4 text-[13px] font-semibold text-white hover:opacity-95"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
