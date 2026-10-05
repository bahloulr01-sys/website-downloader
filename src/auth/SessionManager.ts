import { chromium, Browser, BrowserContext } from 'playwright';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// In-memory store for active browser sessions
export const activeSessions: Record<string, { browser: Browser, context: BrowserContext }> = {};

export class SessionManager {
  /**
   * Starts a visible browser session for the user to authenticate manually.
   */
  static async startInteractiveSession(projectId: string, url: string): Promise<string> {
    // We use headless: false so the user can interact with it on their local machine.
    const browser = await chromium.launch({ headless: false });
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.goto(url);

    // Save session metadata to database
    const session = await prisma.browserSession.create({
      data: {
        projectId,
        status: 'AUTHENTICATING',
        expiresAt: new Date(Date.now() + 30 * 60 * 1000) // 30 minutes
      }
    });

    // Store context in memory
    activeSessions[session.id] = { browser, context };

    // We leave the browser open for the user to log in.
    // The frontend will poll or the user will click "I'm logged in"
    // to trigger the verification step.
    
    return session.id;
  }

  /**
   * Verifies if the session is still active and changes status.
   */
  static async markAuthenticated(sessionId: string): Promise<boolean> {
    const sessionData = activeSessions[sessionId];
    if (!sessionData) return false;

    // We can do further heuristics here to verify login, but for now we trust the user confirmation
    await prisma.browserSession.update({
      where: { id: sessionId },
      data: { status: 'AUTHENTICATED' }
    });

    return true;
  }

  /**
   * Cleans up an active session.
   */
  static async closeSession(sessionId: string): Promise<void> {
    const sessionData = activeSessions[sessionId];
    if (sessionData) {
      await sessionData.browser.close();
      delete activeSessions[sessionId];
    }

    await prisma.browserSession.update({
      where: { id: sessionId },
      data: { status: 'CLOSED' }
    }).catch(() => {});
  }
}
