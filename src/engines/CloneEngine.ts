export abstract class CloneEngine {
  protected jobId: string;
  protected projectId: string;
  protected startUrl: string;

  constructor(jobId: string, projectId: string, startUrl: string) {
    this.jobId = jobId;
    this.projectId = projectId;
    this.startUrl = startUrl;
  }

  abstract start(): Promise<void>;
  abstract cancel(): Promise<void>;
}
