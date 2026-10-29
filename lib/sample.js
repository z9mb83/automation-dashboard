// Demo data with the same shape as the sheet feed (used only when SHEET_API_URL/KEY are not set).
import { BRANDS } from './brands.js';

export function sampleSnapshot(now = new Date()) {
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const ist = new Date(now.getTime() + 330 * 60000);
  const day = (d) => d.toISOString().slice(0, 10);
  const today = day(ist);
  const daily = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(ist.getTime() - i * 86400000), sunday = d.getUTCDay() === 0;
    const mail = {}, replies = {}, whatsapp = {}, failed = {}, waReplies = {};
    BRANDS.forEach((b, j) => {
      mail[b.code] = sunday ? 0 : Math.round([14, 7, 9, 3, 3][j] * (0.6 + rnd() * 0.6));
      if (rnd() < 0.12) replies[b.code] = 1;
      if (rnd() < 0.08) failed[b.code] = 1;
      if (j === 1 && i < 3) { whatsapp[b.code] = 2 + i; if (rnd() < 0.5) waReplies[b.code] = 1; }
    });
    daily.push({ date: day(d), mail, replies, whatsapp, failed, waReplies });
  }
  const brands = BRANDS.map((b, j) => ({
    code: b.code, name: b.name, leads: [459, 358, 420, 331, 309][j], withEmail: [440, 350, 400, 320, 300][j],
    toDraft: [60, 20, 40, 30, 25][j], drafts: [5, 0, 3, 0, 1][j], approved: [300, 250, 280, 260, 250][j],
    sent: [86, 60, 70, 20, 18][j], replied: [1, 1, 0, 0, 0][j], bounced: [4, 3, 5, 1, 1][j], failed: [0, 1, 0, 0, 0][j],
    phones: [30, 3, 2, 0, 0][j], consent: [10, 3, 0, 0, 0][j], waSent: [0, 4, 0, 0, 1][j], waFailed: 0,
    waDelivered: [0, 3, 0, 0, 0][j], waRead: [0, 2, 0, 0, 0][j], waUndelivered: [0, 0, 0, 0, 1][j], waReplied: [0, 1, 0, 0, 0][j],
    mailOn: true, waOn: b.code === '99M', sentToday: daily[29].mail[b.code], failedToday: daily[29].failed[b.code] || 0,
    sent7: daily.slice(-7).reduce((s, d) => s + (d.mail[b.code] || 0), 0),
    replies7: daily.slice(-7).reduce((s, d) => s + (d.replies[b.code] || 0), 0),
  }));
  const boxes = { SB: ['linkwithshaadi', 'linkwithshaadi1', 'linkwithshaadi9', 'linkwithshaadi3', 'linkwithshaadi10'], '99M': ['linkwithmarketing', 'linkwithmarketing3'],
    '99S': ['linkwithstaffing', 'linkwithstaffing1', 'linkwithstaffing5'], PE: ['linkwithproperty'], SC: ['linkwithskyline'] };
  const mailboxes = [];
  Object.entries(boxes).forEach(([code, list]) => list.forEach((m, i) => mailboxes.push({
    brand: code, email: m + '@gmail.com', enabled: true, stage: 'Stage ' + (1 + (i % 3)), dailyLimit: 3 + (i % 3) * 2,
    sentToday: Math.min(3 + (i % 3) * 2, 2 + i), paused: m === 'linkwithshaadi', lastResult: m === 'linkwithshaadi' ? 'OAuth invalid_grant' : 'Sent' })));
  return {
    generatedAt: ist.toISOString().slice(0, 16).replace('T', ' '), timezone: 'Asia/Kolkata', today, brands, daily, mailboxes,
    recentReplies: [
      { time: today + ' 16:19', brand: '99M', name: 'Sample lead', email: 'lead@example.com', phone: '', from: 'linkwithmarketing@gmail.com', subject: 'more enquiries from social media' },
      { time: daily[25].date + ' 11:02', brand: 'SB', name: 'Sample family', email: 'family@example.com', phone: '98xxxxxx10' }],
    recentSends: BRANDS.map((b, j) => ({ time: today + ' 1' + j + ':2' + j, brand: b.code, from: boxes[b.code][0] + '@gmail.com', to: 'lead' + j + '@example.com', result: 'Sent', error: '' })),
    recentWhatsApp: [{ time: today + ' 17:55', brand: '99M', phone: '9181****342', template: 'marketing', result: 'Sent' }],
    recentWaReplies: [{ time: today + ' 16:14', brand: '99M', row: '360', name: 'Sample lead', phone: '919400000565', message: "I'm interested, please call me", type: 'text' }],
    waReadNoReply: [{ time: daily[25].date + ' 11:40', brand: '99M', name: 'Sample reader', phone: '9400000777' },
      { time: daily[27].date + ' 15:05', brand: 'PE', name: '', phone: '919400000888' }],
    waFailures: [{ time: daily[28].date + ' 18:03', brand: 'SC', name: '', phone: '7770000559', reason: '131049 In order to maintain a healthy ecosystem engagement, the message failed to be delivered.' }],
    settings: { whatsappLive: false, whatsappAuto: 'Off' },
  };
}

