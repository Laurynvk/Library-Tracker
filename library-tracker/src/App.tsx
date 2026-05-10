import { useEffect, useState, useMemo } from 'react';
import { fetchTracks, updateTrack } from './lib/tracks';
import { Toolbar } from './components/Toolbar';
import { TrackTable } from './components/TrackTable';
import { Footer } from './components/Footer';
import { TrackDrawer } from './components/TrackDrawer';
import { InboxDrawer } from './components/InboxDrawer';
import { BriefModal } from './components/BriefModal';
import { SettingsModal } from './components/SettingsModal';
import { THEME, DARK_THEME, ThemeContext } from './lib/theme';
import { fetchSettings } from './lib/settings';
import type { Track, InvoiceStatus } from './types/track';

function bumpVersion(v: string): string {
  const match = v.match(/^v(\d+)\.(\d+)$/);
  if (!match) return v;
  const minor = parseInt(match[2], 10) + 1;
  return `v${match[1]}.${String(minor).padStart(2, '0')}`;
}

export default function App() {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterInvoice, setFilterInvoice] = useState('all');
  const [selectedTrack, setSelectedTrack] = useState<Track | null>(null);
  const [inboxOpen, setInboxOpen] = useState(false);
  const [inboxPendingCount, setInboxPendingCount] = useState(0);
  const [briefOpen, setBriefOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [userInitials, setUserInitials] = useState<string | undefined>(undefined);
  const [defaultVersion, setDefaultVersion] = useState<string | undefined>(undefined);

  function applySettings(s: Awaited<ReturnType<typeof fetchSettings>>) {
    setDarkMode(s.dark_mode ?? false);
    setUserInitials(s.initials);
    setDefaultVersion(s.default_version);
  }

  useEffect(() => {
    fetchTracks()
      .then(setTracks)
      .catch((e) => setError(e.message));
    fetchSettings().then(applySettings).catch(() => {});
  }, []);

  useEffect(() => {
    if (!settingsOpen) {
      fetchSettings().then(applySettings).catch(() => {});
    }
  }, [settingsOpen]);

  const theme = darkMode ? DARK_THEME : THEME;

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

  function handleSelectTrack(track: Track) {
    setSelectedTrack(track);
  }

  function handleSaveTrack(updated: Track) {
    setTracks((prev) => prev.map((t) => {
      if (t.id !== updated.id) return t;
      if (updated.status === 'revising' && t.status !== 'revising') {
        const newVersion = bumpVersion(updated.version || 'v1.00');
        updateTrack(updated.id, { version: newVersion }).catch((e) => setError(e.message));
        return { ...updated, version: newVersion };
      }
      return updated;
    }));
    setSelectedTrack((prev) => {
      if (prev?.id !== updated.id) return prev;
      if (updated.status === 'revising') {
        const existing = tracks.find((t) => t.id === updated.id);
        if (existing && existing.status !== 'revising') {
          return { ...updated, version: bumpVersion(updated.version || 'v1.00') };
        }
      }
      return updated;
    });
  }

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

  async function handleUpdateTitle(id: string, title: string) {
    setTracks((prev) => prev.map((t) => (t.id === id ? { ...t, title } : t)));
    setSelectedTrack((prev) => (prev?.id === id ? { ...prev, title } : prev));
    try {
      await updateTrack(id, { title });
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function handleUpdateCode(id: string, code: string | null) {
    setTracks((prev) => prev.map((t) => (t.id === id ? { ...t, code } : t)));
    setSelectedTrack((prev) => (prev?.id === id ? { ...prev, code } : prev));
    try {
      await updateTrack(id, { code });
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function handleUpdateVersion(id: string, version: string) {
    setTracks((prev) => prev.map((t) => (t.id === id ? { ...t, version } : t)));
    setSelectedTrack((prev) => (prev?.id === id ? { ...prev, version } : prev));
    try {
      await updateTrack(id, { version });
    } catch (e) {
      setError((e as Error).message);
    }
  }

  function handleBriefCreated(track: Track) {
    setTracks((prev) => [track, ...prev]);
  }

  if (error) {
    return (
      <div style={{ padding: 40, fontFamily: theme.sans, color: '#c44545' }}>
        DB error: {error}
      </div>
    );
  }

  return (
    <ThemeContext.Provider value={theme}>
      <div style={{
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        background: theme.bg,
        fontFamily: theme.sans,
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
          inboxPendingCount={inboxPendingCount}
          onInboxOpen={() => setInboxOpen(true)}
          onNewFromBrief={() => setBriefOpen(true)}
          onSettingsOpen={() => setSettingsOpen(true)}
        />
        <TrackTable
          tracks={filtered}
          onUpdateInvoice={handleUpdateInvoice}
          onUpdateTitle={handleUpdateTitle}
          onUpdateVersion={handleUpdateVersion}
          onUpdateCode={handleUpdateCode}
          onRowClick={handleSelectTrack}
          selectedTrackId={selectedTrack?.id}
          userInitials={userInitials}
          defaultVersion={defaultVersion}
        />
        <Footer tracks={tracks} />
        <TrackDrawer
          key={selectedTrack?.id ?? 'none'}
          track={selectedTrack}
          onClose={() => setSelectedTrack(null)}
          onSave={handleSaveTrack}
        />
        {inboxOpen && (
          <InboxDrawer
            userId="4daf3a38-2ab6-42f4-82f1-de5a2483794d"
            onClose={() => setInboxOpen(false)}
            onPendingCountChange={setInboxPendingCount}
          />
        )}
        {briefOpen && (
          <BriefModal
            onClose={() => setBriefOpen(false)}
            onCreated={handleBriefCreated}
          />
        )}
        {settingsOpen && (
          <SettingsModal onClose={() => setSettingsOpen(false)} />
        )}
      </div>
    </ThemeContext.Provider>
  );
}
