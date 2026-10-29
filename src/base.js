// Deployment base ('/' locally, '/repo-name/' on GitHub Pages). Node tests have no import.meta.env.
const base = import.meta.env?.BASE_URL ?? '/';

export function withBase(path) {
  return `${base}${path.replace(/^\//, '')}`;
}
