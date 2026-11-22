// Partner NGO referral types come from the editable "seva_referrals" list.
const { sevaReferralLabel, sevaReferralChoices } = require('../src/constants/sevaReferral');
const { DEFAULT_FORM_OPTIONS } = require('../src/stores/useFormOptionsStore');

const options = [{ id: 'cataract_surgery', label: 'Cataract surgery' }, { id: 'glasses', label: 'Glasses' }];

test('the built-in referral types keep the ids saved before the list was editable', () => {
  expect(DEFAULT_FORM_OPTIONS.seva_referrals.map(option => option.id)).toEqual(['cataract_surgery', 'seva_general']);
});

test('a saved type shows its current name, or its id once removed from the list', () => {
  expect(sevaReferralLabel('glasses', options)).toBe('Glasses');
  expect(sevaReferralLabel('old_type', options)).toBe('old_type');
  expect(sevaReferralLabel('', options)).toBe('');
});

test('a type saved on the record stays a choice after it is removed from the list', () => {
  expect(sevaReferralChoices(options, 'glasses')).toBe(options);
  expect(sevaReferralChoices(options, '')).toBe(options);
  expect(sevaReferralChoices(options, 'old_type').map(option => option.id)).toEqual(['cataract_surgery', 'glasses', 'old_type']);
});
