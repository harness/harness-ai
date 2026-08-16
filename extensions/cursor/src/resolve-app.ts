import * as path from 'node:path';
import type { App } from './api-types';

const FILE_URI_PREFIX = 'file://';

export function workspaceFolderName(workspacePath: string): string {
  return path.basename(workspacePath);
}

export function toFileUri(fsPath: string): string {
  const normalized = path.resolve(fsPath);
  const encoded = normalized.split(path.sep).map(encodeURIComponent).join('/');
  return `${FILE_URI_PREFIX}${process.platform === 'win32' ? '/' : ''}${encoded}`;
}

function uriToFsPath(uri: string): string {
  const raw = uri.startsWith(FILE_URI_PREFIX) ? uri.slice(FILE_URI_PREFIX.length) : uri;
  return path.resolve(decodeURIComponent(raw));
}

function pathsMatch(candidate: string | null | undefined, workspacePath: string): boolean {
  if (!candidate?.trim()) return false;
  const normalizedWorkspace = path.resolve(workspacePath);
  if (candidate === normalizedWorkspace || candidate === workspacePath) return true;
  if (candidate.startsWith(FILE_URI_PREFIX)) {
    try {
      return path.resolve(uriToFsPath(candidate)) === normalizedWorkspace;
    } catch {
      return false;
    }
  }
  return candidate.includes(normalizedWorkspace) || normalizedWorkspace.includes(candidate);
}

export function matchAppToWorkspace(apps: App[], workspacePath: string): App | null {
  const folderName = workspaceFolderName(workspacePath);
  const fileUri = toFileUri(workspacePath);

  for (const app of apps) {
    if (pathsMatch(app.repoUrl, workspacePath) || pathsMatch(app.repoUrl, fileUri)) {
      return app;
    }
  }

  for (const app of apps) {
    if (app.slug === folderName || app.name === folderName) return app;
  }

  for (const app of apps) {
    const repo = app.repoUrl ?? '';
    if (repo && (repo.endsWith(`/${folderName}`) || repo.endsWith(`%2F${encodeURIComponent(folderName)}`))) {
      return app;
    }
  }

  return null;
}
