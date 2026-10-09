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
  controls: Control[];
  info: MapInfo;
  /** null tills användaren har valt på steget "Granska karta" */
  isPrivate: boolean | null;
  setTerrain: (terrain: Terrain) => void;
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
  const [controls, setControls] = useState<Control[]>([]);
  const [info, setInfo] = useState<MapInfo>(EMPTY_INFO);
  const [isPrivate, setIsPrivate] = useState<boolean | null>(null);

  function setTerrain(newTerrain: Terrain) {
    setTerrainState(newTerrain);
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
        controls,
        info,
        isPrivate,
        setTerrain,
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
