import React, { useState, useEffect, useCallback } from 'react';
import { render, Box, Text, useInput, useStdout } from 'ink';
import TextInput from 'ink-text-input';
import SelectInput from 'ink-select-input';
import { getFollowedArtists, getUserPlaylists, transferPlayback, getArtistTopTracks, setShuffle, getArtistAlbums, getAlbumTracks } from './spotify.js';

const HelpModal = ({ columns, rows, keys }) => {
  const commands = [
    { key: keys.enterSearch + ' / ' + keys.focusSearch, desc: '検索モード（Insert Mode）を開始' },
    { key: 'Esc', desc: '検索モードを終了（Normal Mode へ）' },
    { key: `${keys.focusPlaylists} / ${keys.focusArtists} / ${keys.focusPlayer}`, desc: '各エリアへ直接ジャンプ（Normal Mode）' },
    { key: 'Tab', desc: '各カラムを順番にフォーカス' },
    { key: 'j / k (Arrow)', desc: 'リスト移動（Normal Mode）' },
    { key: 'Enter', desc: '選択アイテムを決定' },
    { key: 'Backspace', desc: '前のリストに戻る' },
    { key: keys.playPause === ' ' ? 'Space' : keys.playPause, desc: '再生 / 一時停止' },
    { key: keys.next + ' / ' + keys.previous, desc: '曲送り / 曲戻し' },
    { key: keys.shuffle, desc: 'シャッフル ON / OFF' },
    { key: keys.volumeUp + ' / ' + keys.volumeDown, desc: '音量 +/-' },
    { key: keys.help, desc: 'ヘルプ画面' },
    { key: keys.quit, desc: '終了' }
  ];

  return (
    <Box
      position="absolute"
      width={Math.min(75, columns - 4)}
      height={Math.min(24, rows - 4)}
      marginLeft={(columns - Math.min(75, columns - 4)) / 2}
      marginTop={(rows - Math.min(24, rows - 4)) / 2}
      flexDirection="column"
      borderStyle="double"
      borderColor="magenta"
      backgroundColor="black"
      paddingX={2}
      paddingY={1}
    >
      <Box justifyContent="center" marginBottom={1}>
        <Text bold color="magenta">-- KEYBINDINGS --</Text>
      </Box>
      {commands.map((cmd, i) => (
        <Box key={i}>
          <Text color="cyan" bold width={25}>{cmd.key}</Text>
          <Text color="white">: {cmd.desc}</Text>
        </Box>
      ))}
      <Box marginTop={1} justifyContent="center">
        <Text color="gray">Press '{keys.help}' or 'Esc' to close</Text>
      </Box>
    </Box>
  );
};