/** Demo lead list with the same shape as the feed's ?report=leads (used only when the feed is not connected). */
export function sampleLeads(now = new Date()) {
  const ist = new Date(now.getTime() + 330 * 60000), day = (n) => new Date(ist.getTime() - n * 86400000).toISOString().slice(0, 10);
  const leads = [];
  BRANDS.forEach((b, j) => {
    for (let i = 0; i < 6; i++) {
      const d = day(i % 3), replied = (i + j) % 5 === 0;
      leads.push({ brand: b.code, row: 10 + i, name: `Sample ${b.code} ${i + 1}`, email: `lead${j}${i}@example.com`, phone: i % 2 ? '919400000' + j + i + '0' : '',
        mail: { status: i === 5 ? 'Bounced' : 'Sent', sentAt: `${d} 1${i}:2${j}`, from: `mailbox${j}@gmail.com`, subject: `Hello from ${b.name}`, error: '',
          replied, repliedAt: replied ? `${day(0)} 16:1${i}` : '' },
        whatsapp: i % 2 ? { status: 'Sent', sentAt: `${d} 12:0${i}`, delivery: i === 3 ? 'Read' : 'Delivered', consent: true, info: 'wamid.sample',
          replied: i === 3, repliedAt: i === 3 ? `${day(0)} 13:00` : '', lastReply: i === 3 ? 'Please call me' : '' } : null });
    }
  });
  return { generatedAt: ist.toISOString().slice(0, 16).replace('T', ' '), timezone: 'Asia/Kolkata', leads };
}

