## 2025-05-20 - RegExp Allocation Hotspots in Serverless Completion Handlers
**Learning:** Instantiating arrays of regular expressions inside frequently invoked functions (like `extractCharacterName`, `extractInjectedLore`, and `detectInChatCommand`) allocates dozens of `RegExp` objects on the heap per request, adding GC pressure and slowing execution by >50%.
**Action:** Always hoist static `RegExp` patterns to module-level constants. When reusing global (`/g`) regular expressions across calls, explicitly reset `regex.lastIndex = 0` before matching to ensure request isolation.
