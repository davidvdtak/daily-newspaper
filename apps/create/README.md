# build-daily-reader

AWS Lambda that:
1. reads configurable RSS feeds,
2. asks OpenAI to select and rewrite a daily edition,
3. creates an e-ink newspaper PDF with PDFKit,
4. adds Sudoku + a word puzzle,
5. uploads the PDF to S3.

## Runtime
Node.js 22.x, architecture x86_64 or arm64.

## Environment
- `BUCKET` (required)
- `PREFIX` default ``
- `OPENAI_API_KEY` (required)
- `OPENAI_MODEL` default `gpt-5.6`
- `TIMEZONE` default `America/New_York`
- `NEWS_RSS_URLS` comma-separated RSS URLs (optional)
- `LOCAL_NEWS_RSS_URLS` comma-separated local RSS feeds (optional)
- `EDITION_DATE` optional `YYYY-MM-DD` override for testing
- `INCLUDE_PUZZLES` set to `true` to append puzzle and answer pages
- `PREVIEW_OUTPUT` local preview output path, default `preview/YYYY-MM-DD - Daily Newspaper.pdf`

The default RSS feeds are public New York Times feeds. This function uses feed metadata as an editorial signal and generates original summaries; it does not reproduce full NYT articles.

## Build deployment ZIP
```bash
npm install
npm run build
cd dist
zip -r ../build-daily-reader-deploy.zip index.mjs
```

## Local PDF Preview
Create `apps/create/.env` with `OPENAI_API_KEY` and any optional settings, then run:

```bash
npm run preview
```

Example with local coverage:

```bash
LOCAL_NEWS_RSS_URLS="https://example.com/local/rss.xml" npm run preview
```

Because `pdfkit`, `rss-parser`, and `openai` are bundled by esbuild, the deployment artifact is self-contained except for AWS SDK v3, which is provided by the Node.js Lambda runtime.

## Lambda settings
Recommended:
- Memory: 1024 MB
- Timeout: 120 seconds
- Ephemeral storage: 512 MB

## IAM
Needs `s3:PutObject` on `arn:aws:s3:::YOUR_BUCKET/*`.

## Trigger
EventBridge Scheduler every morning, e.g. 06:00 America/New_York.

## Important
OpenAI API usage has a cost. reMarkable is not involved in this Lambda.
