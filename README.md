# my-agent

To install dependencies:

```bash
bun install
```

To run:

```bash
bun run index.ts
```

This project was created using `bun init` in bun v1.2.22. [Bun](https://bun.com) is a fast all-in-one JavaScript runtime.

## Tools available

- `getFileChangesInDirectoryTool`: Returns diffs for files changed in a given directory.
- `generateCommitMessageTool`: Generates a conventional commit message from current git changes.
- `createMarkdownFileTool`: Creates or overwrites a `.md` file with provided content.

## Usage

The agent is configured to expose the tools via the AI function-calling interface. You can guide the agent with prompts and it will invoke tools as needed. Examples below show direct tool intents you can include in your prompt.

### Get file changes

Example prompt snippet:

```text
Use getFileChangesInDirectoryTool with input: { "rootDir": "../my-agent" }
```

### Generate a commit message

Requirements:
- Run inside a git repository with changes staged or unstaged.

Example prompt snippet:

```text
Use generateCommitMessageTool with input: {
  "rootDir": ".",
  "type": "feat",
  "scope": "tools",
  "maxSubjectLength": 72
}
```

The tool returns `{ message: string }` which you can use with your git commit.

### Create a Markdown file

Example prompt snippet:

```text
Use createMarkdownFileTool with input: {
  "filePath": "docs/CHANGELOG.md",
  "content": "# Changelog\n\n- Initial release",
  "overwrite": true
}
```

This will create directories as needed and write the markdown file.

## Notes

- Ensure git is initialized and a remote is set if you plan to push changes.
- The tools are registered in `index.ts` via the `tools` option of the AI runtime.
