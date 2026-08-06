import express from 'express';
import cors from 'cors';
import { memoriesRouter } from './routes/memories.js';
import { workspacesRouter } from './routes/workspaces.js';

export function createApp() {
  const app = express();

  const frontendOrigin = process.env.CORS_ORIGIN?.trim() || 'http://localhost:5173';

  app.use(
    cors({
      origin: frontendOrigin,
      credentials: true
    })
  );
  app.use(express.json({ limit: '20mb' }));

  app.get('/api/health', (_request, response) => {
    response.json({ ok: true });
  });

  app.use('/api/memories', memoriesRouter);
  app.use('/api/workspaces', workspacesRouter);

  return app;
}
