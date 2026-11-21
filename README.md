# DAHAB Café

A French/Arabic café website with a scroll-controlled WebGL cup, menu search, basket, WhatsApp ordering, and a password-protected menu editor.

## Source

- `public/`: pages, styles, images, menu seed data, and 3D animation.
- `worker/`: server routes, menu persistence, and admin authentication.
- `scripts/build.mjs`: builds the website and server into a Worker module.

## Build

With Node.js installed, run `npm run build`. The output is `dist/server/index.js`.

## Hosting

Deploy the generated module to a Cloudflare Worker with an R2 bucket bound as `BUCKET`. Saved menu changes and admin credentials live in the bucket and are not included in this source copy. `public/menu.json` supplies the initial menu when the bucket is empty.

Set `ADMIN_SETUP_TOKEN` as a server-side secret containing at least 32 random characters. Never put this secret in client code or commit it. On an HTTPS deployment, visit `/admin/setup`. The browser asks for username `admin` and the setup token as its password. Then create the administrator ID and password in the setup form. Existing administrator credentials cannot be replaced through setup. Remove the setup secret after creating the administrator. Normal admin access uses `/admin/login`.

This source copy has no hosting account attached. Configure hosting and storage before using the server-backed editor. Opening the HTML directly is not a complete application preview.

## Orders

The initial WhatsApp destination is the demonstration number `212695004456`. The administrator can change it in the editor. Customers review and send their prepared order in WhatsApp.
