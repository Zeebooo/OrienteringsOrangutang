import { randomUUID } from 'expo-crypto';
import React, { createContext, useContext, useState } from 'react';

import type { Control, Coordinate, Terrain } from '@/types';

type CreateMapState = {
  terrain: Terrain | null;
  controls: Control[];
  setTerrain: (terrain: Terrain) => void;
  /** Lägger till en kontroll och returnerar dess id. */
  addControl: (position: Coordinate) => string;
  moveControl: (id: string, position: Coordinate) => void;
  /** Ändrar namn och/eller position. id kan inte ändras. */
  updateControl: (id: string, changes: Partial<Omit<Control, 'id'>>) => void;
  removeControl: (id: string) => void;
};

const CreateMapContext = createContext<CreateMapState | null>(null);

export function CreateMapProvider({ children }: { children: React.ReactNode }) {
  const [terrain, setTerrainState] = useState<Terrain | null>(null);
  const [controls, setControls] = useState<Control[]>([]);

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
    <CreateMapContext.Provider value={{ terrain, controls, setTerrain, addControl, moveControl, updateControl, removeControl }}>
      {children}
    </CreateMapContext.Provider>
  );
}

export function useCreateMap() {
  const context = useContext(CreateMapContext);
  if (!context) throw new Error('useCreateMap måste användas inuti CreateMapProvider');
  return context;
}
