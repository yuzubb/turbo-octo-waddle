const express = require('express');
const axios = require('axios');
const app = express();
const port = process.env.PORT || 10000; // Render Web Serviceのポート

// 環境変数からyt-dlp Private ServiceのURLを取得
// Renderの内部アドレス（サービス名:ポート）を設定する
const YTDLP_CORE_HOST = process.env.YTDLP_CORE_HOST; 

if (!YTDLP_CORE_HOST) {
  console.error("FATAL: YTDLP_CORE_HOST environment variable is not set!");
  process.exit(1);
}

// ユーザーがアクセスする公開エンドポイント
app.get('/stream/:videoid', async (req, res) => {
  const videoId = req.params.videoid;
  const internalUrl = `${YTDLP_CORE_HOST}/download/${videoId}`;

  console.log(`Proxying request for video ${videoId} to internal URL: ${internalUrl}`);

  try {
    // 内部yt-dlpサーバーへリクエストを転送
    const response = await axios({
      method: 'get',
      url: internalUrl,
      responseType: 'stream', // ストリームとしてレスポンスを受け取る
      // プロキシヘッダーを追加
      headers: {
        'X-Forwarded-For': req.ip,
        'X-Proxy-Host': req.hostname
      }
    });

    // yt-dlpサーバーからのレスポンスヘッダーをクライアントへコピー
    // Content-Type, Content-Lengthなどをコピー
    Object.keys(response.headers).forEach(key => {
      // 転送時に問題となるヘッダー（例: 接続関連）を除外
      if (!['connection', 'transfer-encoding', 'content-encoding'].includes(key.toLowerCase())) {
        res.setHeader(key, response.headers[key]);
      }
    });

    // yt-dlpサーバーからのストリームをユーザーへパイプ
    response.data.pipe(res);

    response.data.on('end', () => {
      console.log(`Successfully streamed video ${videoId} to client.`);
    });
    
  } catch (error) {
    if (error.response) {
      // 内部サーバーからのエラー応答をそのまま返す (例: Invalid video ID 400)
      res.status(error.response.status).send(error.response.data || 'Internal service error');
    } else {
      console.error('Proxy error:', error.message);
      res.status(500).send('Proxy failed to connect to core service.');
    }
  }
});

app.listen(port, () => {
  console.log(`Proxy Router Server listening on port ${port}`);
  console.log(`YTDLP Core Host: ${YTDLP_CORE_HOST}`);
});
