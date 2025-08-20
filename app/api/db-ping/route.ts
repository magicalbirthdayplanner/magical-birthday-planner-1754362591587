import { Client } from 'pg';

export async function GET() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  try {
    await client.connect();
    const { rows } = await client.query('select 1 as ok');
    return new Response(JSON.stringify(rows[0]), { status: 200 });
  } catch (e:any) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  } finally {
    try { await client.end(); } catch {}
  }
}