import { tool } from "ai";
import { simpleGit } from "simple-git";
import { z } from "zod";
import { promises as fs } from "fs";
import path from "path";

const excludeFiles = ["dist", "bun.lock"];

const fileChange = z.object({
  rootDir: z.string().min(1).describe("The root directory"),
});

type FileChange = z.infer<typeof fileChange>;

async function getFileChangesInDirectory({ rootDir }: FileChange) {
  const git = simpleGit(rootDir);
  const summary = await git.diffSummary();
  const diffs: { file: string; diff: string }[] = [];

  for (const file of summary.files) {
    if (excludeFiles.includes(file.file)) continue;
    const diff = await git.diff(["--", file.file]);
    diffs.push({ file: file.file, diff });
  }

  return diffs;
}

export const getFileChangesInDirectoryTool = tool({
  description: "Gets the code changes made in given directory",
  inputSchema: fileChange,
  execute: getFileChangesInDirectory,
});

// Commit message generation
const commitMessageInput = z.object({
  rootDir: z.string().min(1).describe("Repository root directory"),
  type: z
    .enum(["feat", "fix", "docs", "style", "refactor", "perf", "test", "build", "ci", "chore", "revert"]) 
    .default("chore")
    .describe("Conventional commit type"),
  scope: z.string().optional().describe("Optional scope for the commit"),
  maxSubjectLength: z.number().int().positive().default(72).describe("Max subject length"),
});

type CommitMessageInput = z.infer<typeof commitMessageInput>;

async function generateConventionalCommitMessage({ rootDir, type, scope, maxSubjectLength }: CommitMessageInput) {
  const git = simpleGit(rootDir);
  const status = await git.status();
  const summary = await git.diffSummary();

  // Derive scope from most common top-level directory if not provided
  let derivedScope: string | undefined = scope;
  if (!derivedScope && summary.files.length > 0) {
    const scopeCount = new Map<string, number>();
    for (const f of summary.files) {
      const top = f.file.split("/")[0] || "root";
      scopeCount.set(top, (scopeCount.get(top) || 0) + 1);
    }
    let max = 0;
    for (const [s, count] of scopeCount) {
      if (count > max) {
        max = count;
        derivedScope = s === "root" ? undefined : s;
      }
    }
  }

  const created = status.created.length;
  const modified = status.modified.length;
  const deleted = status.deleted.length;
  const renamed = status.renamed.length;

  const subjectBaseParts: string[] = [];
  if (created) subjectBaseParts.push(`${created} new file${created > 1 ? "s" : ""}`);
  if (modified) subjectBaseParts.push(`${modified} update${modified > 1 ? "s" : ""}`);
  if (deleted) subjectBaseParts.push(`${deleted} deletion${deleted > 1 ? "s" : ""}`);
  if (renamed) subjectBaseParts.push(`${renamed} rename${renamed > 1 ? "s" : ""}`);
  const subjectBase = subjectBaseParts.join(", ") || "update files";

  const scopePart = derivedScope ? `(${derivedScope})` : "";
  let subject = `${type}${scopePart}: ${subjectBase}`.trim();
  if (subject.length > maxSubjectLength) {
    subject = subject.slice(0, maxSubjectLength - 1) + "…";
  }

  const lines: string[] = [];
  lines.push(subject);
  lines.push("");
  if (summary.files.length) {
    lines.push("Summary of changes:");
    for (const f of summary.files.slice(0, 50)) {
      const isText = "insertions" in f && "deletions" in f;
      const insertions = isText ? (f as any).insertions : 0;
      const deletions = isText ? (f as any).deletions : 0;
      lines.push(`- ${f.file} (+${insertions}/-${deletions})`);
    }
    if (summary.files.length > 50) {
      lines.push(`- …and ${summary.files.length - 50} more files`);
    }
  }

  if (status.renamed.length) {
    lines.push("");
    lines.push("Renamed files:");
    for (const r of status.renamed) {
      lines.push(`- ${r.from} → ${r.to}`);
    }
  }

  const message = lines.join("\n");
  return { message };
}

export const generateCommitMessageTool = tool({
  description: "Generate a conventional commit message from current git changes",
  inputSchema: commitMessageInput,
  execute: generateConventionalCommitMessage,
});

// Markdown file generation
const markdownInput = z.object({
  filePath: z.string().min(1).describe("Absolute or relative path to .md file"),
  content: z.string().default("").describe("Markdown content to write"),
  overwrite: z.boolean().default(false).describe("Overwrite if file exists"),
});

type MarkdownInput = z.infer<typeof markdownInput>;

async function createMarkdownFile({ filePath, content, overwrite }: MarkdownInput) {
  const resolved = path.isAbsolute(filePath) ? filePath : path.resolve(process.cwd(), filePath);
  if (!resolved.toLowerCase().endsWith(".md")) {
    throw new Error("Target file must have a .md extension");
  }
  const dir = path.dirname(resolved);
  await fs.mkdir(dir, { recursive: true });

  let exists = false;
  try {
    await fs.stat(resolved);
    exists = true;
  } catch {
    exists = false;
  }

  if (exists && !overwrite) {
    throw new Error(`File already exists: ${resolved}`);
  }

  await fs.writeFile(resolved, content, "utf8");
  return { filePath: resolved, bytesWritten: Buffer.byteLength(content, "utf8") };
}

export const createMarkdownFileTool = tool({
  description: "Create or overwrite a markdown (.md) file with provided content",
  inputSchema: markdownInput,
  execute: createMarkdownFile,
});