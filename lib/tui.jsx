import React, { useState, useEffect } from 'react';
import { render, Box, Text, useInput } from 'ink';
import TextInput from 'ink-text-input';
import SelectInput from 'ink-select-input';

const TuiApp = ({ spotifyApi }) => {
  const [playback, setPlayback] = useState(null);
  const [query, setQuery] = useState('');
  const [artists, setArtists] = useState([]);
  const [mode, setMode] = useState('info'); // 'info' or 'search'

  // 再生情報の定期更新
  useEffect(() => {
    const timer = setInterval(async () => {
      try {
        const state = await spotifyApi.getMyCurrentPlaybackState();
        if (state.body) {
          setPlayback(state.body);
        }
      } catch (err) {
        // エラーハンドリング
      }
    }, 3000);

    return () => clearInterval(timer);
  }, [spotifyApi]);

  // キー入力ハンドリング
  useInput((input, key) => {
    if (input === 'q') process.exit(0);
    if (input === 'n') spotifyApi.skipToNext();
    if (input === 'p') spotifyApi.skipToPrevious();
    if (input === ' ') {
      if (playback && playback.is_playing) {
        spotifyApi.pause();
      } else {
        spotifyApi.play();
      }
    }
    if (input === '/') setMode('search');
    if (key.escape) setMode('info');
  });

  const handleSearch = async (value) => {
    try {
      const data = await spotifyApi.searchArtists(value);
      setArtists(data.body.artists.items.map(a => ({ label: a.name, value: a.uri })));
    } catch (err) {
      setArtists([{ label: 'Error searching artists', value: 'error' }]);
    }
  };

  const handleSelectArtist = async (item) => {
    if (item.value === 'error') return;
    // アーティストのトップトラックを再生する簡易実装
    const artistId = item.value.split(':')[2];
    const topTracks = await spotifyApi.getArtistTopTracks(artistId, 'JP');
    const uris = topTracks.body.tracks.map(t => t.uri);
    await spotifyApi.play({ uris });
    setMode('info');
  };

  return (
    <Box flexDirection="column" padding={1} borderStyle="round" borderColor="green">
      <Box marginBottom={1}>
        <Text color="green" bold>Spotify TUI (React/Ink)</Text>
      </Box>

      {/* 再生情報 */}
      <Box flexDirection="column" marginBottom={1}>
        <Text bold underline>Currently Playing</Text>
        {playback && playback.item ? (
          <Box flexDirection="column" paddingLeft={1}>
            <Text color="cyan">{playback.item.name}</Text>
            <Text color="gray">by {playback.item.artists.map(a => a.name).join(', ')}</Text>
            <Text>Volume: {playback.device.volume_percent}% [{playback.is_playing ? 'Playing' : 'Paused'}]</Text>
          </Box>
        ) : (
          <Text color="yellow">No active playback. Start Spotify on any device.</Text>
        )}
      </Box>

      {/* 検索・操作 */}
      <Box flexDirection="column">
        {mode === 'search' ? (
          <Box flexDirection="column">
            <Box>
              <Text color="magenta">Search Artist: </Text>
              <TextInput value={query} onChange={setQuery} onSubmit={handleSearch} />
            </Box>
            {artists.length > 0 && (
              <Box marginTop={1}>
                <SelectInput items={artists} onSelect={handleSelectArtist} />
              </Box>
            )}
          </Box>
        ) : (
          <Box flexDirection="column">
            <Text color="gray">Commands:</Text>
            <Text> [/] Search   [space] Play/Pause   [n] Next   [p] Prev   [q] Quit</Text>
          </Box>
        )}
      </Box>
    </Box>
  );
};

export const startTui = (spotifyApi) => {
  render(<TuiApp spotifyApi={spotifyApi} />);
};
