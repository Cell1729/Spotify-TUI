import SpotifyWebApi from 'spotify-web-api-node';
import { saveConfig } from './config.js';
import open from 'open';
import http from 'http';
import { parse } from 'url';

/**
 * Spotify API のセットアップと認証
 */
export async function getSpotifyClient(config) {
  const spotifyApi = new SpotifyWebApi({
    clientId: config.clientId,
    clientSecret: config.clientSecret,
    redirectUri: config.redirectUri
  });

  if (config.refreshToken) {
    spotifyApi.setRefreshToken(config.refreshToken);
    const data = await spotifyApi.refreshAccessToken();
    spotifyApi.setAccessToken(data.body['access_token']);
    return spotifyApi;
  }

  // 認証が必要な場合（ブラウザを開く）
  return new Promise((resolve, reject) => {
    const scopes = [
      'user-read-playback-state',
      'user-modify-playback-state',
      'user-read-currently-playing',
      'streaming',
      'user-read-email',
      'user-read-private',
      'user-follow-read',
      'playlist-read-private',
      'playlist-read-collaborative'
    ];
    const authorizeURL = spotifyApi.createAuthorizeURL(scopes);

    console.log('認証のためにブラウザを開きます...');
    open(authorizeURL);

    // コールバックを待機するサーバーを一時的に立てる
    const server = http.createServer(async (req, res) => {
      const query = parse(req.url, true).query;
      if (query.code) {
        res.end('Authentication complete. Please close this window and return to the terminal.');
        server.close();

        try {
          const data = await spotifyApi.authorizationCodeGrant(query.code);
          const accessToken = data.body['access_token'];
          const refreshToken = data.body['refresh_token'];

          spotifyApi.setAccessToken(accessToken);
          spotifyApi.setRefreshToken(refreshToken);

          // config に保存
          config.accessToken = accessToken;
          config.refreshToken = refreshToken;
          saveConfig(config);

          resolve(spotifyApi);
        } catch (err) {
          reject(err);
        }
      }
    }).listen(8888);
  });
}

/**
 * フォロー中のアーティストをすべて取得
 */
export async function getFollowedArtists(spotifyApi) {
  const data = await spotifyApi.getFollowedArtists({ limit: 50 });
  return data.body.artists.items;
}

/**
 * ユーザーのプレイリストをすべて取得
 */
export async function getUserPlaylists(spotifyApi) {
  const data = await spotifyApi.getUserPlaylists();
  return data.body.items;
}

/**
 * プレイリストのトラックを取得
 */
export async function getPlaylistTracks(spotifyApi, playlistId) {
  const data = await spotifyApi.getPlaylistTracks(playlistId);
  return data.body.items.map(item => ({
    ...item.track,
    playlistId
  }));
}

/**
 * アーティストのトップトラックを取得
 */
export async function getArtistTopTracks(spotifyApi, artistId) {
  const data = await spotifyApi.getArtistTopTracks(artistId, 'JP');
  return data.body.tracks;
}

/**
 * アーティストのアルバムを取得
 */
export async function getArtistAlbums(spotifyApi, artistId) {
  const data = await spotifyApi.getArtistAlbums(artistId, { limit: 20 });
  return data.body.items;
}

/**
 * アルバムのトラックを取得
 */
export async function getAlbumTracks(spotifyApi, albumId) {
  const data = await spotifyApi.getAlbumTracks(albumId);
  return data.body.items;
}

/**
 * シャッフル再生のトグル
 */
export async function setShuffle(spotifyApi, state) {
  return await spotifyApi.setShuffle(state);
}

/**
 * 再生デバイスの切り替え
 */
export async function transferPlayback(spotifyApi, deviceId) {
  return await spotifyApi.transferMyPlayback([deviceId]);
}
