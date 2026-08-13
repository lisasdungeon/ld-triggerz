import assert from 'node:assert/strict';
import test from 'node:test';
import {
  csbPathExpression,
  csbValueExpression,
  isCSBEffectKey,
  isCSBPropPath,
  makeCSBFormula,
  normalizeEffectChange,
  normalizeEffectChanges,
  trimEffectText,
  unwrapCSBFormula
} from '../src/EffectValues.js';

test('trimEffectText: trims strings and coerces nullish to an empty string', () => {
  assert.equal(trimEffectText('  hi  '), 'hi');
  assert.equal(trimEffectText(null), '');
  assert.equal(trimEffectText(undefined), '');
  assert.equal(trimEffectText(5), '5');
});

test('isCSBPropPath: true for "props." and "system.props." prefixed paths', () => {
  assert.equal(isCSBPropPath('props.bloodCharge'), true);
  assert.equal(isCSBPropPath('system.props.bloodCharge'), true);
  assert.equal(isCSBPropPath('system.hp.value'), false);
  assert.equal(isCSBEffectKey('props.bloodCharge'), true);
});

test('unwrapCSBFormula: extracts the inner expression from ${ ... }$, empty string otherwise', () => {
  assert.equal(unwrapCSBFormula('${ 1 + 1 }$'), '1 + 1');
  assert.equal(unwrapCSBFormula('not a formula'), '');
  assert.equal(unwrapCSBFormula(''), '');
});

test('csbPathExpression: strips the system.props./props. prefix', () => {
  assert.equal(csbPathExpression('system.props.bloodCharge'), 'bloodCharge');
  assert.equal(csbPathExpression('props.bloodCharge'), 'bloodCharge');
  assert.equal(csbPathExpression('not-a-prop-path'), '');
});

test('makeCSBFormula: wraps an expression in the ${ }$ marker', () => {
  assert.equal(makeCSBFormula('ETO_check + (-0.1)'), '${ ETO_check + (-0.1) }$');
});

test('csbValueExpression: unwraps an existing formula first', () => {
  assert.equal(csbValueExpression('${ 5 }$'), '5');
});

test('csbValueExpression: resolves a prop path to its bare expression', () => {
  assert.equal(csbValueExpression('props.bloodCharge'), 'bloodCharge');
});

test('csbValueExpression: passes plain numeric text through unchanged', () => {
  assert.equal(csbValueExpression('3'), '3');
  assert.equal(csbValueExpression('-2.5'), '-2.5');
});

test('csbValueExpression: bare prop math expressions pass through', () => {
  assert.equal(csbValueExpression('ATK_calc * 0.08'), 'ATK_calc * 0.08');
  assert.equal(csbValueExpression('ATK_calc'), 'ATK_calc');
  assert.equal(csbValueExpression('(ATK_calc * 0.08)'), '(ATK_calc * 0.08)');
  assert.equal(csbValueExpression('ATK_calc - 1'), 'ATK_calc - 1');
});

test('csbValueExpression: non-numeric, non-prop, non-formula text resolves to empty', () => {
  assert.equal(csbValueExpression('not-numeric'), '');
  assert.equal(csbValueExpression(''), '');
  assert.equal(csbValueExpression('hello world'), '');
  assert.equal(csbValueExpression('ATK_calc & 0.08'), '');
});

test('normalizeEffectChange: ADD onto a CSB prop becomes CUSTOM math using the component key', () => {
  const result = normalizeEffectChange({ key: 'system.props.ETO_check', mode: 2, value: '-0.1' });
  assert.equal(result.mode, 0);
  assert.equal(result.value, '${ ETO_check + (-0.1) }$');
});

test('normalizeEffectChange: ADD accepts bare prop math without ${ }$ wrappers', () => {
  const result = normalizeEffectChange({ key: 'system.props.DEF', mode: 2, value: 'ATK_calc * 0.08' });
  assert.equal(result.mode, 0);
  assert.equal(result.value, '${ DEF + (ATK_calc * 0.08) }$');
});

test('normalizeEffectChange: ADD accepts wrapped prop math formulas', () => {
  const result = normalizeEffectChange({ key: 'system.props.DEF', mode: 2, value: '${ ATK_calc * 0.08 }$' });
  assert.equal(result.mode, 0);
  assert.equal(result.value, '${ DEF + (ATK_calc * 0.08) }$');
});

test('normalizeEffectChange: MULTIPLY onto a CSB prop becomes CUSTOM math using the component key', () => {
  const result = normalizeEffectChange({ key: 'props.bloodCharge', mode: 1, value: '2' });
  assert.equal(result.mode, 0);
  assert.equal(result.value, '${ bloodCharge * (2) }$');
});

test('normalizeEffectChange: OVERRIDE onto a CSB prop keeps native OVERRIDE', () => {
  const result = normalizeEffectChange({ key: 'props.bloodCharge', mode: 5, value: '7' });
  assert.equal(result.mode, 5);
  assert.equal(result.value, '7');
});

test('normalizeEffectChange: restores legacy current+() then converts to prop-key CUSTOM math', () => {
  const result = normalizeEffectChange({
    key: 'system.props.ETO_check',
    mode: 0,
    value: '${ current + (-0.1) }$'
  });
  assert.equal(result.mode, 0);
  assert.equal(result.value, '${ ETO_check + (-0.1) }$');
});

