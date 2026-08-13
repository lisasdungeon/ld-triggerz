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
  assert.equal(makeCSBFormula('current + (1)'), '${ current + (1) }$');
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

test('csbValueExpression: non-numeric, non-prop, non-formula text resolves to empty', () => {
  assert.equal(csbValueExpression('not-numeric'), '');
  assert.equal(csbValueExpression(''), '');
});

test('normalizeEffectChange: ADD onto a CSB prop path keeps native ADD with a plain value', () => {
  const result = normalizeEffectChange({ key: 'system.props.ETO_check', mode: 2, value: '-0.1' });
  assert.equal(result.mode, 2);
  assert.equal(result.value, '-0.1');
});

test('normalizeEffectChange: MULTIPLY onto a CSB prop path keeps native MULTIPLY', () => {
  const result = normalizeEffectChange({ key: 'props.bloodCharge', mode: 1, value: '2' });
  assert.equal(result.mode, 1);
  assert.equal(result.value, '2');
});

test('normalizeEffectChange: OVERRIDE onto a CSB prop path keeps native OVERRIDE', () => {
  const result = normalizeEffectChange({ key: 'props.bloodCharge', mode: 5, value: '7' });
  assert.equal(result.mode, 5);
  assert.equal(result.value, '7');
});

test('normalizeEffectChange: restores legacy CUSTOM current+() formulas back to ADD', () => {
  const result = normalizeEffectChange({
    key: 'system.props.ETO_check',
    mode: 0,
    value: '${ current + (-0.1) }$'
  });
  assert.equal(result.mode, 2);
  assert.equal(result.value, '-0.1');
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

test('normalizeEffectChange: CUSTOM without formula wrappers is not restored', () => {
  const result = normalizeEffectChange({
    key: 'system.props.ETO_check',
    mode: 0,
    value: 'current + (1)'
  });
  assert.equal(result.mode, 0);
  assert.equal(result.value, 'current + (1)');
});

test('normalizeEffectChange: non-CSB CUSTOM keys are not restored as legacy math', () => {
  const result = normalizeEffectChange({
    key: 'system.hp.value',
    mode: 0,
    value: '${ current + (1) }$'
  });
  assert.equal(result.mode, 0);
  assert.equal(result.value, '${ current + (1) }$');
});

test('normalizeEffectChange: restores legacy CUSTOM current*() formulas back to MULTIPLY', () => {
  const result = normalizeEffectChange({
    key: 'props.bloodCharge',
    mode: 0,
    value: '${ current * (2) }$'
  });
  assert.equal(result.mode, 1);
  assert.equal(result.value, '2');
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

test('normalizeEffectChanges: maps every change, and non-arrays become an empty array', () => {
  const changes = [
    { key: 'props.bloodCharge', mode: 2, value: '3' },
    { key: 'system.hp.value', mode: 0, value: '5' }
  ];
  const result = normalizeEffectChanges(changes);
  assert.equal(result.length, 2);
  assert.equal(result[0].mode, 2);
  assert.equal(result[0].value, '3');
  assert.deepEqual(normalizeEffectChanges(null), []);
  assert.deepEqual(normalizeEffectChanges(undefined), []);
});