const TuiApp = ({ spotifyApi, keys }) => {
  const { stdout } = useStdout();
  const [dimensions, setDimensions] = useState({
    columns: stdout.columns,
    rows: stdout.rows
  });

  const [playback, setPlayback] = useState(null);
  const [playlists, setPlaylists] = useState([]);
  const [followedArtists, setFollowedArtists] = useState([]);
  const [devices, setDevices] = useState([]);
  const [searchResults, setSearchResults] = useState([]);
  const [history, setHistory] = useState([]); // 戻るための履歴
  const [focus, setFocus] = useState('left-playlists');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const [showHelp, setShowHelp] = useState(false);
  const [mode, setMode] = useState('NORMAL'); // 'NORMAL' | 'INSERT'
  const [skipNextAction, setSkipNextAction] = useState(false);

  useEffect(() => {
    if (statusMessage) {
      const timer = setTimeout(() => setStatusMessage(''), 5000);
      return () => clearTimeout(timer);
    }
  }, [statusMessage]);

  useEffect(() => {
    if (skipNextAction) {
      const timer = setTimeout(() => setSkipNextAction(false), 100);
      return () => clearTimeout(timer);
    }
  }, [skipNextAction]);

  useEffect(() => {
    const onResize = () => setDimensions({ columns: stdout.columns, rows: stdout.rows });
    stdout.on('resize', onResize);
    return () => stdout.off('resize', onResize);
  }, [stdout]);

  const fetchData = useCallback(async () => {
    try {
      const [p, a, d] = await Promise.all([
        getUserPlaylists(spotifyApi),
        getFollowedArtists(spotifyApi),
        spotifyApi.getMyDevices()
      ]);
      setPlaylists(p.map(item => ({ label: item.name, value: item.id, type: 'playlist' })));
      setFollowedArtists(a.map(item => ({ label: item.name, value: item.id, type: 'artist' })));
      setDevices(d.body.devices.map(item => ({ 
        label: `${item.is_active ? '● ' : '○ '}${item.name}`, 
        value: item.id, 
        type: 'device' 
      })));
    } catch (err) {}
  }, [spotifyApi]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    const timer = setInterval(async () => {
      try {
        const [playbackState, devicesState] = await Promise.all([
          spotifyApi.getMyCurrentPlaybackState(),
          spotifyApi.getMyDevices()
        ]);
        if (playbackState.body) setPlayback(playbackState.body);
        if (devicesState.body) {
          setDevices(devicesState.body.devices.map(item => ({ 
            label: `${item.is_active ? '● ' : '○ '}${item.name}`, 
            value: item.id, 
            type: 'device' 
          })));
        }
      } catch (err) {}
    }, 3000);
    return () => clearInterval(timer);
  }, [spotifyApi]);

  const execCommand = useCallback(async (action) => {
    try {
      await action();
      setStatusMessage('');
    } catch (err) {
      if (err.body?.error?.message?.includes('Restriction violated')) {
        setStatusMessage('Error: No active device found.');
      } else {
        setStatusMessage(`Error: ${err.message || 'Unknown error'}`);
      }
    }
  }, []);

  const renderVolume = (percent) => {
    const bars = 10;
    const filled = Math.round((percent / 100) * bars);
    return `[${'='.repeat(filled)}${'-'.repeat(bars - filled)}] ${percent}%`;
  };

  useInput((input, key) => {
    if (showHelp) {
      if (key.escape || input === keys.help) setShowHelp(false);
      return;
    }

    if (mode === 'INSERT') {
      if (key.escape) setMode('NORMAL');
      return;
    }

    if (key.backspace && focus === 'right-results' && history.length > 0) {
      const prev = history[history.length - 1];
      setSearchResults(prev.items);
      setSearchQuery(prev.query);
      setHistory(history.slice(0, -1));
      return;
    }

    if (input === keys.quit) {
      process.stdout.write('\x1b[?1049l');
      process.exit(0);
    }
    if (input === keys.help) { setShowHelp(true); return; }

    if (input === keys.enterSearch) { 
      setMode('INSERT'); 
      setFocus('right-search'); 
      setSkipNextAction(true);
      return; 
    }

    // エリアジャンプ (文字キー)
    if (input === keys.focusPlaylists) { setFocus('left-playlists'); setSkipNextAction(true); return; }
    if (input === keys.focusArtists) { setFocus('left-artists'); setSkipNextAction(true); return; }
    if (input === keys.focusPlayer) { setFocus('center'); setSkipNextAction(true); return; }
    if (input === keys.focusSearch) { setMode('INSERT'); setFocus('right-search'); setSkipNextAction(true); return; }

    if (key.tab) {
      const areas = ['left-playlists', 'left-artists', 'center', 'right-search'];
      const nextIndex = (areas.indexOf(focus) + 1) % areas.length;
      setFocus(areas[nextIndex]);
      setSkipNextAction(true);
      return;
    }

    if (input === keys.playPause) {
      playback?.is_playing ? execCommand(() => spotifyApi.pause()) : execCommand(() => spotifyApi.play());
      return;
    }
    if (input === keys.next) { execCommand(() => spotifyApi.skipToNext()); return; }
    if (input === keys.previous) { execCommand(() => spotifyApi.skipToPrevious()); return; }
    if (input === keys.volumeUp) { execCommand(() => spotifyApi.setVolume(Math.min(100, (playback?.device?.volume_percent || 50) + 10))); return; }
    if (input === keys.volumeDown) { execCommand(() => spotifyApi.setVolume(Math.max(0, (playback?.device?.volume_percent || 50) - 10))); return; }
    
    if (input === keys.shuffle) {
      const newState = !playback?.shuffle_state;
      execCommand(() => setShuffle(spotifyApi, newState));
      return;
    }
  });

  const handleSelect = async (item) => {
    if (showHelp || mode === 'INSERT' || skipNextAction) return;
    
    await execCommand(async () => {
      // プレイリストを選択
      if (item.type === 'playlist') {
        await spotifyApi.play({ context_uri: `spotify:playlist:${item.value}` });
      } 
      // アーティストを選択 -> オプションメニューを表示
      else if (item.type === 'artist') {
        const nextResults = [
          { label: '→ [Shuffle All Tracks]', value: item.value, type: 'artist-shuffle-all', artistName: item.label },
          { label: '→ [Popular Tracks]', value: item.value, type: 'artist-top-tracks-menu', artistName: item.label },
          { label: '→ [Albums]', value: item.value, type: 'artist-albums-menu', artistName: item.label }
        ];
        setSearchResults(nextResults);
        setSearchQuery(`Artist: ${item.label}`);
        setFocus('right-results');
        setHistory([]);
      } 
      // アーティスト：全曲シャッフル
      else if (item.type === 'artist-shuffle-all') {
        setStatusMessage(`Collecting tracks for ${item.artistName}...`);
        const albums = await getArtistAlbums(spotifyApi, item.value);
        let allTracks = [];
        // 最初の数枚のアルバムからのみ取得（負荷軽減のため）
        const targetAlbums = albums.slice(0, 10);
        for (const album of targetAlbums) {
          const tracks = await getAlbumTracks(spotifyApi, album.id);
          allTracks = allTracks.concat(tracks.map(t => t.uri));
          if (allTracks.length >= 100) break;
        }
        // シャッフルしてから再生
        const shuffled = allTracks.sort(() => Math.random() - 0.5);
        await setShuffle(spotifyApi, true);
        await spotifyApi.play({ uris: shuffled.slice(0, 50) });
      }
      // アーティスト：トップトラック一覧を表示
      else if (item.type === 'artist-top-tracks-menu') {
        setHistory([...history, { items: searchResults, query: searchQuery }]);
        const tracks = await getArtistTopTracks(spotifyApi, item.value);
        setSearchResults(tracks.map(t => ({ label: t.name, value: t.uri, type: 'track' })));
        setSearchQuery(`Artist: ${item.artistName} (Top Tracks)`);
      }
      // アーティスト：アルバム一覧を表示
      else if (item.type === 'artist-albums-menu') {
        setHistory([...history, { items: searchResults, query: searchQuery }]);
        const albums = await getArtistAlbums(spotifyApi, item.value);
        setSearchResults(albums.map(a => ({ label: `Album: ${a.name}`, value: a.id, type: 'album', albumName: a.name })));
        setSearchQuery(`Artist: ${item.artistName} (Albums)`);
      }
      // アルバムを選択 -> 楽曲リスト（と再生オプション）を表示
      else if (item.type === 'album') {
        setHistory([...history, { items: searchResults, query: searchQuery }]);
        const tracks = await getAlbumTracks(spotifyApi, item.value);
        const nextResults = [
          { label: '→ [Play Album All]', value: item.value, type: 'album-play-all', shuffle: false },
          { label: '→ [Shuffle Album All]', value: item.value, type: 'album-play-all', shuffle: true },
          ...tracks.map(t => ({ label: t.name, value: t.uri, type: 'track' }))
        ];
        setSearchResults(nextResults);
        setSearchQuery(`Album: ${item.albumName}`);
      }
      // アルバム全体再生
      else if (item.type === 'album-play-all') {
        await setShuffle(spotifyApi, item.shuffle);
        await spotifyApi.play({ context_uri: `spotify:album:${item.value}` });
      }
      // 楽曲を単体選択
      else if (item.type === 'track') {
        await spotifyApi.play({ uris: [item.value] });
      } 
      // デバイス切り替え
      else if (item.type === 'device') {
        await transferPlayback(spotifyApi, item.value);
        fetchData();
      }
    });
  };

  const handleSearch = async (val) => {
    try {
      const data = await spotifyApi.searchTracks(val);
      setSearchResults(data.body.tracks.items.map(t => ({ 
        label: `${t.name} - ${t.artists[0].name}`, 
        value: t.uri, 
        type: 'track' 
      })));
      setSearchQuery(`Search: ${val}`);
      setFocus('right-results');
      setMode('NORMAL');
      setHistory([]);
      setSkipNextAction(true);
    } catch (err) {
      setStatusMessage('Search failed.');
    }
  };

  return (
    <Box flexDirection="column" width={dimensions.columns} height={dimensions.rows}>
      <Box borderStyle="single" borderColor="cyan" paddingX={1} justifyContent="space-between">
        <Box>
           <Text bold color="green">Spotify TUI </Text>
           <Text color="yellow" bold>[{mode}]</Text>
        </Box>
        <Text color="gray">Focus: {focus} | [{keys.help}] Help</Text>
      </Box>

      <Box flexGrow={1}>
        <Box flexDirection="column" width="30%" borderStyle="single" borderColor={focus.startsWith('left') ? 'green' : 'gray'}>
          <Box flexDirection="column" height="50%" borderStyle="single" borderColor={focus === 'left-playlists' ? 'green' : 'gray'}>
            <Box paddingX={1} justifyContent="space-between">
               <Text bold underline color={focus === 'left-playlists' ? 'green' : 'white'}> Playlists </Text>
               <Text color="gray">[{keys.focusPlaylists}]</Text>
            </Box>
            <Box flexGrow={1} paddingX={1}>
              <SelectInput items={playlists} onSelect={handleSelect} isFocused={focus === 'left-playlists' && mode === 'NORMAL' && !showHelp} />
            </Box>
          </Box>
          <Box flexDirection="column" height="50%" borderStyle="single" borderColor={focus === 'left-artists' ? 'green' : 'gray'}>
            <Box paddingX={1} justifyContent="space-between">
               <Text bold underline color={focus === 'left-artists' ? 'green' : 'white'}> Artists </Text>
               <Text color="gray">[{keys.focusArtists}]</Text>
            </Box>
            <Box flexGrow={1} paddingX={1}>
              <SelectInput items={followedArtists} onSelect={handleSelect} isFocused={focus === 'left-artists' && mode === 'NORMAL' && !showHelp} />
            </Box>
          </Box>
        </Box>

        <Box flexDirection="column" width="40%" borderStyle="single" borderColor={focus === 'center' ? 'green' : 'gray'} paddingX={1}>
          <Box flexDirection="column" flexGrow={1} alignItems="center" justifyContent="center">
            <Box alignSelf="flex-end">
              <Text color="gray">[{keys.focusPlayer}]</Text>
            </Box>
            {playback?.item ? (
              <Box flexDirection="column" alignItems="center">
                <Text color="cyan" bold wrap="truncate-end">{playback.item.name}</Text>
                <Text color="gray" wrap="truncate-end">{playback.item.artists.map(a => a.name).join(', ')}</Text>
                <Box marginTop={1}>
                  <Text color="green" bold>{playback.is_playing ? '▶ PLAYING' : '|| PAUSED'}</Text>
                  <Text color="magenta" bold> {playback.shuffle_state ? ' [Shuffle ON]' : ''}</Text>
                </Box>
                <Box marginTop={1}>
                  <Text>{renderVolume(playback.device.volume_percent)}</Text>
                </Box>
                <Box marginTop={1} borderStyle="round" paddingX={1}>
                   <Text> [{keys.previous}] Prev | Space Play | [{keys.next}] Next </Text>
                </Box>
                <Box>
                   <Text color="gray">Shuffle: [{keys.shuffle}] Toggle </Text>
                </Box>
              </Box>
            ) : (
              <Text color="yellow">No active playback</Text>
            )}
          </Box>
          <Box flexDirection="column" height={8} borderStyle="single" borderColor={focus === 'center' ? 'green' : 'gray'}>
            <Text bold align="center"> Devices </Text>
            <Box flexGrow={1} paddingX={1}>
              <SelectInput items={devices} onSelect={handleSelect} isFocused={focus === 'center' && mode === 'NORMAL' && !showHelp} />
            </Box>
          </Box>
        </Box>

        <Box flexDirection="column" width="30%" borderStyle="single" borderColor={focus.startsWith('right') ? 'green' : 'gray'}>
          <Box paddingX={1} borderStyle="single" borderColor={focus === 'right-search' ? 'green' : 'gray'}>
            <Box justifyContent="space-between">
               <Text color="magenta" bold>{mode === 'INSERT' ? 'INSERT: ' : 'Search: '}</Text>
               <Text color="gray">[{keys.focusSearch}]</Text>
            </Box>
            <Box>
               {mode === 'INSERT' ? (
                 <TextInput value={searchQuery} onChange={setSearchQuery} onSubmit={handleSearch} focus={true} />
               ) : (
                 <Text color="gray">{searchQuery || `Press '${keys.enterSearch}' to search`}</Text>
               )}
            </Box>
          </Box>
          <Box flexGrow={1} paddingX={1} borderStyle="single" borderColor={focus === 'right-results' ? 'green' : 'gray'}>
            <Text bold underline color={focus === 'right-results' ? 'green' : 'white'}> Results </Text>
            <Box flexGrow={1}>
              {searchResults.length > 0 ? (
                <SelectInput items={searchResults} onSelect={handleSelect} isFocused={focus === 'right-results' && mode === 'NORMAL' && !showHelp} />
              ) : <Text color="gray">No results.</Text>}
            </Box>
          </Box>
        </Box>
      </Box>

      <Box height={1} paddingX={1} justifyContent="space-between">
        {statusMessage ? (
          <Text color="white" backgroundColor="red" bold> {statusMessage} </Text>
        ) : (
          <Text color="gray"> [NORMAL] {keys.enterSearch}: Search | Tab: Cycle | BS: Back | {keys.focusPlaylists}{keys.focusArtists}{keys.focusPlayer}{keys.focusSearch}: Jump </Text>
        )}
        <Text color="gray">
          {mode === 'INSERT' ? <Text color="yellow" bold>INSERT MODE: Type to search, Enter to exec, Esc to cancel</Text> : `Jump: ${keys.focusPlaylists}, ${keys.focusArtists}, ${keys.focusPlayer}, ${keys.focusSearch}`}
        </Text>
      </Box>

      {showHelp && <HelpModal columns={dimensions.columns} rows={dimensions.rows} keys={keys} />}
    </Box>
  );
};

export const startTui = (spotifyApi, keys) => {
  process.stdout.write('\x1b[?1049h');
  render(<TuiApp spotifyApi={spotifyApi} keys={keys} />);
};
