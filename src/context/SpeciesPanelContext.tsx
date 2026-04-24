'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';

interface SpeciesPanelContextType {
  openSpeciesIds: string[];
  activeSpeciesId: string | null;
  isExpanded: boolean;
  addSpecies: (id: string) => void;
  removeSpecies: (id: string) => void;
  setActiveSpecies: (id: string) => void;
  toggleExpand: (expand?: boolean) => void;
}

const SpeciesPanelContext = createContext<SpeciesPanelContextType | undefined>(undefined);

export const SpeciesPanelProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [openSpeciesIds, setOpenSpeciesIds] = useState<string[]>([]);
  const [activeSpeciesId, setActiveSpeciesId] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);

  const addSpecies = (id: string) => {
    setOpenSpeciesIds((prev) => {
      if (prev.includes(id)) {
        setActiveSpeciesId(id);
        setIsExpanded(true);
        return prev;
      }
      
      const newList = [...prev, id];
      // 限制最多 5 個標籤，移除最早開啟的
      if (newList.length > 5) {
        newList.shift();
      }
      
      setActiveSpeciesId(id);
      setIsExpanded(true);
      return newList;
    });
  };

  const removeSpecies = (id: string) => {
    setOpenSpeciesIds((prev) => {
      const newList = prev.filter((item) => item !== id);
      if (activeSpeciesId === id) {
        setActiveSpeciesId(newList.length > 0 ? newList[newList.length - 1] : null);
        if (newList.length === 0) setIsExpanded(false);
      }
      return newList;
    });
  };

  const setActiveSpecies = (id: string) => {
    setActiveSpeciesId(id);
    setIsExpanded(true);
  };

  const toggleExpand = (expand?: boolean) => {
    setIsExpanded((prev) => (expand !== undefined ? expand : !prev));
  };

  return (
    <SpeciesPanelContext.Provider
      value={{
        openSpeciesIds,
        activeSpeciesId,
        isExpanded,
        addSpecies,
        removeSpecies,
        setActiveSpecies,
        toggleExpand,
      }}
    >
      {children}
    </SpeciesPanelContext.Provider>
  );
};

export const useSpeciesPanel = () => {
  const context = useContext(SpeciesPanelContext);
  if (context === undefined) {
    throw new Error('useSpeciesPanel must be used within a SpeciesPanelProvider');
  }
  return context;
};
