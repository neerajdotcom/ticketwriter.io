# Feedback → Jira Tickets

Converts messy, multi-topic producer/client feedback into clean, individual Jira-style ticket cards using Claude. Built for an iGaming art/dev co-development studio workflow.

- `index.html` — static frontend (dark editorial UI, amber accents, IBM Plex Mono + Inter)
- `functions/api/generate.js` — Cloudflare Pages Function that proxies requests to the Claude API server-side, so your API key never reaches the browser

## Deploy (Cloudflare Pages — free, no card required)

1. Create a new GitHub repo and push this folder's contents to it.
2. Go to https://dash.cloudflare.com → **Workers & Pages** → **Create** → **Pages** → **Connect to Git**.
3. Select your new repo. Leave build settings as default (no build command, output directory = `/`).
4. Deploy.
5. Go to your new Pages project → **Settings** → **Environment variables** → add:
   - `ANTHROPIC_API_KEY` = your Anthropic API key
   - Apply to both **Production** and **Preview**.
6. Redeploy (Settings → Deployments → retry latest, or just push a new commit) so the function picks up the env var.
7. Visit the `*.pages.dev` URL Cloudflare gives you — that's your live tool.

Cloudflare's free tier for Pages + Pages Functions does not require a credit card and won't auto-bill you.

## Local testing

You can preview the static frontend by opening `index.html` directly, but the **Generate** button won't work without the Pages Function running. To test the function locally, install Wrangler:

```
npm install -g wrangler
wrangler pages dev . --binding ANTHROPIC_API_KEY=sk-ant-...
```

Then open the local URL Wrangler prints.
