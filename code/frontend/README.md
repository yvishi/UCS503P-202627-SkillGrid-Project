This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Deploying the open skill catalog

The skill catalog moves self-ratings out of `Profile.skillRatings` into `skills` / `user_skills` tables. Do these in order against the production database (the `.env` database used for development has already been migrated and seeded):

1. Pre-check: `SELECT count(*) FROM profiles WHERE jsonb_typeof("skillRatings") <> 'object';` must return 0.
2. `npx prisma migrate deploy`
3. `npx prisma db seed` (safe to re-run; keeps admin-added aliases)
4. `npx tsx prisma/scripts/verify-skill-migration.ts` must print `OK`.
5. Set `ADMIN_EMAILS` (comma-separated) in the Vercel environment.
6. Only then merge/deploy the app code. The old code keeps working on the migrated schema; the new code needs the tables and the seeded catalog.
7. Follow-up once verified in production: drop `Profile.skillRatings` with a new migration and delete `prisma/scripts/verify-skill-migration.ts`.
