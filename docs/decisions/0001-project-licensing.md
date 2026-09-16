# ADR 0001: License code under Apache-2.0 and original artwork under CC BY 4.0

- Status: Accepted
- Date: 2026-09-04

## Context

Amethyst needs a public license that welcomes code reuse, gives contributors a clear patent grant, and preserves attribution for the visual identity.

A single software license is a poor fit for both executable code and standalone artwork.

## Decision

- Source code and documentation are licensed under Apache License 2.0.
- Original artwork recorded in `ASSET_PROVENANCE.md` is licensed under Creative Commons Attribution 4.0 International.
- Third-party material keeps its original license.
- New artwork requires a provenance record before merge.

## Consequences

People may use and modify the code under Apache-2.0. People may also reuse and modify original Amethyst artwork, but they must provide attribution and mark changes under CC BY 4.0.

Distributions need to preserve the Apache license and applicable notice text. Maintainers also need to keep the asset record current and prevent unlicensed brand material from entering the repository.
