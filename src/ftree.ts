import { basename, dirname, extname } from "@std/path";

export class FileTreeNode {
  type: "file" | "directory" = "file"
  fullPath: string = ""
  fileName: string = ""
  dirName: string = ""
  extension: string = ""
  children: FileTreeNode[] = []

  constructor() {

  }

  findDir(name: string): FileTreeNode | null {
    for (const n of this.children) {
      if (n.type != "directory") {
        continue
      }
      if (n.fileName != name) {
        continue
      }
      return n
    }
    return null
  }

  find(name: string, exts?: string[]): FileTreeNode | null {
    for (const n of this.children) {
      if (n.fileName != name) {
        continue
      }
      if (exts && !exts.includes(n.extension)) {
        continue
      }

      return n
    }
    return null
  }

  getChildrenRecursive(): FileTreeNode[] {
    if (this.children.length == 0) {
      return []
    }

    const res: FileTreeNode[] = []

    for (const ch of this.children) {
      res.push(ch)
      res.push(...ch.getChildrenRecursive())
    }

    return res
  }
}

export async function parseFileTree(path: string): Promise<FileTreeNode> {
  const opened = await Deno.open(path)
  const stat = await opened.stat()

  const ext = extname(path)
  let fname = basename(path)

  fname = fname.substring(0, fname.length - ext.length)

  const node: FileTreeNode = new FileTreeNode()
  node.type = "file"
  node.fullPath = path
  node.fileName = fname
  node.dirName = dirname(path)
  node.extension = ext
  node.children = []

  if (stat.isDirectory) {
    node.type = "directory"

    for await (const e of Deno.readDir(path)) {
      const n = await parseFileTree(`${path}/${e.name}`)
      node.children.push(n)
    }
  }

  return node
}