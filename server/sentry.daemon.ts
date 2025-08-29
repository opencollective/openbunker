import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: 'https://20a6f8aec66a83de5a43a3230cbf3a90@o4509922142191616.ingest.de.sentry.io/4509922143633488',

  // Define how likely traces are sampled. Adjust this value in production, or use tracesSampler for greater control.
  tracesSampleRate: 1,

  // Enable logs to be sent to Sentry
  enableLogs: true,

  // Setting this option to true will print useful information to the console while you're setting up Sentry.
  debug: false,
  integrations: [Sentry.prismaIntegration()],
});
