# docs/api/

Target layout for REST API reference docs:

```
api/
  v1/
    detect.md   # POST /api/v1/detect/{text,image,audio,video}
    scan.md     # scan history / status endpoints
    keys.md     # API key management (Pro/Enterprise)
  webhooks.md
```

Not written yet — this is a placeholder. The actual route handlers live in
`frontend/app/api/` and are the current source of truth for request/response
shapes until this is authored.
