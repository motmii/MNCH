name: Optimize for static hosting (GitHub Pages)
description: |
  Prep the bundle for GitHub Pages:
  - remove backend dependencies
  - fix asset paths
  - disable unavailable features
  - register SW with correct scope
  - add offline fallback
  - inject new QA helpers
  - more...? (ask user)
 invocations:
   - run_commands:
       title: Prepare GitHub Pages package
       code: |
         ls -la
subtasks:
  - task: Remove backend-related docs/code references
    status: completed
  - task: Disable nova-api/nova-ui exposure in HTML
    status: completed
  - task: Fix asset paths for project site
    status: completed
  - task: Register service worker with subpath scope
    status: completed
  - task: Verify precache assets and add offline fallback
    status: completed
  - task: Add "Reset my progress / Clear local data"
    status: completed
  - task: Complete English translations
    status: completed
  - task: Unify tool counts in UI/README/stats
    status: completed
  - task: Fix summaries / study-material links
    status: completed
  - task: Unify lesson status claims
    status: completed
  - task: Onboarding validation
    status: completed
  - task: Fix XSS in assistant.js
    status: completed
  - task: Remove any exposed API keys
    status: completed
  - task: Make assistant offline/local
    status: completed
  - task: Add AbortController + timeout to external requests
    status: completed
  - task: Fix duplicated user question if askEndpoint exists
    status: completed
  - task: Fix FNV fallback misrepresented as SHA-256
    status: completed
  - task: Improve password-strength analyzer
    status: completed
  - task: Adjust assistant refusal rules
    status: completed
  - task: Linguistic/technical QA for question banks
    status: completed
  - task: Add GitHub Pages deployment tests
    status: completed
  - task: Add GitHub Actions workflow
    status: completed
  - task: Update README
    status: completed
