import assert from 'node:assert/strict';
import test from 'node:test';
import {
  formulaUsesCurrentToken,
  patchComputablePhraseForCurrent,
  shouldPreserveCurrentFormula
} from '../src/CSBActiveEffectPatch.js';

test('formulaUsesCurrentToken: detects current inside CSB formulas', () => {
  assert.equal(formulaUsesCurrentToken('${ current + (-0.1) }$'), true);
  assert.equal(formulaUsesCurrentToken('${ current * (2) }$'), true);
  assert.equal(formulaUsesCurrentToken('current + (1)'), true);
  assert.equal(formulaUsesCurrentToken('${ DEF + (ATK_calc * 0.08) }$'), false);
  assert.equal(formulaUsesCurrentToken('${ concurrent + (1) }$'), false);
  assert.equal(formulaUsesCurrentToken(''), false);
  assert.equal(formulaUsesCurrentToken(null), false);
});

test('shouldPreserveCurrentFormula: only when current is absent from props', () => {
  const phrase = '${ current + (ATK_calc * 0.08) }$';
  assert.equal(shouldPreserveCurrentFormula(phrase, { ATK_calc: 10 }), true);
  assert.equal(shouldPreserveCurrentFormula(phrase, { ATK_calc: 10, current: 5 }), false);
  assert.equal(shouldPreserveCurrentFormula(phrase, null), true);
  assert.equal(shouldPreserveCurrentFormula(phrase, 'not-object'), true);
  assert.equal(shouldPreserveCurrentFormula('${ ATK_calc * 0.08 }$', { ATK_calc: 10 }), false);
});

test('patchComputablePhraseForCurrent: preserves current formulas until current is provided', () => {
  const calls = [];
  const env = {
    ComputablePhrase: {
      computeMessageStatic(phrase, props) {
        calls.push({ phrase, props });
        return { result: 'COMPUTED' };
      }
    }
  };

  assert.equal(patchComputablePhraseForCurrent(env), true);
  assert.equal(patchComputablePhraseForCurrent(env), true);

  const preserved = env.ComputablePhrase.computeMessageStatic('${ current + (2) }$', { ATK_calc: 1 });
  assert.equal(preserved.result, '${ current + (2) }$');
  assert.equal(calls.length, 0);

  const applied = env.ComputablePhrase.computeMessageStatic('${ current + (2) }$', { ATK_calc: 1, current: 10 });
  assert.equal(applied.result, 'COMPUTED');
  assert.equal(calls.length, 1);

  const plain = env.ComputablePhrase.computeMessageStatic('${ ATK_calc * 0.08 }$', { ATK_calc: 1 });
  assert.equal(plain.result, 'COMPUTED');
  assert.equal(calls.length, 2);

  env.ComputablePhrase.computeMessageStatic(null, { ATK_calc: 1 });
  assert.equal(calls.length, 3);
});

test('patchComputablePhraseForCurrent: returns false when ComputablePhrase is unavailable', () => {
  assert.equal(patchComputablePhraseForCurrent({}), false);
  assert.equal(patchComputablePhraseForCurrent({ ComputablePhrase: {} }), false);
});
