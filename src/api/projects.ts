import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { Queue } from 'bullmq';

const prisma = new PrismaClient();
const cloneQueue = new Queue('clone', { connection: { host: 'localhost', port: 6379 } });
const router = Router();

// GET /api/projects
router.get('/', async (req, res) => {
  const projects = await prisma.project.findMany();
  res.json(projects);
});

// POST /api/projects
router.post('/', async (req, res) => {
  const { name, sourceUrl, userId } = req.body;
  const project = await prisma.project.create({
    data: { name, sourceUrl, userId, status: 'QUEUED' }
  });
  res.json(project);
});

// POST /api/projects/:id/clone
router.post('/:id/clone', async (req, res) => {
  const { id } = req.params;
  const project = await prisma.project.findUnique({ where: { id } });
  
  if (!project) return res.status(404).json({ error: 'Project not found' });

  const job = await prisma.cloneJob.create({
    data: { projectId: id, status: 'QUEUED', currentStep: 'Added to queue' }
  });

  await cloneQueue.add('clone-website', { jobId: job.id, projectId: id, url: project.sourceUrl });

  res.json(job);
});

export default router;
