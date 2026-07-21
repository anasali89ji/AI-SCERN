const SIGNAL_WORKER_URL = process.env.NEXT_PUBLIC_SIGNAL_WORKER_URL || 'https://signal.aiscern.com';
const SIGNAL_WORKER_API_KEY = process.env.SIGNAL_WORKER_API_KEY;

export async function queueDetectionJob(params: {
  jobId: string;
  modality: 'image' | 'audio' | 'video';
  sourceUrl: string;
  models: string[];
  useRAG: boolean;
  userId: string;
  webhookUrl?: string;
}): Promise<{ jobId: string; status: string }> {
  const response = await fetch(`${SIGNAL_WORKER_URL}/detect`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': SIGNAL_WORKER_API_KEY!,
    },
    body: JSON.stringify(params),
  });

  if (!response.ok) {
    throw new Error(`Signal worker error: ${response.status} ${response.statusText}`);
  }

  return await response.json();
}

export async function pollJobStatus(jobId: string, intervalMs = 2000): Promise<any> {
  return new Promise((resolve, reject) => {
    const poll = async () => {
      try {
        const response = await fetch(`${SIGNAL_WORKER_URL}/detect/${jobId}`, {
          headers: { 'X-API-Key': SIGNAL_WORKER_API_KEY! },
        });
        const data = await response.json();

        if (data.status === 'completed') {
          resolve(data);
        } else if (data.status === 'failed') {
          reject(new Error(data.error || 'Job failed'));
        } else {
          setTimeout(poll, intervalMs);
        }
      } catch (err) {
        reject(err);
      }
    };
    poll();
  });
}
