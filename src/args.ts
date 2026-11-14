import { parseArgs } from "@std/cli/parse-args"
import { joinPaths } from "./utils.ts";

export interface ProgramSettings {
  rootDir: string
  debugLog: boolean
  outputPath: string
}

export async function toRealPath(i: string): Promise<string> {
  return (await Deno.realPath(i)).replaceAll("\\", "/")
}

export async function parseSettings(cwd: string, args: string[]): Promise<ProgramSettings> {
  const parsed = parseArgs(args, {
    string: ["root", "output-path"],
    boolean: ["debug-log"],
    default: {
      root: "./",
      "debug-log": false,
      "output-path": "./public"
    }
  })

  const rootDir = joinPaths(cwd, parsed.root)
  const outDir = joinPaths(cwd, parsed["output-path"])

  return {
    rootDir,
    debugLog: parsed["debug-log"],
    outputPath: outDir
  }
}