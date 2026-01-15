import { NextRequest } from 'next/server';
import { EmailExtractor } from '@/lib/email-extractor';

export async function POST(req: NextRequest) {
    const { urls } = await req.json();

    if (!urls || !Array.isArray(urls)) {
        return new Response(JSON.stringify({ error: 'Invalid input. Expected array of URLs.' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    const extractor = new EmailExtractor();
    
    // Create a TransformStream to write SSE data
    const stream = new TransformStream();
    const writer = stream.writable.getWriter();
    const encoder = new TextEncoder();

    // Start processing in the background
    (async () => {
        try {
            const BATCH_SIZE = 10;
            const CONCURRENCY = 2;

            for (let i = 0; i < urls.length; i += BATCH_SIZE) {
                const batch = urls.slice(i, i + BATCH_SIZE);
                console.log(`Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(urls.length / BATCH_SIZE)}`);
                
                await extractor.init();
                
                for (let j = 0; j < batch.length; j += CONCURRENCY) {
                    const chunk = batch.slice(j, j + CONCURRENCY);
                    const promises = chunk.map(url => extractor.extractEmailsFromUrl(url));
                    
                    const results = await Promise.all(promises);
                    
                    for (const result of results) {
                        await writer.write(encoder.encode(`data: ${JSON.stringify(result)}\n\n`));
                    }
                }
                
                await extractor.close();
            }
            
            await writer.write(encoder.encode('event: end\ndata: "done"\n\n'));
            await writer.close();
        } catch (error: any) {
            console.error('Global Scraping error:', error);
            await writer.write(encoder.encode(`data: ${JSON.stringify({ error: error.message })}\n\n`));
            await writer.close();
            try { await extractor.close(); } catch(e) {}
        }
    })();

    return new Response(stream.readable, {
        headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
        },
    });
}