/** Demo inbox (same shape as the feed's ?inbox=all), used only when the feed is not connected. */
export function sampleInbox(now = new Date()) {
  const ist = new Date(now.getTime() + 330 * 60000), at = (daysAgo, hm) => new Date(ist.getTime() - daysAgo * 86400000).toISOString().slice(0, 10) + ' ' + hm + ':00';
  const people = [
    ['SB', '919400000101', 'Rohit Sharma', 'Hi Rohit, this is Shaadi Bells. We help families find the right match with personal matchmakers. Would you like to know more?', [['in', 0, '11:05', 'Yes interested, please call me after 5 pm']], 'read'],
    ['99M', '919400000202', 'Anita Verma', 'Hi Anita, 99 Marketing Services here. We help local businesses get more enquiries from Google and social media.', [], 'read'],
    ['PE', '919400000303', '', 'Hello, Property Experts Group here with new villa and plot options in Sector 8 and 9, Chandigarh.', [['in', 1, '18:20', 'Not interested']], 'delivered'],
    ['SC', '919400000404', 'Kapoor Traders', 'Hi, Skyline Capital helps owners sell their business quietly and at the right value.', [['in', 2, '10:12', 'What is your fee?'], ['in', 2, '10:13', 'Can we talk tomorrow']], 'read'],
    ['99S', '919400000505', 'Megha Jain', 'Hi Megha, 99 Staffing Services here. Hiring for your team this month?', [], 'failed'],
    ['SB', '919400000606', 'Harpreet', 'Hi Harpreet, this is Shaadi Bells...', [['in', 3, '09:40', 'stop']], 'read'],
  ];
  const chats = [], messages = [];
  people.forEach(([brand, phone, name, text, replies, status], i) => {
    const id = brand + '|' + phone, sentAt = at(i % 4 + 1, '10:0' + i);
    messages.push({ id: 'o' + i, chat: id, dir: 'out', time: sentAt, text, template: 'intro', status, error: status === 'failed' ? 'Failed: 131049 not delivered' : '' });
    replies.forEach(([dir, d, hm, t], j) => messages.push({ id: 'i' + i + j, chat: id, dir, time: at(Math.min(d, i % 4 + 1), hm), text: t, type: 'text',
      flag: t === 'stop' ? 'Opted out' : t === 'Not interested' ? 'Possible opt-out' : '' }));
    if (replies.some((r) => r[3] === 'stop')) messages.push({ id: 'a' + i, chat: id, dir: 'out', time: at(3, '09:41'), text: 'You will not receive further messages from Shaadi Bells. Sorry for the disturbance.', status: 'delivered', auto: true });
    const mine = messages.filter((m) => m.chat === id).sort((a, b) => (a.time < b.time ? -1 : 1)), last = mine[mine.length - 1];
    chats.push({ id, brand, phone, name, email: '', row: 10 + i, optedOut: replies.some((r) => r[3] === 'stop'),
      flag: replies.some((r) => r[3] === 'stop') ? 'Opted out' : replies.some((r) => r[3] === 'Not interested') ? 'Possible opt-out' : '',
      lastTime: last.time, lastText: last.text, lastDir: last.dir, waStatus: status === 'failed' ? 'Sent' : 'Sent', delivery: '' });
  });
  messages.sort((a, b) => (a.time < b.time ? -1 : a.time > b.time ? 1 : 0));
  chats.sort((a, b) => (a.lastTime < b.lastTime ? 1 : -1));
  return { generatedAt: ist.toISOString().slice(0, 19).replace('T', ' '), version: 'sample', live: false, testNumbers: '919400000101',
    waOn: { SB: true, '99M': true, '99S': false, PE: true, SC: true }, dailyCap: 20, sentToday: 3,
    quality: [{ brand: 'SB', number: '+91 90000 00001', quality: 'GREEN', tier: 'TIER_250' }, { brand: 'PE', number: '+91 90000 00003', quality: 'YELLOW', tier: 'TIER_250' }],
    chats, messages };
}

/** Demo email-reply tracker (only when the sheet feed is not connected). */
export function sampleMailThreads(now = new Date()) {
  const at = (hoursAgo) => new Date(now.getTime() + 330 * 60000 - hoursAgo * 3600000).toISOString().slice(0, 16).replace('T', ' ');
  const t = (brand, name, email, phone, status, replied, extra = {}) => ({
    brand, name, email, phone, mailbox: 'linkwithmarketing@gmail.com', threadId: '18f' + email.length + brand, subject: `Quick question for ${name || 'you'}`,
    emailedAt: at(replied + 30), firstReplyAt: at(replied), lastReplyAt: at(replied), replies: status === 'Auto-reply' || status === 'Bounce' ? 0 : 1,
    lastFromUsAt: '', status, handledAt: '', handledBy: '', updated: at(0), ...extra });
  return {
    generatedAt: at(0),
    threads: [
      t('99M', 'Ankit Mehta', 'ankit@brightfoods.in', '9811100001', 'Waiting for us', 1.5),
      t('SB', 'Neha Arora', 'neha.arora@gmail.com', '9811100002', 'Waiting for us', 6),
      t('PE', 'Rajiv Malhotra', 'rajiv@malhotra-estates.com', '9811100003', 'Waiting for us', 30),
      t('99S', 'Priya Nair', 'priya@talentbridge.co', '', 'Answered', 20, { lastFromUsAt: at(18) }),
      t('SC', 'Karan Bedi', 'karan@bedicap.com', '', 'Waiting for us', 50, { handledAt: at(40), handledBy: 'Dashboard' }),
      t('99M', '', 'info@acmetools.com', '', 'Auto-reply', 3),
      t('PE', '', 'sales@oldcompany.in', '', 'Bounce', 26),
    ],
    sync: [{ mailbox: 'linkwithmarketing@gmail.com', lastCheck: at(0.1), result: 'OK' }],
  };
}
