## 2025-05-15 - Early Character Guard for Per-Request Command Detection
**Learning:** `detectInChatCommand` is evaluated on every user turn. Because >99.9% of roleplay turns are standard dialogue without commands, guarding regex matches with a first-character code point check (`trimmed.charCodeAt(0) !== 60 && trimmed.charCodeAt(0) !== 47`) eliminates regular expression overhead on normal turns (~88% speedup from 188ms to 22ms per 1M checks).
**Action:** Always guard multi-regex or expensive string parsing functions with fast O(1) character or length checks before running full regex patterns.
