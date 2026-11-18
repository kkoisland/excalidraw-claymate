import { useCallback, useEffect, useRef, useState } from 'react';
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types';
import type { AppState, BinaryFiles } from '@excalidraw/excalidraw/types';
import { nanoid } from 'nanoid';
import { createScene } from './creation';
import { DEFAULT_DURATION } from './types';
import type { Drawing, Scene } from './types';
import { loadStorage, saveStorage } from './persistence';
import { isEqual } from 'lodash';

enum Initialisation {
  NotStarted,
  Started,
  Complete,
}

export const useScenes = () => {
  const initialisedRef = useRef<Initialisation>(Initialisation.NotStarted);
  const generationRef = useRef(0);
  const [drawingVersion, setDrawingVersion] = useState(0);
  const [currentIndex, setCurrentIndex] = useState<number | undefined>(0);
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [drawing, setDrawing] = useState<Drawing | undefined>();
  const [sceneSize, setSceneSize] = useState<
    { width: number; height: number } | undefined
  >(undefined);

  const currentScene =
    currentIndex !== undefined && currentIndex < scenes.length
      ? { ...scenes[currentIndex], drawing }
      : undefined;

  let requiredWidth: number | undefined;
  let requiredHeight: number | undefined;
  if (sceneSize) {
    requiredWidth = sceneSize.width;
    requiredHeight = sceneSize.height;
  } else if (currentScene != null && scenes.length !== 1) {
    requiredWidth = currentScene.width;
    requiredHeight = currentScene.height;
  }

  const onRestore = useCallback(
    (
      drawing: Drawing,
      index: number,
      updateCurrent: ((index: number, drawing: Drawing) => void) | undefined,
    ) => {
      setDrawingVersion((version) => version + 1);
      setDrawing(drawing);
      if (updateCurrent && index !== undefined) {
        updateCurrent(index, drawing);
      }
    },
    [],
  );

  const updateCurrentScene = useCallback(
    (index: number, drawing: Drawing) => {
      if (index != null && drawing) {
        generationRef.current += 1;
        const generation = generationRef.current;
        (async () => {
          const scene = await createScene(
            drawing,
            requiredWidth === undefined || requiredHeight === undefined
              ? undefined
              : {
                  width: requiredWidth,
                  height: requiredHeight,
                },
          );
          if (generationRef.current !== generation) return;
          if (scene) {
            setScenes((prev) => {
              const result = [...prev];
              result[index] = {
                ...scene,
                duration: prev[index]?.duration ?? scene.duration,
              };
              return result;
            });
          }
        })();
      }
    },
    [requiredWidth, requiredHeight],
  );

  const updateScenes = useCallback(
    (
      updater: (prev: Scene[]) => Scene[],
      newCurrent: { index: number; drawing: Drawing } | undefined,
    ) => {
      setScenes(updater);
      if (newCurrent) {
        setCurrentIndex(newCurrent.index);
        onRestore(newCurrent.drawing, newCurrent.index, updateCurrentScene);
      }
    },
    [setCurrentIndex, onRestore, updateCurrentScene],
  );

  const onChange = (
    elements: readonly ExcalidrawElement[],
    appState: AppState,
    files: BinaryFiles,
  ) => {
    if (
      currentIndex !== undefined &&
      (drawing == null ||
        !isEqual(elements, drawing.elements) ||
        !isEqual(appState, drawing.appState))
    ) {
      const update = {
        elements: elements.map((el) => {
          return { ...el };
        }),
        appState: { ...appState },
        files,
      };
      setDrawing(update);
      updateCurrentScene(currentIndex, update);
    }
  };

  const moveToScene = useCallback(
    (index: number) => {
      onRestore(scenes[index].drawing, index, updateCurrentScene);
      setCurrentIndex(index);
    },
    [onRestore, scenes, updateCurrentScene],
  );

  const addScene = useCallback(
    (optionalDrawing?: Drawing) => {
      const drawingToAdd = optionalDrawing || drawing;
      if (drawingToAdd) {
        const generation = generationRef.current;
        (async () => {
          const scene = await createScene(
            drawingToAdd,
            sceneSize ??
              (scenes[0] && {
                width: scenes[0].width,
                height: scenes[0].height,
              }),
          );
          if (generationRef.current !== generation) return;
          if (scene) {
            updateScenes((prev) => [...prev, scene], {
              index: scenes.length,
              drawing: drawingToAdd,
            });
          }
        })();
      }
    },
    [updateScenes, scenes, drawing, sceneSize],
  );

  const updateSceneSize = useCallback(
    (size: { width: number; height: number }) => {
      generationRef.current += 1;
      const generation = generationRef.current;
      (async () => {
        const newScenes: Scene[] = [];
        for (const scene of scenes) {
          const newScene = await createScene(scene.drawing, size);
          if (generationRef.current !== generation) return;
          if (newScene) {
            newScene.duration = scene.duration;
            newScenes.push(newScene);
          }
        }
        if (generationRef.current !== generation) return;
        setSceneSize(size);
        setScenes(newScenes);
      })();
    },
    [scenes],
  );

  const clearScenes = useCallback(() => {
    generationRef.current += 1;
    const appState =
      drawing?.appState ??
      (currentIndex !== undefined
        ? scenes[currentIndex]?.drawing.appState
        : scenes[0]?.drawing.appState);
    if (!appState) {
      return;
    }
    const blankDrawing: Drawing = { elements: [], appState, files: null };
    const finalScene = {
      id: nanoid(),
      width: 1,
      height: 1,
      imageData: new ImageData(1, 1),
      drawing: blankDrawing,
      duration: DEFAULT_DURATION,
    };
    setScenes(() => [finalScene]);
    setSceneSize(undefined);
    setCurrentIndex(0);
    setDrawing(blankDrawing);
    setDrawingVersion((v) => v + 1);
  }, [drawing, currentIndex, scenes]);

  useEffect(() => {
    if (initialisedRef.current === Initialisation.NotStarted) {
      initialisedRef.current = Initialisation.Started;
      (async () => {
        const loaded = await loadStorage();
        if (loaded && loaded.scenes.length > 0) {
          if (loaded.sceneSize) {
            setSceneSize(loaded.sceneSize);
          }
          setScenes(loaded.scenes);
          setCurrentIndex(0);
          onRestore(loaded.scenes[0].drawing, 0, undefined);
        } else {
          addScene();
        }
        initialisedRef.current = Initialisation.Complete;
      })();
    }
  }, [updateCurrentScene, onRestore, addScene]);

  useEffect(() => {
    if (initialisedRef.current === Initialisation.Complete) {
      saveStorage(scenes, sceneSize);
    }
  }, [scenes, sceneSize]);

  return {
    moveToScene,
    addScene,
    clearScenes,
    onChange,
    drawingVersion,
    currentIndex,
    scenes,
    updateScenes,
    sceneSize,
    updateSceneSize,
    initialData: drawing,
  };
};
