import { parseSettings } from "./args.ts";
import { createSiteLayout, printLayout } from "./layout.ts";
import { generateWebsite } from "./site-gen.ts";

async function main(args: string[]) {
  const cwd = Deno.cwd().replaceAll("\\", "/")

  const settings = await parseSettings(cwd, args)
  if (settings.debugLog) {
    console.log("Settings:", settings)
  }

  const layout = await createSiteLayout(settings.rootDir)
  if (!layout.valid) {
    return
  }

  if (settings.debugLog) {
    printLayout(layout)
  }

  await generateWebsite(layout, settings)
}

await main(Deno.args)