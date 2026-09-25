import React, { createContext, useContext, useState } from 'react';

// Skapar själva minnesbanken
const ProgressContext = createContext<any>(null);

export function ProgressProvider({ children }: { children: React.ReactNode }) {
  const [startedMaps, setStartedMaps] = useState<string[]>([]);
  const [completedMaps, setCompletedMaps] = useState<string[]>([]);

  // Funktion för att starta en karta
  const startMap = (id: string) => {
    if (!startedMaps.includes(id)) {
      setStartedMaps([...startedMaps, id]);
    }
  };

  // Funktion för att avsluta en karta
  const completeMap = (id: string) => {
    if (!completedMaps.includes(id)) {
      setCompletedMaps([...completedMaps, id]);
    }
  };

  return (
    <ProgressContext.Provider value={{ startedMaps, completedMaps, startMap, completeMap }}>
      {children}
    </ProgressContext.Provider>
  );
}

// Enkel krok (hook) för att använda minnet i andra filer
export function useProgress() {
  return useContext(ProgressContext);
}