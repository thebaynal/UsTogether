import assert from 'node:assert/strict';
import { defaultThemeByKind, getPalette } from '../src/theme/palettes';
import { isValidMemoryDate, MAX_IMAGE_BYTES, sortMemories, validateImageSelection } from '../src/features/memories/logic';
import type { Memory } from '../src/types/domain';

let completed = 0;
function check(name: string, run: () => void) {
  run();
  completed += 1;
  console.log(`✓ ${name}`);
}

function memory(id: string, date: string, createdAt: string): Memory {
  return {
    id, spaceId: 'space', createdBy: 'user', title: id, date, caption: null, milestoneTag: null,
    imagePath: `${id}.jpg`, imageUrl: '', imageMimeType: 'image/jpeg', createdAt
  };
}

check('timeline sorts by memory date and creation time without mutating input', () => {
  const input = [memory('later', '2025-03-02', '2025-03-02T10:00:00Z'), memory('same-day-late', '2025-03-01', '2025-03-01T12:00:00Z'), memory('same-day-early', '2025-03-01', '2025-03-01T09:00:00Z')];
  const sorted = sortMemories(input);
  assert.deepEqual(sorted.map((item) => item.id), ['same-day-early', 'same-day-late', 'later']);
  assert.equal(input[0].id, 'later');
});

check('space types receive pastel defaults and allow a palette override', () => {
  assert.equal(defaultThemeByKind.couple, 'rose');
  assert.equal(defaultThemeByKind.group, 'peach');
  assert.equal(defaultThemeByKind.team, 'sky');
  assert.equal(getPalette('couple', 'mint').key, 'mint');
  assert.notEqual(getPalette('team', null).ink, getPalette('team', null).background);
});

check('image selection accepts only JPEG, PNG, and WebP within 10 MB', () => {
  assert.equal(validateImageSelection({ fileName: 'pic.jpg', mimeType: 'image/jpeg', fileSize: MAX_IMAGE_BYTES }), 'image/jpeg');
  assert.equal(validateImageSelection({ fileName: 'pic.png', fileSize: 12 }), 'image/png');
  assert.equal(validateImageSelection({ fileName: 'pic.webp', mimeType: 'image/webp', fileSize: 12 }), 'image/webp');
  assert.throws(() => validateImageSelection({ fileName: 'pic.gif', fileSize: 12 }), /JPEG, PNG, or WebP/);
  assert.throws(() => validateImageSelection({ fileName: 'pic.jpg', fileSize: MAX_IMAGE_BYTES + 1 }), /10 MB/);
  assert.throws(() => validateImageSelection({ fileName: 'pic.jpg', mimeType: 'image/heic', fileSize: 12 }), /JPEG, PNG, or WebP/);
});

check('memory dates reject impossible calendar values', () => {
  assert.equal(isValidMemoryDate('2024-02-29'), true);
  assert.equal(isValidMemoryDate('2025-02-29'), false);
  assert.equal(isValidMemoryDate('2025-13-01'), false);
  assert.equal(isValidMemoryDate('2025-1-01'), false);
});

console.log(`${completed} checks passed.`);
