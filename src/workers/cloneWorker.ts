import { Worker } from 'bullmq';
import { PlaywrightCloneEngine } from '../engines/PlaywrightCloneEngine';

const worker = new Worker('clone', async job => {
  const { jobId, projectId, url, sessionId } = job.data;
  console.log(`[Worker] Processing job ${jobId} for project ${projectId}`);
  
  const engine = new PlaywrightCloneEngine(jobId, projectId, url, sessionId);
  await engine.start();
}, {
  connection: {
    host: 'localhost',
    port: 6379
  }
});

worker.on('completed', job => {
  console.log(`[Worker] Job ${job.id} has completed!`);
});

worker.on('failed', (job, err) => {
  console.log(`[Worker] Job ${job?.id} has failed with ${err.message}`);
});
