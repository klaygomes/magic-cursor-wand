# Contribute to magic-cursor-wand

This document tells you how to prepare your computer, how to do the checks and how to send a pull request. Read `PLAN.md` before you change the code. It is the specification of the library.

## Prepare your computer

1. Install Node.js 24.
2. Install pnpm with Corepack:

   ```sh
   corepack enable
   ```

3. Clone the repository.
4. Install the dependencies:

   ```sh
   pnpm install
   ```

5. Install the browsers for the browser tests:

   ```sh
   pnpm exec playwright install chromium firefox webkit
   ```

## Do the checks

Do all checks before you send a pull request. CI does the same checks.

| Command | Check |
|---|---|
| `pnpm typecheck` | TypeScript types |
| `pnpm lint` | Biome lint and format rules. `pnpm format` corrects most problems. |
| `pnpm lint:prose` | Vale with the `STE` style |
| `pnpm test:node` | Unit tests in Node |
| `pnpm test:browser` | Tests in Chromium, Firefox and WebKit |
| `pnpm build` | The package build and the attw check |
| `pnpm lint:package` | publint |
| `pnpm size` | The size limits in `.size-limit.json` |
| `pnpm docs:snippets` | The code samples of the documentation |
| `pnpm docs:build` | The documentation site |

## Write the code

- Write clean code that documents itself. Do not write comments that tell what the code does.
- Write a comment only for a constraint that the code cannot show.
- Write TSDoc on each exported symbol. The summary is one STE sentence.
- Give an explicit return type to each exported function.
- Put a test next to the source file. Use the name `x.test.ts` for Node and `x.browser.test.ts` for the browser.
- Use the `scheduler` and `random` options in tests. Then the result is the same for each test run.

## Write in Simplified Technical English

Write all prose in ASD-STE100 Simplified Technical English (STE). This rule applies to the README, this file, `PLAN.md`, the documentation, TSDoc and runtime messages.

Vale checks these rules:

| Rule | Limit |
|---|---|
| Sentence length | A maximum of 25 words. |
| Paragraph length | A maximum of 6 sentences. |
| Voice | Active voice only. |
| Verb forms | No `-ing` forms, except in approved technical names. |
| Contractions | Write `do not`, not `don't`. |
| Phrasal verbs | Write `start`, not `set up` or `turn on`. |
| Substitutions | Write `use`, not `utilize`. Write `before`, not `prior to`. |
| Glossary | Each technical name must be in the approved list. |

The approved technical names are in `.vale/styles/config/vocabularies/STE/accept.txt`. To add a name, add it to this file in the same pull request.

The ASD-STE100 dictionary has a copyright. Do not copy it into the repository.

## Write the documentation

- Put each code sample in `docs/snippets/`. Include it with `<<< @/snippets/file.ts#region`.
- Keep an inline code block to a maximum of 3 lines.
- Write one procedure on each how-to page.
- Run `pnpm docs:config` after a change to a schema. The script writes the configuration tables.

## Send a pull request

1. Make a branch from `main`.
2. Make your changes.
3. Add a changeset:

   ```sh
   pnpm changeset
   ```

4. Select the type of change: `patch`, `minor` or `major`.
5. Write the summary of the change in STE.
6. Do all checks.
7. Push the branch and open the pull request.
8. Complete the checklist in the pull request template.

A change to the documentation or to the tests only does not need a changeset.

## Checklist for rules that Vale cannot check

Examine your prose for these rules before you send the pull request:

- [ ] Each procedure sentence has a maximum of 20 words.
- [ ] Each procedure sentence gives one instruction in the imperative.
- [ ] Each sentence has one topic.
- [ ] Each word refers to one thing only. Use the same word for the same thing.
- [ ] Each technical name is an approved name from the glossary.
- [ ] A verb is a verb, not a noun or an adjective.
- [ ] The text uses the simple tenses: past, present and future.
- [ ] A warning or a caution comes before the step that it applies to.
- [ ] Each word has a part of speech and a sense that STE approves.

## Release

| Event | Result |
|---|---|
| A collaborator opens or updates a pull request | CI runs. Then a preview package goes to pkg.pr.new. The pull request gets a comment with the install command. |
| A pull request with a changeset merges into `main` | CI runs. Then the release workflow opens or updates the pull request `chore: release`. |
| The pull request `chore: release` merges into `main` | CI runs. Then the release workflow publishes the package to npm, adds the tag `vX.Y.Z` and makes a GitHub release. |

### Release a new version

1. Merge the pull requests that have a changeset.
2. Examine the version and `CHANGELOG.md` in the pull request `chore: release`.
3. Merge the pull request `chore: release`.

### Set trusted publishing

Do this procedure one time. Replace `<code>` with the code from your authenticator:

```sh
npm trust github magic-cursor-wand --repo klaygomes/magic-cursor-wand --file release.yml --env npm --otp=<code>
```
