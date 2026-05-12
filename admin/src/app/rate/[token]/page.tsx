'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Star, CheckCircle, XCircle, Loader2 } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────

interface RatingInfo {
  token: string;
  already_submitted: boolean;
  existing_rating: number | null;
  booking_date: string | null;
  start_time: string | null;
  end_time: string | null;
  therapist_name: string | null;
  customer_name: string | null;
  service_name: string | null;
}

// ─── Helpers ──────────────────────────────────────────────────

function formatDate(d: string | null) {
  if (!d) return '—';
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });
}

function formatTime(t: string | null) {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
}

// ─── Star Picker ──────────────────────────────────────────────

function StarPicker({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [hovered, setHovered] = useState(0);
  return (
    <div className="flex gap-2">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n)}
          onMouseEnter={() => setHovered(n)}
          onMouseLeave={() => setHovered(0)}
          className="transition-transform hover:scale-110 cursor-pointer"
          aria-label={`${n} star`}
        >
          <Star
            size={36}
            fill={(hovered || value) >= n ? '#f59e0b' : 'none'}
            stroke={(hovered || value) >= n ? '#f59e0b' : '#94a3b8'}
            strokeWidth={1.5}
          />
        </button>
      ))}
    </div>
  );
}

const LABELS = ['', 'Poor', 'Fair', 'Good', 'Very Good', 'Excellent'];

// ─── Page ─────────────────────────────────────────────────────

export default function RatingPage() {
  const { token } = useParams<{ token: string }>();

  const [info, setInfo]       = useState<RatingInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [rating, setRating]   = useState(0);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted]   = useState(false);
  const [submitError, setSubmitError] = useState('');

  useEffect(() => {
    fetch(`/api/rate/${token}`)
      .then((r) => {
        if (r.status === 404) { setNotFound(true); return null; }
        return r.json();
      })
      .then((data: RatingInfo | null) => {
        if (data) {
          setInfo(data);
          if (data.already_submitted && data.existing_rating) {
            setRating(data.existing_rating);
            setSubmitted(true);
          }
        }
      })
      .finally(() => setLoading(false));
  }, [token]);

  const handleSubmit = async () => {
    if (rating === 0) { setSubmitError('Please select a rating'); return; }
    setSubmitting(true);
    setSubmitError('');
    try {
      const res = await fetch(`/api/rate/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rating, comment }),
      });
      if (!res.ok) {
        const d = await res.json();
        setSubmitError(d.error ?? 'Failed to submit');
        return;
      }
      setSubmitted(true);
    } finally {
      setSubmitting(false);
    }
  };

  // ── Loading ──────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--color-bg)' }}>
        <Loader2 size={28} className="animate-spin" style={{ color: 'var(--color-accent)' }} />
      </div>
    );
  }

  // ── Not found ────────────────────────────────────────────────

  if (notFound) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6" style={{ background: 'var(--color-bg)' }}>
        <div className="text-center space-y-3 max-w-sm">
          <XCircle size={48} style={{ color: 'var(--color-danger)', margin: '0 auto' }} />
          <h1 className="text-lg font-bold" style={{ color: 'var(--color-text-primary)' }}>
            Link Not Found
          </h1>
          <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
            This rating link is invalid or has expired.
          </p>
        </div>
      </div>
    );
  }

  // ── Already submitted ────────────────────────────────────────

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6" style={{ background: 'var(--color-bg)' }}>
        <div className="text-center space-y-4 max-w-sm">
          <CheckCircle size={52} style={{ color: '#22c55e', margin: '0 auto' }} />
          <h1 className="text-xl font-bold" style={{ color: 'var(--color-text-primary)' }}>
            Thank you!
          </h1>
          <div className="flex justify-center">
            {[1,2,3,4,5].map((n) => (
              <Star key={n} size={28} fill={rating >= n ? '#f59e0b' : 'none'}
                stroke={rating >= n ? '#f59e0b' : '#94a3b8'} strokeWidth={1.5} />
            ))}
          </div>
          <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
            Your feedback has been submitted.
          </p>
        </div>
      </div>
    );
  }

  // ── Rating form ──────────────────────────────────────────────

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'var(--color-bg)' }}>
      <div
        className="w-full max-w-md rounded-2xl p-6 space-y-6"
        style={{
          background: 'var(--color-card-bg)',
          border: '1px solid var(--color-card-border)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
        }}
      >
        {/* Header */}
        <div className="text-center space-y-1">
          <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--color-accent)' }}>
            Rate your session
          </p>
          <h1 className="text-xl font-bold" style={{ color: 'var(--color-text-primary)' }}>
            How was your experience?
          </h1>
          {info?.customer_name && (
            <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
              Hi, {info.customer_name}!
            </p>
          )}
        </div>

        {/* Booking info card */}
        <div
          className="rounded-xl px-4 py-3 space-y-1"
          style={{ background: 'var(--color-input-bg)', border: '1px solid var(--color-input-border)' }}
        >
          {info?.therapist_name && (
            <div className="flex justify-between text-sm">
              <span style={{ color: 'var(--color-text-muted)' }}>Provider</span>
              <span className="font-medium" style={{ color: 'var(--color-text-primary)' }}>
                {info.therapist_name}
              </span>
            </div>
          )}
          {info?.service_name && (
            <div className="flex justify-between text-sm">
              <span style={{ color: 'var(--color-text-muted)' }}>Service</span>
              <span className="font-medium" style={{ color: 'var(--color-text-primary)' }}>
                {info.service_name}
              </span>
            </div>
          )}
          {info?.booking_date && (
            <div className="flex justify-between text-sm">
              <span style={{ color: 'var(--color-text-muted)' }}>Date</span>
              <span className="font-medium" style={{ color: 'var(--color-text-primary)' }}>
                {formatDate(info.booking_date)}
              </span>
            </div>
          )}
          {info?.start_time && (
            <div className="flex justify-between text-sm">
              <span style={{ color: 'var(--color-text-muted)' }}>Time</span>
              <span className="font-medium" style={{ color: 'var(--color-text-primary)' }}>
                {formatTime(info.start_time)}{info.end_time ? ` – ${formatTime(info.end_time)}` : ''}
              </span>
            </div>
          )}
        </div>

        {/* Stars */}
        <div className="flex flex-col items-center gap-2">
          <StarPicker value={rating} onChange={setRating} />
          <span className="text-sm font-medium h-5" style={{ color: 'var(--color-accent)' }}>
            {rating > 0 ? LABELS[rating] : ''}
          </span>
        </div>

        {/* Comment */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
            Comment <span style={{ color: 'var(--color-text-muted)' }}>(optional)</span>
          </label>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={3}
            placeholder="Share your experience…"
            className="w-full rounded-lg text-sm outline-none px-4 py-2.5 resize-none"
            style={{
              background: 'var(--color-input-bg)',
              border: '1px solid var(--color-input-border)',
              color: 'var(--color-text-primary)',
            }}
          />
        </div>

        {submitError && (
          <p className="text-xs" style={{ color: 'var(--color-danger)' }}>{submitError}</p>
        )}

        {/* Submit */}
        <button
          onClick={handleSubmit}
          disabled={submitting || rating === 0}
          className="w-full py-3 rounded-xl text-sm font-semibold transition-opacity cursor-pointer"
          style={{
            background: 'var(--color-accent)',
            color: '#fff',
            opacity: submitting || rating === 0 ? 0.6 : 1,
          }}
        >
          {submitting ? 'Submitting…' : 'Submit Rating'}
        </button>
      </div>
    </div>
  );
}
