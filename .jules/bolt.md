## 2026-09-03 - Catastrophic Backtracking in Unanchored Character Extraction Regexes
**Learning:** Unanchored regexes with greedy multi-word space and character sets (e.g., `[A-Z][a-zA-Z0-9_\-\s']{1,25}'s`) cause catastrophic backtracking when matched against large character cards/system prompts (50KB+) in character fingerprinting routines.
**Action:** Always anchor multi-word pattern matches to line boundaries (`(?:^|\n)\s*`) and bound space matching explicitly (e.g. `[A-Z][a-zA-Z0-9_\-]{1,25}(?:\s+[A-Z][a-zA-Z0-9_\-]{1,25})*`) when matching character names or titles in system prompts.
