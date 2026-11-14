import { relative } from "@std/path";
import { FileTreeNode, parseFileTree } from "./ftree.ts";

export interface TemplateHtmlFile {
  identifier: string
  path: string
}

export type TemplateFileCollection = TemplateHtmlFile[]

export interface StaticFile {
  filePath: string
  urlPath: string
}

export interface LayoutSectionNode {
  type: "section"
  indexFilePath: string
  children: SiteLayoutNode[]
  filePath: string
  urlPath: string
}

export interface LayoutContentNode {
  type: "page"
  filePath: string
  urlPath: string
}

export type SiteLayoutNode = LayoutSectionNode | LayoutContentNode

export interface SiteLayout {
  rootDir: string
  mainFile: string
  customElements: TemplateFileCollection
  partials: TemplateFileCollection
  contentTree?: SiteLayoutNode
  staticFiles: StaticFile[]
  valid: boolean
}

const ACCEPTED_CONTENT_FILE_FORMATS: string[] = [
  ".html",
  ".md",
]

function findTemplateFiles(dir: FileTreeNode | null, out: TemplateFileCollection): boolean {
  if (!dir) {
    return true
  }

  for (const c of dir.children) {
    if (c.type == "directory") {
      continue
    }
    out.push({
      identifier: c.fileName,
      path: c.fullPath
    })
  }

  const idMap: {[id: string]: string[]} = {}

  for (const tf of out) {
    let arr = idMap[tf.identifier]

    if (arr == undefined) {
      arr = []
      idMap[tf.identifier] = arr
    }

    arr.push(tf.path)
  }

  let conflictFound = false
  for (const id in idMap) {
    const arr = idMap[id]

    if (arr.length < 2) {
      continue
    }

    console.error(`Found conflicting template files for identifier '${id}':`)
    for (const p of arr) {
      console.error(`  - ${p}`)
    }
    conflictFound = true
  }

  return !conflictFound
}

function urlPath(rootPath: string, subPath: string): string {
  return "/" + relative(rootPath, subPath).replaceAll("\\", "/")
}

function findStaticFiles(root: FileTreeNode, out: StaticFile[]): boolean {
  const n = root.find("static")
  if (!n) {
    return true
  }

  if (n.type != "directory") {
    console.error(`Static directory ${n.fullPath} is not a directory`)
    return false
  }

  const allChildren = n.getChildrenRecursive()
  for (const c of allChildren) {
    if (c.type == "directory") {
      continue
    }
    
    out.push({
      urlPath: urlPath(n.fullPath, c.fullPath),
      filePath: c.fullPath
    })
  }
  
  return true
}

function recursivelyComposeContent(n: FileTreeNode, p: LayoutSectionNode, root: FileTreeNode) {
  if (n.type != "directory") {
    p.children.push({
      type: "page",
      filePath: n.fullPath,
      urlPath: urlPath(root.fullPath, n.fullPath)
    })
    return
  }

  const indexFile = n.find("index", ACCEPTED_CONTENT_FILE_FORMATS)
  if (indexFile) {
    const node: LayoutSectionNode = {
      type: "section",
      children: [],
      filePath: n.fullPath,
      indexFilePath: indexFile.fullPath,
      urlPath: urlPath(root.fullPath, n.fullPath) + "/"
    }

    for (const ch of n.children) {
      if (ch == indexFile) {
        continue
      }
      recursivelyComposeContent(ch, node, root)
    }

    p.children.push(node)
    return
  }

  for (const ch of n.children) {
    recursivelyComposeContent(ch, p, root)
  }
}

function discoverContentTree(croot: FileTreeNode): SiteLayoutNode | undefined {
  const indexFile = croot.find("index", ACCEPTED_CONTENT_FILE_FORMATS)

  const rootNode: LayoutSectionNode = {
    type: "section",
    filePath: croot.fullPath,
    children: [],
    urlPath: "/",
    indexFilePath: indexFile == null ? "" : indexFile.fullPath
  }

  for (const ch of croot.children) {
    recursivelyComposeContent(ch, rootNode, croot)
  }

  return rootNode
}

export async function createSiteLayout(rootDir: string): Promise<SiteLayout> {
  const result: SiteLayout = {
    rootDir,
    customElements: [],
    partials: [],
    valid: true,
    mainFile: "",
    staticFiles: []
  }

  const ftree = await parseFileTree(rootDir)
  
  const layouts = ftree.findDir("layouts")
  if (!layouts) {
    console.error(`No layouts folder found in ${rootDir}`)
    result.valid = false
    return result
  }

  const mfile = layouts.find("main", [".html"])
  if (!mfile) {
    console.error(`No main file found in ${rootDir}/layouts`)
    result.valid = false
    return result
  }

  const cdir = ftree.findDir("content")
  if (!cdir) {
    console.error(`No content directory found in ${rootDir}`)
    result.valid = false
    return result
  }

  result.mainFile = mfile.fullPath

  result.valid &&= findTemplateFiles(layouts.find("custom-elements"), result.customElements)
  result.valid &&= findTemplateFiles(layouts.find("partials"), result.partials)
  result.valid &&= findStaticFiles(ftree, result.staticFiles)

  result.contentTree = discoverContentTree(cdir)

  return result
}

export function printLayout(l: SiteLayout) {
  console.log(`Site Layout:`, l)
}