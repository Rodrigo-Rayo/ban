const URL = 'https://yxaurffzwtqsckfmnzdj.supabase.co';
const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl4YXVyZmZ6d3Rxc2NrZm1uemRqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY3MTE2ODIsImV4cCI6MjA5MjI4NzY4Mn0.GUbfyBpaP8W_LFIT9IfMjuszgw-J87ANhOAJY8Tpj1E';
const h = { apikey: KEY, Authorization: `Bearer ${KEY}` };

for (const t of ['musicians','bands','events','teachers','rehearsal_spaces','venues']) {
  const res = await fetch(`${URL}/rest/v1/${t}?limit=1`, { headers: h });
  const data = await res.json();
  const cols = data[0] ? Object.keys(data[0]).join(', ') : '(sin filas — probe con HEAD)';
  console.log(`\n${t}:\n  cols: ${cols}`);
  if (data.code) console.log('  error:', data.message);
}
