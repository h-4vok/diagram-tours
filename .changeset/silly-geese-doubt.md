---
"diagram-tours": patch
---

Add Markdown Mermaid support to the CLI and runtime.

You can now point `diagram-tours` at `.md` files with fenced `mermaid` blocks,
generate fallback tours from those blocks, and target a specific Markdown block
from an authored `*.tour.yaml` file with a `#fragment`.
