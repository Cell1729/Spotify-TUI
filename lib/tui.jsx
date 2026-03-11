import React, { useState, useEffect, useCallback } from 'react';
import { render, Box, Text, useInput, useStdout } from 'ink';
import TextInput from 'ink-text-input';
import SelectInput from 'ink-select-input';
import { getFollowedArtists, getUserPlaylists, transferPlayback } from './spotify.js';

const HelpModal = ({ columns, rows }) => {
  const commands = [
    { key: 'Tab', desc: 'カラム（左・中・右）間のフォーカス切り替え' },
    { key: 'j / k (Arrow)', desc: 'リスト内を移動' },
    { key: 'Enter', desc: '選択したアイテムを再生・切り替え' },
    { key: 'Space', desc: '再生 / 一時停止' },
    { key: 'n / p', desc: '次の曲 / 前の曲' },
    { key: '+ / -', desc: '音量を上げる / 下げる' },
    { key: '/', desc: '検索欄（右カラム）へジャンプ' },
    { key: '?', desc: 'ヘルプ画面の表示 / 非表示' },
    { key: 'q', desc: '終了' }
  ];

  return (
    <Box
      position="absolute"
      width={Math.min(70, columns - 4)}
      height={Math.min(18, rows - 4)}
      marginLeft={(columns - Math.min(70, columns - 4)) / 2}
      marginTop={(rows - Math.min(18, rows - 4)) / 2}
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
          <Text color="cyan" bold width={20}>{cmd.key}</Text>
          <Text color="white">: {cmd.desc}</Text>
        </Box>
      ))}
      <Box marginTop={1} justifyContent="center">
        <Text color="gray">Press '?' or 'Esc' to close</Text>
      </Box>
    </Box>
  );
};

