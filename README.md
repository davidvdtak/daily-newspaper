# Daily NewsPaper Lambda bundle

Contains two independent Lambda codebases:

1. `create`
   - RSS -> OpenAI editorial rewrite -> newspaper PDF -> S3
2. `sync`
   - S3 ObjectCreated -> reMarkable Cloud -> keep newest 5

Recommended flow:

EventBridge Scheduler
  -> build-daily-reader
  -> S3 *.pdf
  -> S3 ObjectCreated
  -> sync-remarkable
  -> /Daily Newspaper on reMarkable

Each folder has its own README, package.json, IAM example, and build instructions.
