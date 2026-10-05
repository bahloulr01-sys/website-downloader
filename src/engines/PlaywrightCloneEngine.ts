import { CloneEngine } from './CloneEngine';
import { chromium, BrowserContext, Page as PlaywrightPage } from 'playwright';
import { PrismaClient } from '@prisma/client';

import { activeSessions } from '../auth/SessionManager';

const prisma = new PrismaClient();

export class PlaywrightCloneEngine extends CloneEngine {
  private context: BrowserContext | null = null;
  private isCancelled: boolean = false;
  private sessionId?: string;

  constructor(jobId: string, projectId: string, startUrl: string, sessionId?: string) {
    super(jobId, projectId, startUrl);
    this.sessionId = sessionId;
  }

  async start(): Promise<void> {
    try {
      await prisma.cloneJob.update({
        where: { id: this.jobId },
        data: { status: 'LAUNCHING_BROWSER', currentStep: 'Launching browser...', progress: 5 }
      });

      let page: PlaywrightPage;
      let browserToClose = false;

      if (this.sessionId && activeSessions[this.sessionId]) {
        this.context = activeSessions[this.sessionId].context;
        // Don't close the shared browser immediately if we might need it later,
        // but for this job's scope we just use its context.
      } else {
        const browser = await chromium.launch({ headless: true });
        this.context = await browser.newContext();
        browserToClose = true;
      }
      
      if (this.isCancelled) {
        if (browserToClose && this.context) {
          await this.context.browser()?.close();
        }
        return;
      }

      await prisma.cloneJob.update({
        where: { id: this.jobId },
        data: { status: 'DISCOVERING', currentStep: 'Discovering pages...', progress: 10 }
      });

      const page = await this.context.newPage();
      await page.goto(this.startUrl, { waitUntil: 'networkidle' });

      // Save screenshot
      const screenshotBuffer = await page.screenshot({ fullPage: true });
      // TODO: Save screenshotBuffer to storage
      
      const html = await page.content();
      
      await prisma.page.create({
        data: {
          projectId: this.projectId,
          url: this.startUrl,
          path: '/',
          title: await page.title(),
          status: 'COMPLETED',
          html: html,
        }
      });

      await prisma.cloneJob.update({
        where: { id: this.jobId },
        data: { status: 'COMPLETED', currentStep: 'Done', progress: 100, completedAt: new Date(), pagesCompleted: 1 }
      });

      if (browserToClose && this.context) {
        await this.context.browser()?.close();
      }
    } catch (error) {
      await prisma.cloneJob.update({
        where: { id: this.jobId },
        data: { status: 'FAILED', error: (error as Error).message }
      });
    }
  }

  async cancel(): Promise<void> {
    this.isCancelled = true;
    if (this.context) {
      await this.context.browser()?.close();
    }
    await prisma.cloneJob.update({
      where: { id: this.jobId },
      data: { status: 'CANCELLED' }
    });
  }
}