test('normalizeEffectChange: restores legacy current*() then converts to prop-key CUSTOM math', () => {
  const result = normalizeEffectChange({
    key: 'props.bloodCharge',
    mode: 0,
    value: '${ current * (2) }$'
  });
  assert.equal(result.mode, 0);
  assert.equal(result.value, '${ bloodCharge * (2) }$');
});

test('normalizeEffectChange: re-normalizing prop-key CUSTOM math stays stable', () => {
  const once = normalizeEffectChange({ key: 'system.props.ETO_check', mode: 2, value: '-0.1' });
  const twice = normalizeEffectChange(once);
  assert.deepEqual(twice, once);

  const mulOnce = normalizeEffectChange({ key: 'props.bloodCharge', mode: 1, value: '2' });
  const mulTwice = normalizeEffectChange(mulOnce);
  assert.deepEqual(mulTwice, mulOnce);
});

test('normalizeEffectChange: empty prop-key multiply capture stays CUSTOM', () => {
  const result = normalizeEffectChange({
    key: 'props.bloodCharge',
    mode: 0,
    value: '${ bloodCharge * (   ) }$'
  });
  assert.equal(result.mode, 0);
  assert.equal(result.value, '${ bloodCharge * (   ) }$');
});

test('normalizeEffectChange: empty prop-key add capture stays CUSTOM', () => {
  const result = normalizeEffectChange({
    key: 'system.props.ETO_check',
    mode: 0,
    value: '${ ETO_check + (   ) }$'
  });
  assert.equal(result.mode, 0);
});

test('normalizeEffectChange: CUSTOM add/multiply formulas for a different prop key stay as-is', () => {
  const add = normalizeEffectChange({
    key: 'system.props.ETO_check',
    mode: 0,
    value: '${ otherKey + (1) }$'
  });
  assert.equal(add.mode, 0);
  assert.equal(add.value, '${ otherKey + (1) }$');

  const mul = normalizeEffectChange({
    key: 'props.bloodCharge',
    mode: 0,
    value: '${ otherKey * (2) }$'
  });
  assert.equal(mul.mode, 0);
  assert.equal(mul.value, '${ otherKey * (2) }$');
});

test('normalizeEffectChange: non-numeric ADD values on CSB keys are left as native ADD', () => {
  const result = normalizeEffectChange({
    key: 'system.props.ETO_check',
    mode: 2,
    value: 'not-a-number'
  });
  assert.equal(result.mode, 2);
  assert.equal(result.value, 'not-a-number');
});

test('normalizeEffectChange: restores legacy CUSTOM numeric formulas back to OVERRIDE', () => {
  const result = normalizeEffectChange({
    key: 'props.bloodCharge',
    mode: 0,
    value: '${ 7 }$'
  });
  assert.equal(result.mode, 5);
  assert.equal(result.value, '7');
});

test('normalizeEffectChange: intentional CUSTOM formulas that are not legacy math stay CUSTOM', () => {
  const result = normalizeEffectChange({
    key: 'system.props.STR',
    mode: 0,
    value: '${ DEX + 2 }$'
  });
  assert.equal(result.mode, 0);
  assert.equal(result.value, '${ DEX + 2 }$');
});

test('normalizeEffectChange: CUSTOM mode with a plain value is left as-is', () => {
  const result = normalizeEffectChange({ key: 'props.bloodCharge', mode: 0, value: '3' });
  assert.equal(result.mode, 0);
  assert.equal(result.value, '3');
});

test('normalizeEffectChange: a non-CSB key with a CSB-shaped value still gets formula-wrapped', () => {
  const result = normalizeEffectChange({ key: 'system.hp.value', mode: 0, value: 'props.bloodCharge' });
  assert.equal(result.value, '${ bloodCharge }$');
});

test('normalizeEffectChange: a completely ordinary change passes through with only mode/value normalized', () => {
  const result = normalizeEffectChange({ key: 'system.hp.value', mode: 2, value: '  5  ' });
  assert.equal(result.mode, 2);
  assert.equal(result.value, '5');
});

test('normalizeEffectChange: missing mode defaults to CUSTOM (0)', () => {
  const result = normalizeEffectChange({ key: 'system.hp.value', value: '5' });
  assert.equal(result.mode, 0);
});

test('normalizeEffectChange: empty legacy current+() capture stays CUSTOM', () => {
  const result = normalizeEffectChange({
    key: 'system.props.ETO_check',
    mode: 0,
    value: '${ current + (   ) }$'
  });
  assert.equal(result.mode, 0);
  assert.equal(result.value, '${ current + (   ) }$');
});

test('normalizeEffectChange: empty legacy current*() capture stays CUSTOM', () => {
  const result = normalizeEffectChange({
    key: 'props.bloodCharge',
    mode: 0,
    value: '${ current * (  ) }$'
  });
  assert.equal(result.mode, 0);
});

test('normalizeEffectChanges: maps every change, and non-arrays become an empty array', () => {
  const changes = [
    { key: 'props.bloodCharge', mode: 2, value: '3' },
    { key: 'system.hp.value', mode: 0, value: '5' }
  ];
  const result = normalizeEffectChanges(changes);
  assert.equal(result.length, 2);
  assert.equal(result[0].mode, 0);
  assert.equal(result[0].value, '${ bloodCharge + (3) }$');
  assert.deepEqual(normalizeEffectChanges(null), []);
  assert.deepEqual(normalizeEffectChanges(undefined), []);
});
