import { createScene } from './creation';
import { Drawing, Scene } from './types';

const ELEMENTS_STORAGE_KEY = 'excalidraw-elements';
const SCENE_STORAGE_KEY = 'claymate-scenes';

const loadDrawingFromStorage = (): Drawing | null => {
  try {
    const data = JSON.parse(localStorage.getItem(ELEMENTS_STORAGE_KEY) || '');
    data.appState.collaborators = new Map();
    return data;
  } catch {
    return null;
  }
};

type StoredScene = { drawing: Drawing; duration?: number };

type StoredData =
  | StoredScene[]
  | { scenes: StoredScene[]; sceneSize?: { width: number; height: number } };

export const loadStorage = async (): Promise<{
  scenes: Scene[];
  sceneSize?: { width: number; height: number };
} | null> => {
  try {
    const stored = localStorage.getItem(SCENE_STORAGE_KEY) || '';
    const parsed: StoredData | undefined =
      stored && stored.length > 0 ? JSON.parse(stored) : undefined;

    if (!parsed) return null;

    const storedScenes: StoredScene[] = Array.isArray(parsed)
      ? parsed
      : parsed.scenes;

    // Migration: old format stored sceneSize in a separate key
    let sceneSize: { width: number; height: number } | undefined =
      Array.isArray(parsed) ? undefined : parsed.sceneSize;
    if (Array.isArray(parsed)) {
      try {
        const legacySize = localStorage.getItem('claymate-scene-size');
        if (legacySize) {
          sceneSize = JSON.parse(legacySize) as {
            width: number;
            height: number;
          };
          localStorage.removeItem('claymate-scene-size');
        }
      } catch {
        /* empty */
      }
    }

    if (!storedScenes || storedScenes.length === 0) return null;

    const normalizedScenes: StoredScene[] = storedScenes.map((item) =>
      'drawing' in item ? item : { drawing: item as Drawing },
    );

    let firstScene: Scene | undefined;
    const scenes: Scene[] = [];
    for (const { drawing, duration } of normalizedScenes) {
      drawing.appState.collaborators = new Map();
      const scene = await createScene(
        drawing,
        sceneSize ??
          (firstScene
            ? { width: firstScene.width, height: firstScene.height }
            : undefined),
      );
      if (scene) {
        if (duration !== undefined) {
          scene.duration = duration;
        }
        if (!firstScene) {
          firstScene = scene;
        }
        scenes.push(scene);
      }
    }
    return { scenes, sceneSize };
  } catch (e) {
    console.error('Error loading from storage', e);
    try {
      const drawing = loadDrawingFromStorage();
      if (drawing) {
        const scene = await createScene(drawing);
        if (scene) {
          return { scenes: [scene] };
        }
      }
    } catch {
      /* empty */
    }
  }
  return null;
};

export const saveStorage = (
  scenes: Scene[],
  sceneSize?: { width: number; height: number },
) => {
  const result = JSON.stringify({
    scenes: scenes.map((s) => ({ drawing: s.drawing, duration: s.duration })),
    ...(sceneSize && { sceneSize }),
  });
  localStorage.setItem(SCENE_STORAGE_KEY, result);
};
