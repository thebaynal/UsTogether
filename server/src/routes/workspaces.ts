import { Router } from 'express';

const router = Router();

router.get('/', (_request, response) => {
  response.json({
    workspaces: [
      {
        id: 'workspace-demo',
        name: 'UsTogether Demo',
        partnerInviteCode: 'SUNSET-42',
        members: ['alex', 'sam']
      }
    ]
  });
});

export { router as workspacesRouter };
