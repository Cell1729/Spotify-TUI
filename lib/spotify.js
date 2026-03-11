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
      'user-read-private'
    ];
    const authorizeURL = spotifyApi.createAuthorizeURL(scopes);

    console.log('認証のためにブラウザを開きます...');
    open(authorizeURL);

    // コールバックを待機するサーバーを一時的に立てる
    const server = http.createServer(async (req, res) => {
      const query = parse(req.url, true).query;
      if (query.code) {
        res.end('認証が完了しました！このウィンドウを閉じてターミナルに戻ってください。');
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
