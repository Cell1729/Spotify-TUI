import { program } from 'commander';
import { loadConfig, saveConfig } from './lib/config.js';
import { getSpotifyClient } from './lib/spotify.js';
import { startTui } from './lib/tui.jsx';

async function main() {
  const config = await loadConfig();
  const spotifyApi = await getSpotifyClient(config);

  program
    .version('1.0.0')
    .description('Spotify TUI/CLI controller')
    .option('-i, --interactive', '起動 Spotify TUI インタラクティブモード')
    .option('--play', '再生開始')
    .option('--stop', '停止（一時停止）')
    .option('--n', '次の曲へ')
    .option('--p', '前の曲へ')
    .action(async (options) => {
      if (options.interactive) {
        await startTui(spotifyApi, config.keybindings);
        return;
      }
      
      try {
        if (options.play) {
          await spotifyApi.play();
          console.log('▶ Playback started');
          return;
        }
        if (options.stop) {
          await spotifyApi.pause();
          console.log('|| Playback paused');
          return;
        }
        if (options.n) {
          await spotifyApi.skipToNext();
          console.log('⏭ Skipped to next track');
          return;
        }
        if (options.p) {
          await spotifyApi.skipToPrevious();
          console.log('⏮ Skipped to previous track');
          return;
        }

        // 引数がない場合はヘルプを表示
        if (Object.keys(options).length === 0) {
          program.help();
        }
      } catch (err) {
        if (err.body?.error?.message?.includes('Restriction violated')) {
          console.error('Error: No active device found. Please open Spotify on a device.');
        } else {
          throw err;
        }
      }
    });

  const v = program.command('v').description('音量調整');

  v.command('up [step]')
    .description('音量を上げる')
    .action(async (step) => {
      try {
        const current = await spotifyApi.getMyCurrentPlaybackState();
        const volume = current.body?.device?.volume_percent || 50;
        const newVolume = Math.min(100, volume + (parseInt(step) || 10));
        await spotifyApi.setVolume(newVolume);
        console.log(`🔊 Volume: ${newVolume}%`);
      } catch (err) {
        console.error('Error:', err.message);
      }
    });

  v.command('dw [step]')
    .description('音量を下げる')
    .action(async (step) => {
      try {
        const current = await spotifyApi.getMyCurrentPlaybackState();
        const volume = current.body?.device?.volume_percent || 50;
        const newVolume = Math.max(0, volume - (parseInt(step) || 10));
        await spotifyApi.setVolume(newVolume);
        console.log(`🔉 Volume: ${newVolume}%`);
      } catch (err) {
        console.error('Error:', err.message);
      }
    });

  program.parse(process.argv);
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
