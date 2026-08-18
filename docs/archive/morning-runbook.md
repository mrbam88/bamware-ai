> **ARCHIVED 2026-08-18.** One-off 2026-07-24 note written overnight when the
> session had no repo access. Fully superseded — repo access, the EAS release
> rail (`skills/baat-release`), and the reorg all exist now. Kept only for the
> `~/code` sprawl inventory, which is still a useful before-picture.

# bamware — Morning Runbook (for Bilal)

_Written overnight 2026-07-24 while you slept. TL;DR: I couldn't do the two overnight asks (fix conflicts, cut a TestFlight build) because I had no access to your code and iOS builds can't run from my environment. Nothing is broken — nothing was touched._

## What blocked the overnight work (honest)

1. **No repo access.** No folder was connected to this session, there's no GitHub auth on my side, and the only way in needed you awake.
2. **iOS TestFlight build can't run from here.** iOS builds require macOS + Xcode (or EAS/Fastlane with your Apple + Expo credentials). My compute is Linux. I didn't fake it.

## TestFlight path (as understood at the time)

- **If Expo/EAS:** `eas build --platform ios --profile production`, then `eas submit --platform ios`. Needs Expo login + Apple credentials in EAS.
- **If bare RN / native Xcode:** archive in Xcode or a Fastlane `beta` lane on the Mac.

## The `~/code` sprawl (the before-picture that drove the reorg)

```
bam-ai  bamware-  bamware-ai  bamware-auth-service  bamware-client-core
bamware-dating-app  bamware-dating-service  bamware-express-auth-service
bamware-infra  bamware-ios  bamware-ios-demo  bamware-mcp  bamware-rn
bamware-web  bamware-workspace  BamwareAuth  BamwareCore  BamwareDemo
BamwareDemoApp  BamwareMessaging  BamwareSettings  BamwareStorage  BamwareUI
bamxity   (+ non-bamware: flexcoa-mobile-main, kinesis, magnet, zmk-config)
```

Open questions at the time (now answered in `AGENTS.md` / `docs/repos.md`):
- Which of `bamware-dating-app` / `bamware-rn` / `bamware-ios` is the live app?
- Three auth things — which is canonical?
- `bamware-infra` = the Terraform multi-tenant backend?
- Are the `Bamware*` Swift packages consumed by `bamware-ios`?
- Which dirs are real git repos with remotes vs. local-only work never pushed?
