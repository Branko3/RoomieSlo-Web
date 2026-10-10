"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { AuthProvider } from "./auth-provider";

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
    const saved = window.localStorage.getItem("roomieslo:favorites");
    if (saved) {
      try {
        setFavorites(JSON.parse(saved));
      } catch {
        window.localStorage.removeItem("roomieslo:favorites");
      }
    }
    setFavoritesLoaded(true);
  }, []);

  useEffect(() => {
    if (!favoritesLoaded) return;
    window.localStorage.setItem(
      "roomieslo:favorites",
      JSON.stringify(favorites),
    );
  }, [favorites, favoritesLoaded]);

  const favoriteValue = useMemo(
    () => ({
      favorites,
      isFavorite: (listingId: string) => favorites.includes(listingId),
      toggleFavorite: (listingId: string) =>
        setFavorites((current) =>
          current.includes(listingId)
            ? current.filter((id) => id !== listingId)
            : [...current, listingId],
        ),
    }),
    [favorites],
  );

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <FavoriteContext.Provider value={favoriteValue}>
          {children}
        </FavoriteContext.Provider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
