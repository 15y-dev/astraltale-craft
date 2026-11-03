import { useSyncExternalStore } from 'react';

export type Route =
  | { page: 'home' }
  | { page: 'item'; id: string }
  | { page: 'craft'; id: string }
  | { page: 'unused' };

function subscribe(cb: () => void) {
  window.addEventListener('hashchange', cb);
  return () => window.removeEventListener('hashchange', cb);
}

const getHash = () => window.location.hash;

export function parseHash(hash: string): Route {
  const [, kind, id] = hash.replace(/^#/, '').split('/');
  if (kind === 'item' && id) return { page: 'item', id: decodeURIComponent(id) };
  if (kind === 'craft' && id) return { page: 'craft', id: decodeURIComponent(id) };
  if (kind === 'unused') return { page: 'unused' };
  return { page: 'home' };
}

export function useRoute(): Route {
  const hash = useSyncExternalStore(subscribe, getHash);
  return parseHash(hash);
}

export const itemHref = (id: string) => `#/item/${encodeURIComponent(id)}`;
export const craftHref = (id: string) => `#/craft/${encodeURIComponent(id)}`;
export const unusedHref = () => '#/unused';
export const homeHref = () => '#/';
