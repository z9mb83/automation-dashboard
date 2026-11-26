import test from 'node:test';
import assert from 'node:assert/strict';
import { fillTemplate, waHtml, driveId, SAMPLE_NAME } from '../lib/templates.js';

test('template blanks are filled with Meta samples, else a sample name', () => {
  assert.equal(fillTemplate('Hi {{1}}, from {{2}}', ['Anita', 'Shaadi Bells']), 'Hi Anita, from Shaadi Bells');
  assert.equal(fillTemplate('Hi {{1}}, see {{2}}', []), `Hi ${SAMPLE_NAME}, see …`);
  assert.equal(fillTemplate('Hi {{ name }} and {{city}}', ['Ravi', 'Mohali']), 'Hi Ravi and Mohali');
  assert.equal(fillTemplate('Hi {{1}}, again {{1}}', ['Ravi']), 'Hi Ravi, again Ravi');
  assert.equal(fillTemplate('', ['x']), '');
});

test('WhatsApp formatting becomes safe HTML', () => {
  assert.equal(waHtml('*Bold* and _it_ ~no~\nline'), '<b>Bold</b> and <i>it</i> <s>no</s><br>line');
  assert.equal(waHtml('<script>x</script> 5*3*2'), '&lt;script&gt;x&lt;/script&gt; 5*3*2');
  assert.equal(waHtml('Call *now*!'), 'Call <b>now</b>!');
});

test('Drive link -> file id', () => {
  assert.equal(driveId('https://drive.google.com/file/d/1AbCdEfGhIjKlMnOpQrStUv/view?usp=sharing'), '1AbCdEfGhIjKlMnOpQrStUv');
  assert.equal(driveId('https://example.com/logo.png'), '');
});
