---
name: native-ios-workspace
description: Develop Bamware native iOS apps with reusable local Swift packages and companion APIs. Use for bamware-ios, bamware-cafe, Xcode workspace substitution, Swift package tests, or local Venue Engine integration.
---

# Native iOS workspace

## Repository boundaries

- `bamware-ios`: reusable Core, UI, and Messaging products.
- `bamware-cafe/Packages/BamwareCafeKit`: cafe-specific VenueKit and feature UI.
- `bamware-cafe`: thin app composition root.
- `bamware-venue-engine`: Express/Zod backend and venue contract source.

Shared modules never import consumer apps or tenant-specific implementations.

## Local development

Open `bamware-cafe/BamwareCafeDevelopment.xcworkspace`. It keeps remote package
pins for standalone builds while substituting the sibling `bamware-ios`
checkout for immediate local edits.

Minimum validation:

```bash
cd ~/code/bamware-ios
swift test -Xswiftc -strict-concurrency=complete -Xswiftc -warnings-as-errors

cd ~/code/bamware-cafe
xcodebuild -workspace BamwareCafeDevelopment.xcworkspace -scheme BamwareCafe \
  -destination 'generic/platform=iOS Simulator' CODE_SIGNING_ALLOWED=NO build
```

For API work, compare Swift models and requests directly with
`bamware-venue-engine/src/schema.ts` and routes before editing either side.
Simulator traffic reaches `http://localhost:3000`; physical devices require the
Mac LAN address and separate network configuration.
