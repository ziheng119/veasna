const { referralDocumentHtml } = require('../src/components/doctors-consultation/ReferralDocument');
const { referralBatchDocumentHtml } = require('../src/components/doctors-consultation/ReferralDocument');
const referral = { referralDate: '2026-10-20', referralType: ['Dentist'], illness: '', duration: '', reason: '<script>alert(1)</script>', signature: [[[0, 0], [1, 1]]], signerName: 'Doctor <One>', signedAt: '2026-10-20T10:00:00Z' };
test('print includes only selected and completed fields, signer, and signature', () => {
  const html = referralDocumentHtml(referral, { english_name: 'Test Patient' }, 12);
  expect(html).toContain('Project Battambang');
  expect(html).toContain('Dentist');
  expect(html).not.toContain('Optometrist');
  expect(html).not.toContain('checkbox');
  expect(html).not.toContain('>Duration<');
  expect(html).toContain('Doctor &lt;One&gt;');
  expect(html).toContain('<polyline');
  expect(html).toContain('&lt;script&gt;');
  expect(html).not.toContain('<script>');
});
test('blank referral destinations and unsigned blocks are omitted', () => {
  const html = referralDocumentHtml({ ...referral, referralType: [], signature: null }, {}, 12);
  expect(html).not.toContain('Referred to');
  expect(html).not.toContain('<polyline');
});

test('batch shares individual markup and starts each subsequent referral on a new page', () => {
  const items = [
    { referral, patient: { english_name: 'First' }, visitId: 1 },
    { referral: { ...referral, signature: null }, patient: { english_name: 'Second' }, visitId: 2 },
  ];
  expect(referralBatchDocumentHtml([items[0]])).toBe(referralDocumentHtml(referral, items[0].patient, 1));
  const html = referralBatchDocumentHtml(items);
  expect(html.match(/<article>/g)).toHaveLength(2);
  expect(html).toContain('article + article { break-before: page');
  expect(html).toContain('Unsigned draft');
  expect(html.indexOf('First')).toBeLessThan(html.indexOf('Second'));
});

test('letterhead logo and a handwritten signature block are print-ready', () => {
  const withLogo = referralDocumentHtml(referral, { english_name: 'Test Patient' }, 12, { logoUrl: 'http://host:3001/btb-logo.png' });
  expect(withLogo).toContain('src="http://host:3001/btb-logo.png"');
  expect(withLogo).toContain('Dear Doctor');
  expect(withLogo).toContain('Doctor&#x27;s signature');
  expect(withLogo).toContain('2026-10-20');
  expect(referralDocumentHtml(referral, {}, 12)).not.toContain('<img');
  const unsigned = referralDocumentHtml({ ...referral, signature: null, signerName: null, signedAt: null }, {}, 12);
  expect(unsigned).toContain('sign above by hand');
});
