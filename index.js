import { program } from 'commander';
import { loadConfig, saveConfig } from './lib/config.js';
import { getSpotifyClient } from './lib/spotify.js';
import { startTui } from './lib/tui.jsx';

async function main() {
  const config = await loadConfig();
  const spotifyApi = await getSpotifyClient(config);

  program
    .version('1.0.0')
    .description('Spotify TUI/CLI controller');

  program
    .option('-i, --interactive', '起動 Spotify TUI インタラクティブモード')
    .action(async (options) => {
      if (options.interactive) {
        await startTui(spotifyApi, config.keybindings);
        return;
      }
    });

  program
    .command('next')
    .description('次の曲を再生')
    .action(async () => {
      await spotifyApi.skipToNext();
      console.log('Skipped to next track');
    });

  program
    .command('previous')
    .description('前の曲を再生')
    .action(async () => {
      await spotifyApi.skipToPrevious();
      console.log('Skipped to previous track');
    });

  const vlm = program.command('vlm').description('音量調整');

  vlm
    .command('up [step]')
    .description('音量を上げる')
    .action(async (step) => {
      const current = await spotifyApi.getMyCurrentPlaybackState();
      const volume = current.body.device.volume_percent;
      const newVolume = Math.min(100, volume + (parseInt(step) || 10));
      await spotifyApi.setVolume(newVolume);
      console.log(`Volume: ${newVolume}%`);
    });

  vlm
    .command('dw [step]')
    .description('音量を下げる')
    .action(async (step) => {
      const current = await spotifyApi.getMyCurrentPlaybackState();
      const volume = current.body.device.volume_percent;
      const newVolume = Math.max(0, volume - (parseInt(step) || 10));
      await spotifyApi.setVolume(newVolume);
      console.log(`Volume: ${newVolume}%`);
    });

  program.parse(process.argv);
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
