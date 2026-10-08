# UsTogether project agents

Seven focused Codex agents adapted from the local VoltAgent `awesome-codex-subagents` catalog. They use UsTogether's Expo, Supabase, romantic UI, existing tests, and Vercel setup.

| Agent | Responsibility | Catalog source | Default permissions |
| --- | --- | --- | --- |
| `expo-react-native-expert` | App implementation, navigation, state, photos, themes, motion, and platform behavior | `02-language-specialists/expo-react-native-expert.toml` | Inherit parent |
| `ui-designer` | Concrete layout, interaction, accessibility, and romantic design guidance | `01-core-development/ui-designer.toml` | Read-only |
| `supabase-developer` | Services, schema, RPCs, membership policies, private storage, and realtime | `01-core-development/backend-developer.toml`, `05-data-ai/postgres-pro.toml` | Inherit parent |
| `test-automator` | Focused regression tests and behavioral verification | `04-quality-security/test-automator.toml` | Inherit parent |
| `security-auditor` | Auth, membership, photo privacy, invitations, and credential review | `04-quality-security/security-auditor.toml` | Read-only |
| `deployment-engineer` | Build, Vercel, CI, environments, and release verification | `03-infrastructure/deployment-engineer.toml` | Inherit parent |
| `reviewer` | Correctness, regressions, async races, compatibility, and missing coverage | `04-quality-security/reviewer.toml` | Read-only |

## Loading and use

Codex discovers standalone TOML definitions in `.codex/agents/`. Each file provides `name`, `description`, and `developer_instructions`, following the [official custom-agent format](https://learn.chatgpt.com/docs/agent-configuration/subagents#custom-agents). No global installation or per-role registration is needed.

Model and reasoning settings are deliberately omitted to inherit the current session/defaults. Review and design roles request read-only mode; parent permission controls still apply. No new MCP server, credential, or app dependency is installed.

Ask for the roles relevant to the task, for example:

> Use ui-designer to specify the mobile album layout, then expo-react-native-expert to implement it. Have reviewer check the completed diff.

> Use supabase-developer to fix the upload service, test-automator to add regression coverage, and security-auditor to review the affected storage policies.

> Use deployment-engineer to check the Vercel workflow and build configuration. Report readiness without publishing.

If an existing session does not discover the new names, start a fresh Codex chat in this project. Adding definitions does not launch agents. Assign clear feature/file ownership, run independent tasks in parallel, and integrate shared-file changes sequentially. The parent remains responsible for the completed result.

Project context and verification commands live in the root [AGENTS.md](../../AGENTS.md). Agents preserve existing data and the user's choice to keep token-based GitHub deployment optional. An agent definition does not grant deployment authorization.

## Attribution

Adapted from VoltAgent's MIT-licensed `awesome-codex-subagents` definitions. Generic framework/operations guidance was narrowed to this app, catalog model overrides were removed, and `backend-developer` plus `postgres-pro` were combined as `supabase-developer`. The original [license](LICENSE) is retained.