const TuiApp = ({ spotifyApi }) => {
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
  const [focus, setFocus] = useState('left-playlists'); // 'left-playlists', 'left-artists', 'center', 'right-search', 'right-results'
  const [searchQuery, setSearchQuery] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const [showHelp, setShowHelp] = useState(false);

  // ステータスメッセージ管理
  useEffect(() => {
    if (statusMessage) {
      const timer = setTimeout(() => setStatusMessage(''), 5000);
      return () => clearTimeout(timer);
    }
  }, [statusMessage]);

  // リサイズ監視
  useEffect(() => {
    const onResize = () => setDimensions({ columns: stdout.columns, rows: stdout.rows });
    stdout.on('resize', onResize);
    return () => stdout.off('resize', onResize);
  }, [stdout]);

  // データ取得
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

  // 定期更新
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

  // 音量スライダー表示
  const renderVolume = (percent) => {
    const bars = 10;
    const filled = Math.round((percent / 100) * bars);
    return `[${'='.repeat(filled)}${'-'.repeat(bars - filled)}] ${percent}%`;
  };

  useInput((input, key) => {
    if (input === 'q') {
      process.stdout.write('\x1b[?1049l');
      process.exit(0);
    }
    if (input === '?') { setShowHelp(!showHelp); return; }
    if (key.escape && showHelp) { setShowHelp(false); return; }
    if (showHelp) return;

    // フォーカス移動 (Tab)
    if (key.tab) {
      const areas = ['left-playlists', 'left-artists', 'center', 'right-search'];
      const nextIndex = (areas.indexOf(focus) + 1) % areas.length;
      setFocus(areas[nextIndex]);
    }

    if (input === '/') setFocus('right-search');

    // 再生コントロール (どこにフォーカスしていても有効)
    if (input === ' ') playback?.is_playing ? execCommand(() => spotifyApi.pause()) : execCommand(() => spotifyApi.play());
    if (input === 'n') execCommand(() => spotifyApi.skipToNext());
    if (input === 'p') execCommand(() => spotifyApi.skipToPrevious());
    if (input === '+') execCommand(() => spotifyApi.setVolume(Math.min(100, (playback?.device?.volume_percent || 50) + 10)));
    if (input === '-') execCommand(() => spotifyApi.setVolume(Math.max(0, (playback?.device?.volume_percent || 50) - 10)));
  });

  const handleSelect = async (item) => {
    await execCommand(async () => {
      if (item.type === 'playlist') await spotifyApi.play({ context_uri: `spotify:playlist:${item.value}` });
      else if (item.type === 'artist') {
        const top = await spotifyApi.getArtistTopTracks(item.value, 'JP');
        await spotifyApi.play({ uris: top.body.tracks.map(t => t.uri) });
      } else if (item.type === 'track') await spotifyApi.play({ uris: [item.value] });
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
      setFocus('right-results');
    } catch (err) {
      setStatusMessage('Search failed.');
    }
  };

  return (
    <Box flexDirection="column" width={dimensions.columns} height={dimensions.rows}>
      {/* Header */}
      <Box borderStyle="single" borderColor="cyan" paddingX={1} justifyContent="space-between">
        <Text bold color="green">Spotify TUI</Text>
        <Text color="gray">Focus: {focus} | [?] Help</Text>
      </Box>

      {/* Main 3 Columns */}
      <Box flexGrow={1}>
        {/* Left: Lists (Playlists / Artists) */}
        <Box flexDirection="column" width="30%" borderStyle="single" borderColor={focus.startsWith('left') ? 'green' : 'gray'}>
          <Box flexDirection="column" height="50%" borderStyle="single" borderColor={focus === 'left-playlists' ? 'green' : 'gray'}>
            <Text bold underline color={focus === 'left-playlists' ? 'green' : 'white'}> Playlists </Text>
            <Box flexGrow={1} paddingX={1}>
              <SelectInput items={playlists} onSelect={handleSelect} isFocused={focus === 'left-playlists' && !showHelp} />
            </Box>
          </Box>
          <Box flexDirection="column" height="50%" borderStyle="single" borderColor={focus === 'left-artists' ? 'green' : 'gray'}>
            <Text bold underline color={focus === 'left-artists' ? 'green' : 'white'}> Artists </Text>
            <Box flexGrow={1} paddingX={1}>
              <SelectInput items={followedArtists} onSelect={handleSelect} isFocused={focus === 'left-artists' && !showHelp} />
            </Box>
          </Box>
        </Box>

        {/* Center: Player Controls */}
        <Box flexDirection="column" width="40%" borderStyle="single" borderColor={focus === 'center' ? 'green' : 'gray'} paddingX={1}>
          <Box flexDirection="column" flexGrow={1} alignItems="center" justifyContent="center">
            {playback?.item ? (
              <Box flexDirection="column" alignItems="center">
                <Text color="cyan" bold wrap="truncate-end">{playback.item.name}</Text>
                <Text color="gray" wrap="truncate-end">{playback.item.artists.map(a => a.name).join(', ')}</Text>
                
                <Box marginTop={1}>
                  <Text color="green" bold>{playback.is_playing ? '▶ PLAYING' : '|| PAUSED'}</Text>
                </Box>
                
                <Box marginTop={1}>
                  <Text>{renderVolume(playback.device.volume_percent)}</Text>
                </Box>

                <Box marginTop={1} borderStyle="round" paddingX={1}>
                   <Text> [p] Prev | [Space] Play/Pause | [n] Next </Text>
                </Box>
              </Box>
            ) : (
              <Text color="yellow">No active playback</Text>
            )}
          </Box>

          {/* Devices in Center */}
          <Box flexDirection="column" height={8} borderStyle="single" borderColor={focus === 'center' ? 'green' : 'gray'}>
            <Text bold align="center"> Devices </Text>
            <Box flexGrow={1} paddingX={1}>
              <SelectInput items={devices} onSelect={handleSelect} isFocused={focus === 'center' && !showHelp} />
            </Box>
          </Box>
        </Box>

        {/* Right: Search */}
        <Box flexDirection="column" width="30%" borderStyle="single" borderColor={focus.startsWith('right') ? 'green' : 'gray'}>
          <Box paddingX={1} borderStyle="single" borderColor={focus === 'right-search' ? 'green' : 'gray'}>
            <Text color="magenta" bold>Search: </Text>
            <TextInput 
              value={searchQuery} 
              onChange={setSearchQuery} 
              onSubmit={handleSearch} 
              focus={focus === 'right-search' && !showHelp}
            />
          </Box>
          <Box flexGrow={1} paddingX={1} borderStyle="single" borderColor={focus === 'right-results' ? 'green' : 'gray'}>
            <Text bold underline color={focus === 'right-results' ? 'green' : 'white'}> Results </Text>
            <Box flexGrow={1}>
              {searchResults.length > 0 ? (
                <SelectInput items={searchResults} onSelect={handleSelect} isFocused={focus === 'right-results' && !showHelp} />
              ) : (
                <Text color="gray">No results.</Text>
              )}
            </Box>
          </Box>
        </Box>
      </Box>

      {/* Footer / Status */}
      <Box height={1} paddingX={1} justifyContent="space-between">
        {statusMessage ? (
          <Text color="white" backgroundColor="red" bold> {statusMessage} </Text>
        ) : (
          <Text color="gray"> [Tab] Focus | [/] Search | [Space] Play/Pause | [n/p] Next/Prev | [+/-] Volume </Text>
        )}
        <Text color="gray">Node: {process.version}</Text>
      </Box>

      {showHelp && <HelpModal columns={dimensions.columns} rows={dimensions.rows} />}
    </Box>
  );
};

export const startTui = (spotifyApi) => {
  process.stdout.write('\x1b[?1049h');
  render(<TuiApp spotifyApi={spotifyApi} />);
};
