// ─── Time & Date ──────────────────────────────────────────────

export function formatTime(t: string | null, fallback = '—'): string {
  if (!t) return fallback;
  const [h, m] = t.split(':').map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
}

export function formatDate(
  d: string | null,
  options: Intl.DateTimeFormatOptions = { weekday: 'short', month: 'short', day: 'numeric' },
): string {
  if (!d) return '—';
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', options);
}

export function timeAgo(dateStr: string | null): string {
  if (!dateStr) return '—';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

export function calcDuration(open: string | null, close: string | null): string {
  if (!open || !close) return '—';
  const [oh, om] = open.split(':').map(Number);
  const [ch, cm] = close.split(':').map(Number);
  let mins = ch * 60 + cm - (oh * 60 + om);
  if (mins < 0) mins += 24 * 60;
  const hrs = Math.floor(mins / 60);
  const rem = mins % 60;
  return rem === 0 ? `${hrs}h` : `${hrs}h ${rem}m`;
}

// ─── UI Helpers ───────────────────────────────────────────────

export function initials(name: string | null, phone: string): string {
  if (name)
    return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
  return phone.slice(-2);
}

export function greet(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}
