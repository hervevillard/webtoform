import os
import json
from openai import OpenAI

_SYSTEM_PROMPT = """You are an expert insurance document analyst.
Your job is to read an insurance-related document and identify every piece of information
that needs to be collected from a customer to process their request.

Return ONLY a valid JSON array — no markdown, no explanation, no code fences.
Each element must be an object with exactly these keys:
  - "label"    : string — a clear, human-readable field name (e.g. "Full Legal Name")
  - "type"     : one of: "text", "textarea", "date", "email", "phone", "checkbox"
  - "required" : boolean — true if this field is essential

Focus on:
- Personal identification (name, DOB, SSN last 4, address)
- Contact information (phone, email)
- Policy details (policy number, coverage type, effective dates)
- Vehicle / property / health details as applicable
- Beneficiary information
- Signature and declaration fields

Do NOT include fields that would be filled by the insurance company (agent name, internal codes, etc.).
Deduplicate fields. Aim for 8–20 fields. Output only the JSON array."""


def analyze_document(text: str) -> list[dict]:
    """Send extracted PDF text to DeepSeek and return a list of form field descriptors."""
    api_key = os.environ.get("DEEPSEEK_API_KEY")
    if not api_key:
        raise EnvironmentError("DEEPSEEK_API_KEY is not set in the environment.")

    client = OpenAI(api_key=api_key, base_url="https://api.deepseek.com")

    # Truncate text to avoid excessive token usage while keeping full context
    truncated = text[:12000] if len(text) > 12000 else text

    response = client.chat.completions.create(
        model="deepseek-chat",
        messages=[
            {"role": "system", "content": _SYSTEM_PROMPT},
            {"role": "user", "content": f"Document content:\n\n{truncated}"},
        ],
        temperature=0.2,
        max_tokens=2048,
    )

    raw = response.choices[0].message.content.strip()

    # Strip markdown code fences if the model included them
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
        raw = raw.strip()

    fields = json.loads(raw)

    # Validate and normalise each field
    valid_types = {"text", "textarea", "date", "email", "phone", "checkbox"}
    result = []
    for f in fields:
        if not isinstance(f, dict) or "label" not in f:
            continue
        result.append(
            {
                "label": str(f.get("label", "")).strip(),
                "type": f.get("type", "text") if f.get("type") in valid_types else "text",
                "required": bool(f.get("required", False)),
            }
        )
    return result
