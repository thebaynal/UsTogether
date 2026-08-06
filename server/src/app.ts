import cors from 'cors';
import express from 'express';
import { memoriesRouter } from './routes/memories';
import { workspacesRouter } from './routes/workspaces';

export function createApp() {
  const app = express();

  app.use(cors({ origin: 'http://localhost:5173', credentials: true }));
  app.use(express.json());

  app.get('/api/health', (_request, response) => {
    response.json({ ok: true });
  });

  app.use('/api/memories', memoriesRouter);
  app.use('/api/workspaces', workspacesRouter);

  return app;
}
