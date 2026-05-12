'use client';

import { useState, useEffect } from 'react';
import { MapPin, ExternalLink } from 'lucide-react';
import { Table, TableRow, Td } from '@/components/ui/Table';
import Pagination from '@/components/ui/Pagination';

const PAGE_SIZE = 15;

interface Location {
  id: string;
  customer_id: string;
  address: string;
  district: string | null;
  city: string | null;
  latitude: number | null;
  longitude: number | null;
  maps_url: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  created_at: string;
  booking_date: string | null;
  booking_service: string | null;
}

export default function ClientLocationsPage() {
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/customer-locations');
      if (res.ok) setLocations(await res.json());
    } catch {
      console.error('Failed to load locations');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const totalPages = Math.max(1, Math.ceil(locations.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paginated = locations.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const from = locations.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1;
  const to = Math.min(safePage * PAGE_SIZE, locations.length);

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold" style={{ color: 'var(--color-text-primary)' }}>
          Client Locations
        </h2>
        <p className="text-sm mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
          Home visit locations shared by clients during booking.
        </p>
      </div>

      <Table
        headers={['Customer', 'Phone', 'Address / District', 'Booking', 'Map', 'Date']}
        loading={loading}
        isEmpty={locations.length === 0}
        emptyText="No client locations recorded yet."
        footer={
          <Pagination
            page={safePage}
            totalPages={totalPages}
            total={locations.length}
            from={from}
            to={to}
            onPageChange={setPage}
            itemLabel="location"
          />
        }
      >
        {paginated.map((loc, i) => (
          <TableRow key={loc.id} isLast={i === paginated.length - 1}>
            <Td>
              <p className="font-medium text-sm" style={{ color: 'var(--color-text-primary)' }}>
                {loc.customer_name || 'Unknown'}
              </p>
            </Td>
            <Td>
              <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                {loc.customer_phone || '—'}
              </span>
            </Td>
            <Td>
              <p className="text-sm" style={{ color: 'var(--color-text-primary)' }}>
                {loc.address}
              </p>
              {loc.district && (
                <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                  {loc.district}
                </span>
              )}
            </Td>
            <Td>
              {loc.booking_service ? (
                <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                  {loc.booking_service}
                  {loc.booking_date && <> — {new Date(loc.booking_date).toLocaleDateString()}</>}
                </span>
              ) : (
                <span style={{ color: 'var(--color-text-muted)' }}>—</span>
              )}
            </Td>
            <Td>
              {loc.latitude && loc.longitude ? (
                <a
                  href={`https://maps.google.com/maps?q=${loc.latitude},${loc.longitude}&z=15&t=h`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-sm"
                  style={{ color: 'var(--color-accent)' }}
                >
                  <MapPin size={14} />
                  View
                  <ExternalLink size={12} />
                </a>
              ) : loc.maps_url ? (
                <a
                  href={loc.maps_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-sm"
                  style={{ color: 'var(--color-accent)' }}
                >
                  <MapPin size={14} />
                  Open
                  <ExternalLink size={12} />
                </a>
              ) : (
                <span style={{ color: 'var(--color-text-muted)' }}>—</span>
              )}
            </Td>
            <Td>
              <span className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
                {loc.created_at ? new Date(loc.created_at).toLocaleDateString() : '—'}
              </span>
            </Td>
          </TableRow>
        ))}
      </Table>
    </div>
  );
}
