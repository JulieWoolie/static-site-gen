import { normalize, join } from "@std/path";

export async function fileExists(path: string): Promise<boolean> {
  try {
    await Deno.open(path)
    return true
  } catch (e) {
    if (e instanceof Deno.errors.NotFound) {
      return false
    }
    throw e
  }
}

export function stripFileExtension(path: string): string {
  const idx = path.lastIndexOf('.')
  if (idx == -1) {
    return path
  }
  return path.substring(0, idx)
}

export function joinPaths(p1: string, ...paths: string[]): string {
  return normalize(join(p1, ...paths)).replaceAll("\\", "/")
}

export async function safeMkdir(dirPath: string) {
  try {
    await Deno.mkdir(dirPath)
  } catch (_) {
    // who cares
  }
}