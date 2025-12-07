const express = require('express');
const ytdl = require('ytdl-core');
const app = express();
const port = process.env.PORT || 8080; // RenderのPrivate Serviceのポート

// 内部からアクセスされるストリーム取得エンドポイント
app.get('/download/:videoid', async (req, res) => {
  const videoId = req.params.videoid;
  const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;

  if (!ytdl.validateID(videoId)) {
    return res.status(400).send('Invalid video ID');
  }

  try {
    // 動画情報を取得し、最高のオーディオ・ビデオ品質を選択
    const info = await ytdl.getInfo(videoUrl);
    
    // ytdl-coreでストリームを作成し、クライアントへパイプする
    // これにより、このサーバーがyt-dlp/ytdlからのデータを直接受け取り、プロキシサーバーへ転送します。
    res.setHeader('Content-Type', 'video/mp4'); // ストリームのContent-Typeを設定

    ytdl(videoUrl, {
      quality: 'highestvideo', // 最高画質のビデオ
      filter: 'audioandvideo', // オーディオとビデオの両方を含む
    })
      .on('error', (err) => {
        console.error('ytdl stream error:', err.message);
        // ストリーム中にエラーが発生した場合、レスポンスヘッダーが設定されている可能性があるため注意
        if (!res.headersSent) {
          res.status(500).send('Failed to stream video.');
        }
      })
      .pipe(res); // 取得したストリームをクライアント(プロキシサーバー)へ転送

  } catch (error) {
    console.error('Error fetching video info:', error.message);
    res.status(500).send('Could not fetch video information.');
  }
});

app.listen(port, () => {
  console.log(`yt-dlp Core Server listening on port ${port}`);
});
