export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/ingest' && request.method === 'POST') {
      const { datasetName, sourceUrl, modality, labels } = await request.json();

      if (!datasetName || !sourceUrl || !modality) {
        return new Response(JSON.stringify({ error: 'Missing required fields' }), { status: 400 });
      }

      await env.D1.prepare(
        `INSERT INTO dataset_jobs (dataset_name, source_url, modality, labels, status, created_at) 
         VALUES (?, ?, ?, ?, 'pending', datetime('now'))`
      ).bind(datasetName, sourceUrl, modality, JSON.stringify(labels)).run();

      await fetch('https://inn.gs/e/' + env.INNGEST_EVENT_KEY, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'dataset/ingest',
          data: { datasetName, sourceUrl, modality },
        }),
      });

      return new Response(JSON.stringify({ success: true, message: 'Dataset ingestion queued' }));
    }

    return new Response('Not found', { status: 404 });
  },
};
