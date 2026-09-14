# SBGScheduler

An installer job scheduler for Solar Battery Group — built as part of an interview take-home.
See [clientBrief.md](./clientBrief.md) for the original client brief.

## Stack

TypeScript throughout, in an npm workspaces monorepo (`frontend`, `backend`, `shared`). React (Vite) +
Material UI frontend, Node.js/Express backend, Prisma ORM over PostgreSQL (Neon), Open-Meteo for weather +
geocoding, deployed to Vercel. ESLint (flat config) across all three workspaces.

## Development

```
npm install   # install all workspace dependencies
npm run dev   # run frontend, backend, and shared (watch build) concurrently
npm run build # build shared, then backend, then frontend
npm run lint  # lint all three workspaces
```

## Deployed link

https://sbg-scheduler-theta.vercel.app

## Repo

https://github.com/GlennSeymon/SBGScheduler

## License

MIT — see [LICENSE](./LICENSE).
