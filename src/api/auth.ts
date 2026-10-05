import { Router } from 'express';
import { SessionManager } from '../auth/SessionManager';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const router = Router();

// POST /api/projects/:id/auth-session
router.post('/:id/auth-session', async (req, res) => {
  const { id } = req.params;
  const project = await prisma.project.findUnique({ where: { id } });
  
  if (!project) return res.status(404).json({ error: 'Project not found' });

  try {
    const sessionId = await SessionManager.startInteractiveSession(id, project.sourceUrl);
    res.json({ sessionId, status: 'AUTHENTICATING' });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// POST /api/auth-session/:sessionId/confirm
router.post('/auth-session/:sessionId/confirm', async (req, res) => {
  const { sessionId } = req.params;
  
  const success = await SessionManager.markAuthenticated(sessionId);
  if (success) {
    res.json({ success: true, message: 'Authentication confirmed. You can now start the clone job.' });
  } else {
    res.status(400).json({ error: 'Session not found or expired.' });
  }
});

export default router;
