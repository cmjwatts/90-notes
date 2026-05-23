import PQueue from 'p-queue';

/**
 * One serial queue per meeting. Recall.ai webhook chunks for the same meeting
 * are processed strictly in order; different meetings run concurrently.
 */
const queues = new Map<string, PQueue>();

export function queueForMeeting(meetingId: string): PQueue {
  let q = queues.get(meetingId);
  if (!q) {
    q = new PQueue({ concurrency: 1 });
    queues.set(meetingId, q);
  }
  return q;
}

export function dropMeetingQueue(meetingId: string): void {
  const q = queues.get(meetingId);
  if (q) {
    q.clear();
    queues.delete(meetingId);
  }
}
