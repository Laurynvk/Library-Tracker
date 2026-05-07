import { useEffect, useState, useMemo } from 'react';
import { fetchTracks, updateTrack } from './lib/tracks';
import { Toolbar } from './components/Toolbar';
import { TrackTable } from './components/TrackTable';
import { Footer } from './components/Footer';
import { THEME } from './lib/theme';
import type { Track, InvoiceStatus } from './types/track';

export default function App() {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterInvoice, setFilterInvoice] = useState('all');

  useEffect(() => {
    fetchTracks()
      .then(setTracks)
      .catch((e) => setError(e.message));
  }, []);

  const filtered = useMemo(() => {
    let list = [...tracks];
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((t) =>
        `${t.code ?? ''} ${t.title} ${t.publisher ?? ''}`.toLowerCase().includes(q)
      );
    }
    if (filterStatus !== 'all') list = list.filter((t) => t.status === filterStatus);
    if (filterInvoice !== 'all') list = list.filter((t) => t.invoice === filterInvoice);
    return list;
  }, [tracks, search, filterStatus, filterInvoice]);

  async function handleUpdateInvoice(id: string, invoice: InvoiceStatus) {
    setTracks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, invoice } : t))
    );
    try {
      await updateTrack(id, { invoice });
    } catch (e) {
      setError((e as Error).message);
    }
  }

  if (error) {
    return (
      <div style={{ padding: 40, fontFamily: THEME.sans, color: '#c44545' }}>
        DB error: {error}
      </div>
    );
  }

  return (
    <div style={{
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      background: THEME.bg,
      fontFamily: THEME.sans,
      overflow: 'hidden',
    }}>
      <Toolbar
        trackCount={tracks.length}
        search={search}
        onSearch={setSearch}
        filterStatus={filterStatus}
        onFilterStatus={setFilterStatus}
        filterInvoice={filterInvoice}
        onFilterInvoice={setFilterInvoice}
      />
      <TrackTable
        tracks={filtered}
        onUpdateInvoice={handleUpdateInvoice}
      />
      <Footer tracks={tracks} />
    </div>
  );
}
