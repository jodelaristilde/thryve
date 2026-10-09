# Thryve.today sign-up site

- `/` is the sign-up form. The course dropdown comes from the admin page (it starts with ACLS, CNA, Phlebotomy and BLS).
- `/admin` is the admin page. Sign in with GitHub to edit courses and see sign-ups.

## Setup (about 15 minutes)

1. Put this folder in a GitHub repository.
2. In Vercel: Add New > Project > import that repository > Deploy.
3. In Vercel, open the project > Storage > Create Database > Upstash Redis (free plan). Connect it to the project.
4. On GitHub: Settings > Developer settings > OAuth Apps > New OAuth App.
   - Homepage URL: https://YOUR-SITE.vercel.app
   - Authorization callback URL: https://YOUR-SITE.vercel.app/api/auth/callback
   Then click "Generate a new client secret".
5. In Vercel: project > Settings > Environment Variables. Add:
   - GITHUB_CLIENT_ID = the client ID from step 4
   - GITHUB_CLIENT_SECRET = the client secret from step 4
   - ADMIN_GITHUB_USERS = your GitHub username (separate several with commas)
   - SESSION_SECRET = any long random text (30+ characters)
6. In Vercel: Deployments > the latest one > Redeploy.
7. Open https://YOUR-SITE.vercel.app/admin, sign in, and add your courses.
