import { randomUUID } from 'expo-crypto';
import React, { createContext, useContext, useState } from 'react';

import type { Control, Coordinate, Difficulty, Terrain } from '@/types';

/** Det användaren fyller i på steget "Kartinformation". */
export type MapInfo = {
  name: string;
  description: string;
  difficulty: Difficulty | null;
};

type CreateMapState = {
  terrain: Terrain | null;
  /**
   * Bild på området (JPG i base64) för kartlistan. Tas först i "Välj område" och byts sedan ut mot
   * en med terrängen i "Placera kontroller". null om ingen bild kunde tas.
   */
  thumbnail: string | null;
  controls: Control[];
  info: MapInfo;
  /** Väljs med togglen på steget "Granska karta". Kartan är publik om man inte slår på den. */
  isPrivate: boolean;
  /** Byter område. Bilden hör till området, så den sätts samtidigt. */
  setTerrain: (terrain: Terrain, thumbnail: string | null) => void;
  /** Byter ut bilden, t.ex. mot en med terrängen från steget "Placera kontroller". */
  setThumbnail: (thumbnail: string) => void;
  /** Lägger till en kontroll och returnerar dess id. */
  addControl: (position: Coordinate) => string;
  moveControl: (id: string, position: Coordinate) => void;
  /** Ändrar namn och/eller position. id kan inte ändras. */
  updateControl: (id: string, changes: Partial<Omit<Control, 'id'>>) => void;
  removeControl: (id: string) => void;
  setInfo: (info: MapInfo) => void;
  setIsPrivate: (isPrivate: boolean) => void;
};

const EMPTY_INFO: MapInfo = { name: '', description: '', difficulty: null };

const CreateMapContext = createContext<CreateMapState | null>(null);

export function CreateMapProvider({ children }: { children: React.ReactNode }) {
  const [terrain, setTerrainState] = useState<Terrain | null>(null);
  const [thumbnail, setThumbnail] = useState<string | null>(null);
  const [controls, setControls] = useState<Control[]>([]);
  const [info, setInfo] = useState<MapInfo>(EMPTY_INFO);
  const [isPrivate, setIsPrivate] = useState(false);

  function setTerrain(newTerrain: Terrain, newThumbnail: string | null) {
    setTerrainState(newTerrain);
    setThumbnail(newThumbnail);
    setControls([]); // nytt område → gamla kontroller ligger inte längre på kartan
  }

  function addControl(position: Coordinate) {
    // Unikt id som aldrig ändras – runs.visited_controls pekar på det
    const id = randomUUID();
    setControls((prev) => [...prev, { id, ...position }]);
    return id;
  }

  function updateControl(id: string, changes: Partial<Omit<Control, 'id'>>) {
    setControls((prev) => prev.map((c) => (c.id === id ? { ...c, ...changes } : c)));
  }

  function moveControl(id: string, position: Coordinate) {
    updateControl(id, position);
  }

  function removeControl(id: string) {
    setControls((prev) => prev.filter((c) => c.id !== id));
  }

  return (
    <CreateMapContext.Provider
      value={{
        terrain,
        thumbnail,
        controls,
        info,
        isPrivate,
        setTerrain,
        setThumbnail,
        addControl,
        moveControl,
        updateControl,
        removeControl,
        setInfo,
        setIsPrivate,
      }}
    >
      {children}
    </CreateMapContext.Provider>
  );
}

export function useCreateMap() {
  const context = useContext(CreateMapContext);
  if (!context) throw new Error('useCreateMap måste användas inuti CreateMapProvider');
  return context;
}
