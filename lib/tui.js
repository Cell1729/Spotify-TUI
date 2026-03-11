const blessed = require('blessed');
const contrib = require('blessed-contrib');

/**
 * TUI モードの起動
 */
async function startTui(spotifyApi) {
  const screen = blessed.screen({
    smartCSR: true,
    title: 'Spotify TUI'
  });

  const grid = new contrib.grid({ rows: 12, cols: 12, screen: screen });

  // 現在の再生情報表示
  const playbackBox = grid.set(0, 0, 4, 12, blessed.box, {
    label: ' Now Playing ',
    content: 'Loading...',
    border: { type: 'line' },
    style: { border: { fg: '#1DB954' } }
  });

  // アーティスト検索入力
  const searchInput = grid.set(4, 0, 2, 8, blessed.textbox, {
    label: ' Search Artist (Press /) ',
    keys: true,
    mouse: true,
    border: { type: 'line' }
  });

  // 検索結果リスト
  const artistList = grid.set(6, 0, 6, 12, blessed.list, {
    label: ' Results ',
    keys: true,
    mouse: true,
    border: { type: 'line' },
    style: { selected: { bg: '#1DB954', fg: 'white' } }
  });

  // ヘルプメッセージ
  grid.set(4, 8, 2, 4, blessed.box, {
    label: ' Help ',
    content: 'q: Quit\nn: Next\np: Prev\nspace: Play/Pause',
    border: { type: 'line' }
  });

  // キーバインド
  screen.key(['q', 'C-c'], () => process.exit(0));

  screen.key(['/'], () => {
    searchInput.focus();
    screen.render();
  });

  searchInput.on('submit', async (value) => {
    if (!value) return;
    artistList.setItems(['Searching...']);
    screen.render();

    try {
      const data = await spotifyApi.searchArtists(value);
      const artists = data.body.artists.items;
      artistList.setItems(artists.map(a => a.name));
      artistList.artists = artists; // 保存しておく
    } catch (err) {
      artistList.setItems(['Error searching artists']);
    }
    screen.render();
  });

  // アーティスト選択時の処理
  artistList.on('select', async (item, index) => {
    const artist = artistList.artists[index];
    if (!artist) return;
    
    // 単純化のため、ここではトップトラックを全曲再生する例
    const topTracks = await spotifyApi.getArtistTopTracks(artist.id, 'JP');
    const uris = topTracks.body.tracks.map(t => t.uri);
    await spotifyApi.play({ uris });
    
    updatePlayback();
  });

  // 再生情報の更新ループ
  async function updatePlayback() {
    try {
      const state = await spotifyApi.getMyCurrentPlaybackState();
      if (state.body && state.body.item) {
        const item = state.body.item;
        playbackBox.setContent(`Song: ${item.name}\nArtist: ${item.artists.map(a => a.name).join(', ')}\nVolume: ${state.body.device.volume_percent}%`);
      } else {
        playbackBox.setContent('No active playback found. Open Spotify on any device.');
      }
    } catch (err) {
      playbackBox.setContent('Error fetching playback state.');
    }
    screen.render();
  }

  setInterval(updatePlayback, 3000);
  updatePlayback();

  screen.render();
}

module.exports = { startTui };
