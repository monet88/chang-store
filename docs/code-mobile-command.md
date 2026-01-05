# Explanation: `/ck:` Prefix in Scan Output

**Note:** When you scan commands with `scan_commands.py`, they appear with `/ck:` prefix (e.g., `/ck:me:code:mobile`). This is just for the scan tool - the **actual command to use** is **without** the `ck:` prefix.

**Scan output:** `/ck:me:code:mobile`
**Actual command:** `/me:code:mobile`

The `ck` stands for "ClaudeKit" and was originally hardcoded in the scan script at line 31. This has been removed in the updated version.

---

# `/me:code:mobile` Command - Mobile Development Workflow

Created: 2026-01-04

## Overview

New command `/me:code:mobile` for mobile app development workflow - supports Flutter, React Native, Swift/iOS, and Kotlin/Android.

## File Location

`~/.claude/commands/me/code/mobile.md`

## Command Signature

```bash
/me:code:mobile [plan] [all-phases-yes-or-no]
```

**Arguments:**
- `$1 (plan)`: Specific plan path or auto-detect latest plan
- `$2 (all-phases)`: `Yes` (default) = finish all phases, `No` = phase-by-phase with confirmation

## Technology Detection

Auto-detects mobile framework from project files:

| Framework | Detection File | Skill Activated |
|-----------|----------------|-----------------|
| **Flutter** | `pubspec.yaml` with flutter SDK | `/flutter-expert` |
| **React Native** | `package.json` with react-native | `/mobile-development` |
| **Swift/iOS** | `Package.swift` or `.xcodeproj` | `/mobile-development` |
| **Kotlin/Android** | `build.gradle` with kotlin | `/mobile-development` |

## Workflow Steps

### Step 0: Plan Detection & Technology Detection
- Find/parse plan
- Detect mobile framework
- Activate appropriate skill
- Output: `✓ Step 0: [Plan] - [Phase] - Technology: [Framework]`

### Step 1: Analysis & Task Extraction
- Use `project-manager` agent
- Extract tasks to TodoWrite
- Output: `✓ Step 1: Found [N] tasks - Ambiguities: [list]`

### Step 2: Mobile Implementation

**Parallel Execution:**
- If plan detects parallel phases → launches multiple `mobile-developer` agents
- Each agent works on separate phase with file ownership boundaries
- Sequential phases use single agent after dependencies met

**Sequential Execution:**
- Main agent implements with activated skills
- Flutter → `/flutter-expert` skill
- React Native/Swift/Kotlin → `/mobile-development` skill

**mobile-developer Agent:**
- Located: `~/.claude/agents/mobile-developer.md`
- Specializes in: Flutter, React Native, Swift/iOS, Kotlin/Android
- Auto-activates appropriate skills based on detected framework
- Handles platform-specific patterns, testing, and quality checks
- Respects file ownership boundaries in parallel execution
- Coverage targets: Flutter ≥85%, Others ≥80%

**Flutter-Specific:**
- Detect state management (Provider/Riverpod)
- Backend integration (Supabase/Firebase)
- Feature-first architecture
- Code generation with freezed
- Null safety, ≥85% coverage target

**React Native:**
- State management (Redux/Context/MobX)
- React Navigation
- Platform-specific handling
- Performance optimization

**Swift/iOS:**
- SwiftUI or UIKit
- MVVM architecture
- iOS HIG compliance
- Platform features

**Kotlin/Android:**
- Jetpack Compose
- MVVM with ViewModels
- Material Design 3
- Platform features

**General Mobile Best Practices:**
- Performance (battery, memory, network)
- Offline-first architecture
- Responsive design
- Accessibility
- Platform conventions

Output: `✓ Step 2: Implemented [N] files - [X/Y] tasks complete`

### Step 3: Mobile Testing

**Technology-Specific:**

**Flutter:**
```bash
flutter test                    # Unit tests
flutter test integration_test/  # Integration tests
```

**React Native:**
```bash
npm test                        # Jest tests
# Detox E2E tests
```

**Swift:**
- XCTest (unit + UI)
- Test on real devices

**Kotlin:**
- JUnit tests
- Espresso UI testing

**Coverage Targets:**
- Flutter: ≥85%
- Others: ≥80%

Output: `✓ Step 3: Tests [X/X passed] - Coverage: [N%]`

### Step 4: Mobile Code Review

**Mobile-Specific Review Criteria:**
- Security (data storage, API keys, permissions)
- Performance (battery, memory, network)
- Mobile UX (touch targets, gestures, loading)
- Platform conventions (iOS HIG, Material Design)
- Architecture (YAGNI/KISS/DRY)
- Accessibility (screen readers, contrast)

