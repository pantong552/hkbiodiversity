import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { AnatomyIllustration } from '../types/anatomy';
import { getAnatomyCoordinates, isAllowedAnatomyImageUrl, isValidAnatomyIllustration, mapAnatomyIllustration } from './anatomy';

test('validates marker coordinates and unique keys', () => {
  const valid: AnatomyIllustration = {
    photoUrl: 'https://res.cloudinary.com/example/species.png',
    markers: [{ key: 'wing', x: 0, y: 100, placement: 'top', zh: '翼', en: 'Wing' }]
  };
  assert.equal(isValidAnatomyIllustration(valid), true);
  assert.equal(isValidAnatomyIllustration({ ...valid, markers: [{ ...valid.markers[0], x: 100.1 }] }), false);
  assert.equal(isValidAnatomyIllustration({ ...valid, markers: [valid.markers[0], valid.markers[0]] }), false);
});

test('maps bilingual descriptions and defaults missing translations', () => {
  const illustration = mapAnatomyIllustration({
    photo_url: '/images/species.png',
    markers: [{ key: 'wing', x: 25, y: 60, zh: '翼', placement: 'top' }]
  });
  assert.deepEqual(illustration.markers[0], {
    key: 'wing', x: 25, y: 60, placement: 'top', zh: '翼', en: ''
  });
});

test('rejects unsafe image URL schemes', () => {
  assert.equal(isAllowedAnatomyImageUrl('https://res.cloudinary.com/example/image.png'), true);
  assert.equal(isAllowedAnatomyImageUrl('https://static.inaturalist.org/image.png'), true);
  assert.equal(isAllowedAnatomyImageUrl('/images/image.png'), true);
  assert.equal(isAllowedAnatomyImageUrl('https://example.org/image.png'), false);
  assert.equal(isAllowedAnatomyImageUrl('//example.org/image.png'), false);
  assert.equal(isAllowedAnatomyImageUrl('javascript:alert(1)'), false);
});

test('calculates percentages from the displayed image bounds and clamps edges', () => {
  const imageRect = { left: 100, top: 200, width: 400, height: 200 };
  assert.deepEqual(getAnatomyCoordinates(300, 300, imageRect), { x: 50, y: 50 });
  assert.deepEqual(getAnatomyCoordinates(50, 500, imageRect), { x: 0, y: 100 });
});

test('migration restricts published writes to admins and validates one atomic illustration row', () => {
  const migration = readFileSync('supabase/migrations/202609300001_create_species_anatomy_illustrations.sql', 'utf8');
  assert.match(migration, /FOR INSERT TO authenticated[\s\S]*profiles\.role = 'admin'/);
  assert.match(migration, /FOR UPDATE TO authenticated[\s\S]*profiles\.role = 'admin'/);
  assert.match(migration, /FOR DELETE TO authenticated[\s\S]*profiles\.role = 'admin'/);
  assert.doesNotMatch(migration, /FOR ALL TO public/i);
  assert.match(migration, /photo_url text NOT NULL[\s\S]*markers jsonb NOT NULL/);
  assert.match(migration, /CHECK \(public\.is_valid_anatomy_markers\(markers\)\)/);
});