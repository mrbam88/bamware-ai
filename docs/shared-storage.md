# Shared Google Drive storage

## Standing decision — October 2, 2026

Bilal designated Google Drive as the shared storage location for files and as a
working storage container for agents. All agents may access and use it as needed
for authorized tasks: read inputs, create working folders, and save/update task
outputs. Ordinary task-related file storage does not require repeated approval.
This is a shared account location, not a newly public bucket or permission to
share private data externally or permanently destroy existing files.

The top level of My Drive is the clean working area. **October 2026 Backup
Archive** contains the legacy contents: all 225 original top-level items were
verified inside it, with folders and their nested structure retained. The root
was verified to contain only the archive after the move. No files were deleted.
New work belongs outside that archive unless the task explicitly edits old
material. The archive is a move of originals, not an independent backup copy.
Its private inventory and move manifest are on the ThinkPad under
`~/.local/state/bamware/drive-archive/`; do not publish file names or IDs.

Prefer local tools and filesystem access on the build server, with background
transfers managed by software. Agents should not repeatedly navigate browsers
or spend model calls on routine upload/download mechanics. Efficient retrieval
still means reading only task-relevant material, not loading the whole archive
into model context. Code and versioned operating instructions continue in git;
no existing repository or career-library migration was performed by this choice.

## Access boundary

This direction explicitly extends Drive-file access to build agents. It does
not expose Gmail credentials or grant email sending. **Never send email.**
The Chief of Staff has read-only Gmail and Drive access through an isolated
credential service. Device/file-sync access uses separate Drive authorization.
Private Google data stays out of public repositories and logs. Store no OAuth
clients, refresh tokens, or unlock keys in Drive, git, or model context.

## Verified rollout, not a universal connection claim

- Server Google read service: active; Gmail and Drive reads passed, stored scopes
  checked read-only, ordinary worker access to that broker denied; Hermes skill
  installed. A real owner-authenticated Assistant chat test passed on October 2:
  the model loaded the skill, issued three terminal calls to the read broker
  (status, Gmail search, Drive search), and received successful live responses.
  Gmail lookup succeeded, the archive was found, and sending was disabled.
  Tool-call and result records were checked independently of the model's reply.
  Evidence is private on the server under
  `~/.local/state/bamware/google-test/chat-verification.json`. This verifies the
  Assistant website path, not a separately tested Discord turn.
- ThinkPad: dedicated `~/GoogleDrive` mount and user service active. Personal
  OAuth client replaced rclone's rate-limited shared default. Upload and cloud
  read-back passed. This is online access with an edit cache, not a full offline
  mirror. Desktop and Documents have not been moved.
- Build server: local Drive working copy requested and authorized; not yet
  configured. About 1.7 TiB free and FUSE available. Take the first sync baseline
  after the archive move. Use Drive-only authorization for agent file access;
  do not expose the combined read-only Gmail credential to build workers.
- Mac: official Drive installer downloaded to Downloads and image integrity
  verified; installation and sign-in remain pending.
- Phone/tablet: sign-in and offline-folder choices remain pending.
- The OAuth app was in Testing during setup. Its refresh-token lifetime remains
  an unattended-operation concern; do not claim permanent access is resolved.

Implementation, tests, and fuller setup runbook are published on branch
`feat/google-chief-of-staff` under `services/google-access` and
`docs/google-chief-of-staff.md`. Server staged installation source is
`/home/bilal/srv/google-chief-of-staff/service`. That implementation has not been
merged into main. The shared-user Assistant/Discord processes are not a strong
security boundary against someone able to modify those services; current broker
caller checks are defense in depth.
