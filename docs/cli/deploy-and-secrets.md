# Deploy and Secrets

## Deploy

`patties deploy` builds the app and hands deployment off to an installed deploy
plugin.

Current deploy flow:

- resolves the configured target
- optionally runs `patties build`
- selects a deploy plugin for the active target
- calls the plugin with the built server entry

Supported flags:

- `--target <bun|edge>`
- `--env <name>`
- `--skip-build`

## Secrets

`patties secret` manages dev-time secrets through the local OS keychain.

Supported subcommands:

- `patties secret set <key> [value]`
- `patties secret get <key> [--force]`
- `patties secret list`
- `patties secret rm <key>`
- `patties secret doctor`

This command is explicitly dev-only. In production, secrets should be provided
through the deployment platform.
