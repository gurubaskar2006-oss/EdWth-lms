/**
 * Lumina LMS - Execution Concurrency Queue
 * 6th Civilians Corporation
 *
 * Implements a bounded concurrency queue for untrusted code execution requests.
 * Prevents CPU/memory thrashing under heavy concurrent student load (e.g., 500+ users).
 */

import { executeIsolatedCode } from './pistonService.js';

// ─── Configurable via environment variables ───────────────────────────────────
// These defaults match the previously hardcoded values.
// Production operators should tune these based on load testing.
const MAX_CONCURRENT_JOBS = parseInt(process.env.CODE_QUEUE_CONCURRENCY || '5',   10);
const MAX_QUEUE_LENGTH    = parseInt(process.env.CODE_QUEUE_MAX_PENDING  || '300', 10);
const MAX_QUEUE_WAIT_MS   = parseInt(process.env.CODE_QUEUE_WAIT_MS      || '20000', 10);

class ExecutionQueue {
  constructor() {
    this.activeJobs = 0;
    this.queue = [];
    this.totalProcessed = 0;
    this.totalRejected = 0;
  }

  /**
   * Enqueues a code execution job.
   * Returns a promise resolving with the execution result.
   */
  async enqueue(jobPayload) {
    // Check queue capacity limit
    if (this.queue.length >= MAX_QUEUE_LENGTH) {
      this.totalRejected++;
      const err = new Error('Execution queue is at capacity (300 requests waiting). Please retry in a moment.');
      err.status = 429;
      err.code = 'QUEUE_SATURATED';
      throw err;
    }

    return new Promise((resolve, reject) => {
      const queueItem = {
        payload: jobPayload,
        resolve,
        reject,
        enqueuedAt: Date.now(),
        timeoutHandle: null
      };

      // Set timeout for how long a job can remain unserved in the queue
      queueItem.timeoutHandle = setTimeout(() => {
        const idx = this.queue.indexOf(queueItem);
        if (idx !== -1) {
          this.queue.splice(idx, 1);
          this.totalRejected++;
          const timeoutErr = new Error('Execution request timed out waiting in the queue.');
          timeoutErr.status = 504;
          timeoutErr.code = 'QUEUE_TIMEOUT';
          reject(timeoutErr);
        }
      }, MAX_QUEUE_WAIT_MS);

      this.queue.push(queueItem);
      this.processNext();
    });
  }

  /**
   * Processes the next job in the queue if capacity is available
   */
  async processNext() {
    if (this.activeJobs >= MAX_CONCURRENT_JOBS || this.queue.length === 0) {
      return;
    }

    const job = this.queue.shift();
    if (!job) return;

    // Clear queue wait timeout
    if (job.timeoutHandle) {
      clearTimeout(job.timeoutHandle);
    }

    this.activeJobs++;

    try {
      const result = await executeIsolatedCode(job.payload);
      this.totalProcessed++;
      job.resolve(result);
    } catch (err) {
      this.totalProcessed++;
      job.reject(err);
    } finally {
      this.activeJobs--;
      // Continuously process remaining queue
      setImmediate(() => this.processNext());
    }
  }

  /**
   * Returns live queue telemetry for observability & monitoring
   */
  getStats() {
    return {
      activeWorkers: this.activeJobs,
      queuedJobs: this.queue.length,
      maxConcurrency: MAX_CONCURRENT_JOBS,
      maxQueueLength: MAX_QUEUE_LENGTH,
      totalProcessed: this.totalProcessed,
      totalRejected: this.totalRejected
    };
  }

  /**
   * Drain queue on server shutdown
   */
  drain() {
    while (this.queue.length > 0) {
      const item = this.queue.shift();
      if (item.timeoutHandle) clearTimeout(item.timeoutHandle);
      const err = new Error('Server shutting down: Execution aborted.');
      err.status = 503;
      item.reject(err);
    }
  }
}

export const executionQueue = new ExecutionQueue();
export default executionQueue;
