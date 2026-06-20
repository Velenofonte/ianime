import versionData from './version.json';

type VersionParts = {
  major: number;
  minor: number;
  build: number;
};

export function formatAppVersion({ major, minor, build }: VersionParts): string {
  return `v.${major}.${minor}.${String(build).padStart(2, '0')}`;
}

export const APP_VERSION = formatAppVersion(versionData as VersionParts);
