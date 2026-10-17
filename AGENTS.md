Use available agent skills proactively whenever a request matches their purpose; the user does not need to name a skill explicitly. Briefly state which skill you are using and why. Do not use Superpowers unless the user explicitly requests it.

## Agent skills

### Issue tracker

Issues and PRDs are tracked in GitHub Issues. See `docs/agents/issue-tracker.md`.

### Triage labels

Triage uses the five default canonical labels. See `docs/agents/triage-labels.md`.

### Domain docs

Domain documentation uses a single-context layout. See `docs/agents/domain.md`.

## Npm publishing & Github release

Publish releases by pushing a `fork/vX.Y.Z` tag after the release commit is on `main`. `.github/workflows/publish.yml` publishes to npm through Trusted Publishing (OIDC); configure npm to trust repository `saifymatteo/pi-atelier` and this workflow. The tag must match the `package.json` version. After the workflow succeeds, verify the published version and `latest` dist-tag, then create the GitHub release at the end. Do not request, accept, or pass an OTP through the agent. Never move upstream `vX.Y.Z` tags.

## Tone

Keep your response tone concise, technical, and straightforward. Do not include any flair or prose.

## Subagent

If you ever want to use subagents, kick it off with gpt-6.1-sol with high effort.

## Tests

Do not write any unit tests or e2e tests associated with TUI changes. Instead, give the user a TODO list to manually verify the TUI changes. 

Give the user a CLI command to open a temporal Pi agent session to check TUI changes. It should only open with the updated pi-atelier extension, otherwise there would result in a conflict with the locally installed pi-atelier. 

## Other things

If you are a claude model, never mention yourself as `Co-Authored-By` in any git commit message or PR.
