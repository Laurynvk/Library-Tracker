import { useEffect, useState } from 'react';
import { fetchTracks } from './lib/tracks';
import type { Track } from './types/track';

function App() {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchTracks()
      .then(setTracks)
      .catch((e) => setError(e.message));
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center space-y-2">
        <h1 className="text-2xl font-semibold text-gray-800">Library Tracker</h1>
        {error ? (
          <p className="text-red-600 text-sm">DB error: {error}</p>
        ) : (
          <p className="text-gray-500 text-sm">
            Connected · {tracks.length} track{tracks.length !== 1 ? 's' : ''}
          </p>
        )}
      </div>
    </div>
  );
}

export default App;
