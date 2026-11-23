'use strict';
// A tiny stand-in for Supabase's PostgREST RPC endpoint, backed by PGlite.
// Used by the end-to-end test and for local development of the leaderboard:
//   npm i --no-save @electric-sql/pglite && node test/fake-supabase.js
const http = require('http');
const fs = require('fs');
const path = require('path');

async function startFakeSupabase(port = 0) {
  const { PGlite } = require('@electric-sql/pglite');
  const { pgcrypto } = require('@electric-sql/pglite/contrib/pgcrypto');
  const db = new PGlite({ extensions: { pgcrypto } });
  await db.exec('create role anon; create role authenticated;');
  await db.exec(fs.readFileSync(path.join(__dirname, '..', 'supabase', 'schema.sql'), 'utf8'));

  const SIGS = {
    ccw_create_board: ['board_name', 'owner_name'],
    ccw_join_board: ['code', 'member_name'],
    ccw_upsert_usage: ['p_member_id', 'p_secret', 'rows'],
    ccw_leave_board: ['p_member_id', 'p_secret'],
  };

  const server = http.createServer((req, res) => {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', async () => {
      const m = req.url.match(/^\/rest\/v1\/rpc\/(\w+)$/);
      const send = (code, obj) => {
        res.writeHead(code, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(obj));
      };
      if (!m || !req.headers.apikey) return send(401, { message: 'No API key found in request' });
      const fn = m[1];
      const args = JSON.parse(body || '{}');
      try {
        if (fn === 'ccw_leaderboard') {
          const r = await db.query('select * from public.ccw_leaderboard($1, $2)', [args.code, args.since]);
          return send(200, r.rows);
        }
        const names = SIGS[fn];
        if (!names) return send(404, { message: `Could not find the function public.${fn} in the schema cache` });
        const params = names.map((n) => (n === 'rows' ? JSON.stringify(args[n]) : args[n]));
        const ph = names.map((n, i) => `$${i + 1}${n === 'rows' ? '::jsonb' : ''}`).join(', ');
        const r = await db.query(`select public.${fn}(${ph}) as r`, params);
        send(200, r.rows[0].r);
      } catch (e) {
        send(400, { message: e.message });
      }
    });
  });
  await new Promise((r) => server.listen(port, '127.0.0.1', r));
  return { server, db, url: `http://127.0.0.1:${server.address().port}` };
}

module.exports = { startFakeSupabase };

if (require.main === module) {
  startFakeSupabase(Number(process.argv[2] || 54321)).then(({ url }) => console.log(`Fake Supabase on ${url} (key: anything)`));
}
