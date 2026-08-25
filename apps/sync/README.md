# sync-remarkable

AWS Lambda triggered by S3 `ObjectCreated` for the Daily Newspaper PDF.

It:
1. downloads the new PDF,
2. authenticates to reMarkable Cloud,
3. creates `/Daily Newspaper` if needed,
4. uploads and moves the PDF into that folder,
5. keeps the newest 5 editions and moves older editions to Trash.

This uses `rmapi-js`, an unofficial reverse-engineered reMarkable Cloud API. It can break if reMarkable changes its backend.

## Environment
- `REMARKABLE_TOKEN` required; generated reMarkable device token
- `REMARKABLE_FOLDER` default `Daily Newspaper`
- `KEEP_EDITIONS` default `5`

## First-time registration
Install dependencies locally:
```bash
npm install
```

Go to the reMarkable device-connect page, get the one-time 8-character code, then:
- https://my.remarkable.com/device/remarkable?showOtp=true

```bash
node register-device.mjs ABCDEFGH
```

Store the returned token as the Lambda environment variable `REMARKABLE_TOKEN`.

## Build deployment ZIP
```bash
npm install
npm run build
cd dist
zip -r ../sync-remarkable-deploy.zip index.mjs
```

## Lambda settings
Recommended:
- Node.js 22.x
- Memory: 512 MB
- Timeout: 60 seconds

## Trigger
S3 ObjectCreated event:
- bucket: same bucket used by build-daily-reader
- prefix: ``
- suffix: `.pdf`

## IAM
Needs:
- `s3:GetObject` for the PDF prefix

## Deletion behavior
Old editions are moved to reMarkable Trash rather than permanently purged.
