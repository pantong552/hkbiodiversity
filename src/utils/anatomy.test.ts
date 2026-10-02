import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { AnatomyIllustration } from '../types/anatomy';
import { anatomyIllustrationToDatabase, anatomyIllustrationToLegacyColumns, clampAnatomyPan, fitAnatomyImage, getAnatomyCoordinates, getAnatomyPanLimits, getAnatomyPanOffset, getAnatomyZoomPan, isAllowedAnatomyImageUrl, isValidAnatomyIllustration, isValidAnatomyIllustrations, mapAnatomyIllustration, mapAnatomyIllustrations, normalizeAnatomyMarkers } from './anatomy';

test('validates marker coordinates and unique keys', () => {
  const valid: AnatomyIllustration = {
    id: 'illustration-1',
    titleZh: '翅膀特徵',
    titleEn: 'Wing features',
    photoUrl: 'https://res.cloudinary.com/example/species.png',
    photoAttribution: '',
    photoLink: '',
    markers: [{ key: 'wing', x: 0, y: 100, placement: 'top', zh: '翼', en: 'Wing' }],
    zoom: 1,
    offsetX: 0,
    offsetY: 0
  };
  assert.equal(isValidAnatomyIllustration(valid), true);
  assert.equal(isValidAnatomyIllustration({ ...valid, markers: [{ ...valid.markers[0], x: 100.1 }] }), false);
  assert.equal(isValidAnatomyIllustration({ ...valid, markers: [{ ...valid.markers[0], anchorX: -0.1, anchorY: 50 }] }), false);
  assert.equal(isValidAnatomyIllustration({ ...valid, markers: [{ ...valid.markers[0], anchorX: 50 }] }), false);
  assert.equal(isValidAnatomyIllustration({ ...valid, markers: [valid.markers[0], valid.markers[0]] }), false);
  assert.equal(isValidAnatomyIllustration({ ...valid, zoom: 4.1 }), false);
  assert.equal(isValidAnatomyIllustration({ ...valid, photoLink: 'javascript:alert(1)' }), false);
  assert.equal(isValidAnatomyIllustration({ ...valid, titleZh: undefined as unknown as string }), false);
  assert.equal(isValidAnatomyIllustrations([valid, { ...valid, id: 'illustration-2' }]), true);
  assert.equal(isValidAnatomyIllustrations([valid, valid]), false);
});

test('maps bilingual descriptions and defaults missing translations', () => {
  const illustration = mapAnatomyIllustration({
    title_zh: '翅膀特徵',
    title_en: 'Wing features',
    photo_url: '/images/species.png',
    photo_attribution: '© Photographer (CC-BY)',
    photo_link: 'https://www.inaturalist.org/observations/123',
    markers: [{ key: 'wing', x: 25, y: 60, zh: '翼', placement: 'top' }]
  });
  assert.equal(illustration.titleZh, '翅膀特徵');
  assert.equal(illustration.titleEn, 'Wing features');
  assert.equal(illustration.photoAttribution, '© Photographer (CC-BY)');
  assert.equal(illustration.photoLink, 'https://www.inaturalist.org/observations/123');
  assert.equal(mapAnatomyIllustrations({ photo_url: '/images/legacy.png', markers: [] })[0].id, 'illustration-1');
  const databaseIllustration = anatomyIllustrationToDatabase(illustration);
  assert.equal(mapAnatomyIllustrations({ illustrations: [databaseIllustration] }).length, 1);
  assert.equal(databaseIllustration.title_zh, '翅膀特徵');
  assert.equal(databaseIllustration.title_en, 'Wing features');
  assert.equal('id' in anatomyIllustrationToLegacyColumns(illustration), false);
  assert.deepEqual(illustration.markers[0], {
    key: '1', x: 25, y: 60, anchorX: 25, anchorY: 60, placement: 'top', zh: '翼', en: ''
  });
  const anchoredIllustration = mapAnatomyIllustration({
    markers: [{ key: 'wing', x: 75, y: 30, anchorX: 25, anchorY: 60 }]
  });
  assert.deepEqual(
    [anchoredIllustration.markers[0].x, anchoredIllustration.markers[0].y, anchoredIllustration.markers[0].anchorX, anchoredIllustration.markers[0].anchorY],
    [75, 30, 25, 60]
  );
  assert.deepEqual(
    anatomyIllustrationToDatabase(anchoredIllustration).markers[0],
    { key: '1', x: 75, y: 30, anchorX: 25, anchorY: 60, placement: 'top', zh: '', en: '' }
  );
  assert.equal(illustration.zoom, 1);
});

test('normalizes marker keys to their ordered numeric labels after deletion', () => {
  const marker = (key: string) => ({ key, x: 10, y: 20, placement: 'top', zh: '', en: '' });
  const markers = normalizeAnatomyMarkers([marker('old-a'), marker('old-c')]);
  assert.deepEqual(markers.map((item) => item.key), ['1', '2']);
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
  const viewportMigration = readFileSync('supabase/migrations/202609300002_add_anatomy_image_viewport.sql', 'utf8');
  assert.match(viewportMigration, /image_zoom numeric/i);
  assert.match(viewportMigration, /image_offset_x numeric/i);
  assert.match(viewportMigration, /image_offset_y numeric/i);
  const attributionMigration = readFileSync('supabase/migrations/202609300003_add_anatomy_photo_credit.sql', 'utf8');
  assert.match(attributionMigration, /photo_attribution text/i);
  assert.match(attributionMigration, /photo_link text/i);
  const multipleMigration = readFileSync('supabase/migrations/202609300004_add_multiple_anatomy_illustrations.sql', 'utf8');
  assert.match(multipleMigration, /ADD COLUMN IF NOT EXISTS illustrations JSONB/i);
  assert.match(multipleMigration, /jsonb_build_array\(jsonb_build_object/);
  assert.match(multipleMigration, /is_valid_anatomy_illustrations\(illustrations\)/);
  const titleMigration = readFileSync('supabase/migrations/202609300005_add_anatomy_illustration_titles.sql', 'utf8');
  assert.match(titleMigration, /title_zh text/i);
  assert.match(titleMigration, /title_en text/i);
  assert.match(titleMigration, /title_zh/);
  assert.match(titleMigration, /title_en/);
});

test('fits images inside a 4:3 frame and clamps pan to the visible frame bounds', () => {
  assert.deepEqual(fitAnatomyImage(400, 300, 1600, 900), { width: 400, height: 225 });
  const limits = getAnatomyPanLimits(400, 300, 400, 225, 2);
  const pan = clampAnatomyPan(60, -60, limits);
  assert.equal(pan.offsetX, 50);
  assert.ok(Math.abs(pan.offsetY - (-100 / 3)) < 0.001);
});

test('keeps the cursor focal point fixed while zooming', () => {
  const nextPan = getAnatomyZoomPan(1, 2, 100, -50, 400, 300, 0, 0, { x: 100, y: 100 });
  assert.deepEqual(nextPan, { offsetX: -25, offsetY: 16.666666666666664 });
});

test('keeps pointer pan distance consistent at the current zoom', () => {
  assert.equal(getAnatomyPanOffset(0, 10, 400, 2), 1.25);
});