Output: `✓ Step 4: Code reviewed - [0] critical issues`

### Step 5: Finalize

1. **Status Update** (parallel):
   - `project-manager`: Update plan status
   - `docs-manager`: Update documentation

2. **Mobile Onboarding Check:**
   - API keys (Google Maps, Firebase, Supabase)
   - Platform accounts (Apple Developer, Google Play)
   - Environment variables
   - Native dependencies (CocoaPods, Gradle)
   - Code signing certificates

3. **Auto-Commit:**
   - Auto-stage, commit, push

Output: `✓ Step 5: Finalize - Status updated - Git committed`

## Mobile-Specific Features

### Performance Optimization
- Battery drain monitoring
- Memory leak detection
- Network efficiency
- Small screen optimization

### Offline-First Architecture
- Local caching
- Sync strategies
- Network resilience
- Error handling

### Platform Guidelines
- iOS: Human Interface Guidelines
- Android: Material Design 3

### Accessibility
- Screen reader support
- Contrast ratios (WCAG)
- Touch target sizes
- Gesture alternatives

## Comparison with Other `/code` Variants

| Command | Focus | Testing | Auto-Commit | Technology |
|---------|-------|---------|-------------|------------|
| `/code` | General | Yes | Ask user | Auto-detect |
| `/code:auto` | Fast | Yes | Yes | Auto-detect |
| `/code:no-test` | Quick | No | Yes (approval) | Auto-detect |
| `/code:parallel` | Parallel phases | Yes | Ask user | Fullstack only |
| **`/me:code:mobile`** | **Mobile apps** | **Yes (mobile-specific)** | **Yes** | **Flutter/RN/Swift/Kotlin** |

## Usage Examples

### Flutter App
```bash
# Auto-detect latest plan
/me:code:mobile

# Specific plan, all phases
/me:code:mobile plans/260104-auth-feature/

# Phase-by-phase with confirmation
/me:code:mobile plans/260104-auth-feature/ No
```

### React Native App
```bash
# Auto-detects React Native from package.json
/me:code:mobile plans/260104-onboarding/
```

### Swift iOS App
```bash
# Auto-detects Swift from Package.swift
/me:code:mobile plans/260104-profile-screen/
```

## Key Differences from `/code:parallel`

| Aspect | `/code:parallel` | `/me:code:mobile` |
|--------|------------------|-------------------|
| **Agent** | `fullstack-developer` | `mobile-developer` (parallel) or Main + Skills (sequential) |
| **Skills** | Generic web skills | `flutter-expert` or `mobile-development` |
| **Testing** | Generic tests | Platform-specific (flutter test, Jest, XCTest) |
| **Code Review** | Web focus | Mobile-specific criteria |
| **Onboarding** | Web env vars | Mobile certs, platform accounts |
| **Performance** | Web metrics | Battery, memory, network |
| **Parallel Support** | Yes (fullstack-developer) | Yes (mobile-developer agents) |

## Critical Enforcement Rules

- **Step outputs:** `✓ Step [N]: [status] - [metrics]`
- **TodoWrite tracking:** Required for all steps
- **Mandatory subagents:**
  - Step 3: `tester` (mobile-specific)
  - Step 4: `code-reviewer` (mobile criteria)
  - Step 5: `project-manager` + `docs-manager` + `git-manager`
- **Blocking gates:**
  - Step 3: 100% tests passing + coverage ≥ target
  - Step 4: 0 critical issues

## Mobile Onboarding Checklist

When command completes, generates mobile-specific setup guide:

### Flutter
- [ ] Supabase/Firebase API keys
- [ ] Google Maps API key
- [ ] iOS: Apple Developer account, certificates
- [ ] Android: Google Play Console, keystore
- [ ] Environment variables (.env)

### React Native
- [ ] Metro bundler configuration
- [ ] iOS: CocoaPods dependencies
- [ ] Android: Gradle dependencies
- [ ] Platform-specific native modules

### Swift
- [ ] Xcode configuration
- [ ] Provisioning profiles
- [ ] Code signing certificates
- [ ] App Store Connect setup

### Kotlin
- [ ] Android Studio setup
- [ ] Gradle configuration
- [ ] Keystore for release builds
- [ ] Google Play Console setup

## Summary

Command `/me:code:mobile` provides complete mobile development workflow:
- ✅ Auto-detects mobile framework
- ✅ Activates appropriate skills
- ✅ Platform-specific testing
- ✅ Mobile-focused code review
- ✅ Mobile onboarding guidance
- ✅ Performance & accessibility checks
- ✅ Offline-first architecture support

Use this command for all mobile app implementation instead of generic `/code` variants.
