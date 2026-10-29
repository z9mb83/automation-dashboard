import test from 'node:test';
import assert from 'node:assert/strict';
import { replyState, waitInfo, mailSummary, mailQueue, gmailThreadLink, syncStatus, durationText, matchesMail } from '../lib/mailreplies.js';
import { sampleMailThreads } from '../lib/sample.js';
import { istMs } from '../lib/inbox.js';

const NOW = istMs('2026-10-29 15:00');
const T = (o) => ({ brand: 'SB', email: 'a@x.com', name: 'A', phone: '', mailbox: 'box@gmail.com', threadId: '18a', subject: 'Hi',
  firstReplyAt: '2026-10-29 10:00', lastReplyAt: '2026-10-29 10:00', lastFromUsAt: '', status: 'Waiting for us', handledAt: '', ...o });

test('state: waiting, handled until a newer reply, answered, auto, bounce', () => {
  assert.equal(replyState(T()), 'waiting');
  assert.equal(replyState(T({ handledAt: '2026-10-29 11:00' })), 'handled');
  assert.equal(replyState(T({ handledAt: '2026-10-29 09:00' })), 'waiting');       // they wrote again after it was handled
  assert.equal(replyState(T({ status: 'Answered' })), 'answered');
  assert.equal(replyState(T({ status: 'Auto-reply' })), 'auto');
  assert.equal(replyState(T({ status: 'Bounce' })), 'bounce');
});

test('waiting time and urgency', () => {
  assert.deepEqual(waitInfo(T({ lastReplyAt: '2026-10-29 14:40' }), NOW), { ms: 20 * 60000, text: '20 m', level: 'ok' });
  assert.equal(waitInfo(T(), NOW).text, '5 h 00 m');
  assert.equal(waitInfo(T(), NOW).level, 'soon');
  assert.equal(waitInfo(T({ lastReplyAt: '2026-10-26 15:00' }), NOW).text, '3 days');
  assert.equal(waitInfo(T({ lastReplyAt: '2026-10-28 09:00' }), NOW).text, '1 day 6 h');
  assert.equal(waitInfo(T({ lastReplyAt: '2026-10-26 15:00' }), NOW).level, 'late');
});

test('summary, queue order, brand filter, search, links, sync status', () => {
  const list = [T({ email: 'old@x.com', lastReplyAt: '2026-10-27 10:00' }), T(), T({ brand: 'PE', status: 'Answered', firstReplyAt: '2026-10-29 10:00', lastFromUsAt: '2026-10-29 12:00' }),
    T({ status: 'Bounce' })];
  const s = mailSummary(list, NOW);
  assert.deepEqual([s.waiting, s.answered, s.handled, s.auto, s.bounce, s.late], [2, 1, 0, 0, 1, 1]);
  assert.equal(s.oldestWait.text, '2 days');
  assert.equal(durationText(s.medianAnswerMs), '2 h');
  assert.equal(mailSummary(list, NOW, 'PE').waiting, 0);
  assert.deepEqual(mailQueue(list).map((t) => t.email), ['old@x.com', 'a@x.com']);         // longest wait first
  assert.equal(mailQueue(list, { filter: 'all' })[0].lastReplyAt, '2026-10-29 10:00');      // newest first
  assert.ok(matchesMail(T({ phone: '9811122233' }), '22233') && matchesMail(T(), 'hi') && !matchesMail(T(), 'zzz'));
  assert.equal(gmailThreadLink(T()), 'https://mail.google.com/mail/u/box%40gmail.com/#all/18a');
  assert.deepEqual(syncStatus([{ mailbox: 'a', lastCheck: '2026-10-29 10:00', result: 'OK' }, { mailbox: 'b', lastCheck: '2026-10-29 10:15', result: 'Error: x' }]),
    { running: true, lastCheck: '2026-10-29 10:00', failing: [{ mailbox: 'b', lastCheck: '2026-10-29 10:15', result: 'Error: x' }] });
  assert.equal(syncStatus([]).running, false);
  const demo = sampleMailThreads(new Date('2026-10-29T09:30:00Z'));
  assert.equal(mailSummary(demo.threads, istMs(demo.generatedAt)).waiting, 3);
});
