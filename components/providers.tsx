"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import {
  FAVORITES_KEY,
  parseFavorites,
  serializeFavorites,
  toggleFavoriteId,
} from "../lib/favorites";

type FavoriteContextValue = {
  favorites: string[];
  isFavorite: (listingId: string) => boolean;
  toggleFavorite: (listingId: string) => void;
};

const FavoriteContext = createContext<FavoriteContextValue | null>(null);

export function useFavorites() {
  const context = useContext(FavoriteContext);
  if (!context) {
    throw new Error("useFavorites must be used inside Providers");
  }
  return context;
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            retry: 1,
            refetchOnWindowFocus: false,
            refetchOnReconnect: true,
          },
        },
      }),
  );
  const [favorites, setFavorites] = useState<string[]>([]);
  const [favoritesLoaded, setFavoritesLoaded] = useState(false);

  useEffect(() => {
    const saved = parseFavorites(window.localStorage.getItem(FAVORITES_KEY));
    if (saved) setFavorites(saved);
    else window.localStorage.removeItem(FAVORITES_KEY);
    setFavoritesLoaded(true);
  }, []);

  useEffect(() => {
    if (!favoritesLoaded) return;
    window.localStorage.setItem(FAVORITES_KEY, serializeFavorites(favorites));
  }, [favorites, favoritesLoaded]);

  const favoriteValue = useMemo(
    () => ({
      favorites,
      isFavorite: (listingId: string) => favorites.includes(listingId),
      toggleFavorite: (listingId: string) =>
        setFavorites((current) => toggleFavoriteId(current, listingId)),
    }),
    [favorites],
  );

  return (
    <QueryClientProvider client={queryClient}>
      <FavoriteContext.Provider value={favoriteValue}>
        {children}
      </FavoriteContext.Provider>
    </QueryClientProvider>
  );
}
