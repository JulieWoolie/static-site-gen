import { dirname, extname } from "@std/path";
import { ProgramSettings } from "./args.ts";
import { SiteLayout, SiteLayoutNode, TemplateFileCollection } from "./layout.ts";
import { joinPaths, safeMkdir } from "./utils.ts";
import Handlebars from "handlebars"
import markdown, { Options } from "@wcj/markdown-to-html"

interface FrontMatter {
  title: string
  author: string
  customParams: {[key: string]: any}
}

interface ContentFile {
  frontMatter: FrontMatter
  layoutNode: SiteLayoutNode
  fileFormat: "md" | "html"
  content: string
  outPath: string
}

type TemplateMap = {[name: string]: Handlebars.Template}

interface GenerationContext {
  layout: SiteLayout
  settings: ProgramSettings
  outDir: string

  compiledPartials: TemplateMap
  compileElements: TemplateMap

  compiledRoot: Handlebars.Template

  fileLookup: {[path: string]: ContentFile}
}

const MARKDOWN_OPTIONS: Options = {
  remarkRehypeOptions: {
    allowDangerousHtml: true,
  }
}

async function compileTemplateFiles(f: TemplateFileCollection, out: TemplateMap) {
  for (const tf of f) {
    const content = await Deno.readTextFile(tf.path)
    out[tf.identifier] = Handlebars.compile(content)
  }
}

async function compileContentFile(path: string, opath: string, lnode: SiteLayoutNode, gc: GenerationContext) {
  const ext = extname(path)
  const cfile: ContentFile = {
    fileFormat: "html",
    frontMatter: {
      author: "",
      title: "",
      customParams: {}
    },
    content: "",
    layoutNode: lnode,
    outPath: opath
  }

  if (ext == ".md") {
    cfile.fileFormat = "md"
  }

  let content = (await Deno.readTextFile(path)).trim()
  if (content.startsWith("---")) {
    const after = content.substring(3)
    const end = after.indexOf("---")

    if (end != -1) {
      const fmJson = after.substring(0, end)
      const obj: any = JSON.parse(fmJson)

      for (const key in obj) {
        const v = obj[key]
        switch (key) {
          case "author":
            cfile.frontMatter.author = v as string
            break
          case "title":
            cfile.frontMatter.title = v as string
            break
          default:
            cfile.frontMatter.customParams[key] = v
            break
        }
      }

      content = after.substring(end + 3).trim()
    }
  }

  if (cfile.fileFormat == "md") {
    content = markdown(content, MARKDOWN_OPTIONS) as string
  }

  cfile.content = content
  console.log("compile content file end reached! out:", opath)

  gc.fileLookup[path] = cfile
}

function getOutputPath(url: string): string {
  let n: string

  if (url.endsWith("/")) {
    n = url.substring(0, url.length - 1)
  } else {
    n = url
  }

  n = n.replaceAll(".md", ".html")

  if (n.length == 0) {
    return "index.html"
  }

  if (n.endsWith(".html")) {
    return n
  }

  return `${n}.html`
}

async function compileContentTree(t: SiteLayoutNode, gc: GenerationContext) {
  const opath = getOutputPath(t.urlPath)
  
  if (t.type == "section") {
    if (t.indexFilePath != "") {
      await compileContentFile(t.indexFilePath, opath, t, gc)
    }
    for (const c of t.children) {
      await compileContentTree(c, gc)
    }

    return
  }

  await compileContentFile(t.filePath, opath, t, gc)
}

async function evaluateContentFile(cf: ContentFile, gc: GenerationContext) {
  const cr = gc.compiledRoot as Handlebars.TemplateDelegate

  const out = cr({}, {
    partials: {
      ...gc.compiledPartials,
      "content": cf.content
    }
  })

  const outPath = `${gc.outDir}${cf.outPath}`
  const dir = dirname(outPath)
  
  await safeMkdir(dir)

  await Deno.writeTextFile(outPath, out)
}

export async function generateWebsite(layout: SiteLayout, settings: ProgramSettings) {
  const outDir = settings.outputPath

  try {
    await Deno.remove(outDir, {recursive: true})
  } catch(_) {
    // who cares
  }

  await safeMkdir(outDir)

  for (const sf of layout.staticFiles) {
    const outPath = joinPaths(outDir, sf.urlPath)
    const dir = dirname(outPath)

    await safeMkdir(dir)
    await Deno.copyFile(sf.filePath, outPath)
  }

  const gc: GenerationContext = {
    layout,
    settings,
    outDir,
    compiledPartials: {},
    compileElements: {},

    compiledRoot: Handlebars.compile(await Deno.readTextFile(layout.mainFile)),

    fileLookup: {}
  }

  await compileTemplateFiles(layout.customElements, gc.compileElements)
  await compileTemplateFiles(layout.partials, gc.compiledPartials)

  await compileContentTree(layout.contentTree!, gc)

  console.log(gc)

  for (const key in gc.fileLookup) {
    const cf = gc.fileLookup[key]!
    await evaluateContentFile(cf, gc)
  }
}