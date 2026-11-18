/* eslint-disable @typescript-eslint/no-explicit-any */
import { test, expect } from 'vitest';
import { loadStorage, saveStorage } from './persistence';
import type { Drawing, Scene } from './types';

const minimalAppState: any = {
  theme: 'light',
  viewBackgroundColor: '#ffffff',
  exportBackground: true,
  exportWithDarkMode: false,
  exportScale: 1,
  width: 100,
  height: 100,
};

const minimalDrawing: Drawing = {
  elements: [],
  appState: { ...minimalAppState },
  files: null,
};

const minimalScene: Scene = {
  id: 'test-id',
  width: 800,
  height: 600,
  imageData: new ImageData(1, 1),
  drawing: minimalDrawing,
  duration: 500,
};

test('loadStorage returns null when storage is empty', async () => {
  const result = await loadStorage();
  expect(result).toBeNull();
});

test('loadStorage reads new format with sceneSize', async () => {
  localStorage.setItem(
    'claymate-scenes',
    JSON.stringify({
      scenes: [{ drawing: minimalDrawing, duration: 750 }],
      sceneSize: { width: 1000, height: 750 },
    }),
  );

  const result = await loadStorage();

  expect(result).not.toBeNull();
  expect(result!.sceneSize).toEqual({ width: 1000, height: 750 });
  expect(result!.scenes).toHaveLength(1);
  expect(result!.scenes[0].duration).toBe(750);
});

test('loadStorage reads old array format (backward compat)', async () => {
  localStorage.setItem(
    'claymate-scenes',
    JSON.stringify([{ drawing: minimalDrawing, duration: 600 }]),
  );

  const result = await loadStorage();

  expect(result).not.toBeNull();
  expect(result!.sceneSize).toBeUndefined();
  expect(result!.scenes).toHaveLength(1);
  expect(result!.scenes[0].duration).toBe(600);
});

test('loadStorage migrates sceneSize from legacy claymate-scene-size key', async () => {
  localStorage.setItem(
    'claymate-scenes',
    JSON.stringify([{ drawing: minimalDrawing }]),
  );
  localStorage.setItem(
    'claymate-scene-size',
    JSON.stringify({ width: 1200, height: 900 }),
  );

  const result = await loadStorage();

  expect(result).not.toBeNull();
  expect(result!.sceneSize).toEqual({ width: 1200, height: 900 });
  expect(localStorage.getItem('claymate-scene-size')).toBeNull();
});

test('saveStorage stores scenes without sceneSize', () => {
  saveStorage([minimalScene]);

  const stored = JSON.parse(localStorage.getItem('claymate-scenes')!);
  expect(stored.scenes).toHaveLength(1);
  expect(stored.sceneSize).toBeUndefined();
});

test('saveStorage stores scenes with sceneSize', () => {
  saveStorage([minimalScene], { width: 1000, height: 750 });

  const stored = JSON.parse(localStorage.getItem('claymate-scenes')!);
  expect(stored.scenes).toHaveLength(1);
  expect(stored.sceneSize).toEqual({ width: 1000, height: 750 });
});

test('saveStorage and loadStorage work without sceneSize', async () => {
  saveStorage([{ ...minimalScene, duration: 1200 }]);

  const result = await loadStorage();

  expect(result).not.toBeNull();
  expect(result!.scenes).toHaveLength(1);
  expect(result!.scenes[0].duration).toBe(1200);
  expect(result!.sceneSize).toBeUndefined();
});

test('saveStorage and loadStorage work with sceneSize', async () => {
  saveStorage([minimalScene], { width: 1000, height: 750 });

  const result = await loadStorage();

  expect(result).not.toBeNull();
  expect(result!.sceneSize).toEqual({ width: 1000, height: 750 });
  expect(result!.scenes).toHaveLength(1);
});
