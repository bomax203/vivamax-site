// VIVAMAX lead form -> Telegram
// Cloudflare Worker. Secrets (Settings -> Variables and Secrets):
//   TG_TOKEN  (Secret)  - bot token from @BotFather
//   TG_CHAT   (Text)    - chat id (group id starts with -100...)
const ALLOWED = ['https://vivamax.info', 'https://www.vivamax.info'];

const esc = s => String(s || '').replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
const cut = (s, n) => String(s || '').trim().slice(0, n);

function cors(origin) {
  return {
    'Access-Control-Allow-Origin': ALLOWED.includes(origin) ? origin : ALLOWED[0],
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
  };
}
const json = (data, status, origin) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', ...cors(origin) } });

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(origin) });
    if (request.method !== 'POST') return json({ ok: false, error: 'method' }, 405, origin);
    if (!ALLOWED.includes(origin)) return json({ ok: false, error: 'origin' }, 403, origin);
    if (!env.TG_TOKEN || !env.TG_CHAT) return json({ ok: false, error: 'not_configured' }, 503, origin);

    let d;
    try { d = await request.json(); } catch { return json({ ok: false, error: 'bad_json' }, 400, origin); }

    // honeypot: real people never fill this hidden field
    if (cut(d.website, 200)) return json({ ok: true }, 200, origin);

    const phone = cut(d.phone, 30);
    const digits = phone.replace(/\D/g, '');
    if (digits.length < 7 || digits.length > 15) return json({ ok: false, error: 'phone' }, 400, origin);

    const name = cut(d.name, 80), svc = cut(d.svc, 120), note = cut(d.note, 1000);
    const lang = cut(d.lang, 5).toUpperCase(), form = cut(d.form, 20);
    const tel = '+' + digits.replace(/^00/, '').replace(/^0(?=8|9)/, '359'); // 0888... -> +359888...

    const text = [
      '🛠 <b>Нова заявка от vivamax.info</b>',
      '',
      `📞 <b>Телефон:</b> ${esc(phone)}  (${esc(tel)})`,
      name && `👤 <b>Име:</b> ${esc(name)}`,
      svc && `🔧 <b>Услуга:</b> ${esc(svc)}`,
      note && `📝 <b>Описание:</b> ${esc(note)}`,
      '',
      `🌐 ${esc(lang || '?')} · ${esc(form || 'form')} · ${new Date().toLocaleString('bg-BG', { timeZone: 'Europe/Sofia' })}`,
    ].filter(x => x !== false && x !== '').join('\n').replace(/\n\n\n/g, '\n\n');

    const r = await fetch(`https://api.telegram.org/bot${env.TG_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: env.TG_CHAT, text, parse_mode: 'HTML', disable_web_page_preview: true }),
    });
    if (!r.ok) return json({ ok: false, error: 'telegram' }, 502, origin);
    return json({ ok: true }, 200, origin);
  },
};
