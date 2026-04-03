"""
LeetCode Auto Solver — Flask Backend Server
Receives problem text from the Chrome extension,
sends it to OpenAI, and returns the AI-generated solution.
"""

import os
from flask import Flask, request, jsonify
from flask_cors import CORS
from openai import OpenAI

app = Flask(__name__)
CORS(app)  # Allow requests from the Chrome extension

# ---- Configuration (Groq Cloud) ----
GROQ_API_KEY = "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"
MODEL = os.environ.get("GROQ_MODEL", "llama-3.3-70b-versatile")

client = OpenAI(
    api_key=GROQ_API_KEY,
    base_url="https://api.groq.com/openai/v1",
)

# ---- Language prompt templates ----
LANG_PROMPTS = {
    "python":     "Solve this LeetCode problem in Python 3. Return the COMPLETE code exactly as it should be submitted on LeetCode, including 'class Solution:' with all required method definitions. Include any necessary imports (e.g., from typing import List, Optional) at the top.",
    "javascript": "Solve this LeetCode problem in JavaScript. Return the COMPLETE code exactly as it should be submitted on LeetCode, including the full function definition with 'var', or the '@param' / '@return' JSDoc if needed.",
    "typescript": "Solve this LeetCode problem in TypeScript. Return the COMPLETE code exactly as it should be submitted on LeetCode, including the full function signature with types.",
    "java":       "Solve this LeetCode problem in Java. Return the COMPLETE code exactly as it should be submitted on LeetCode, including the full 'class Solution { ... }' with all required method definitions and any necessary imports.",
    "cpp":        "Solve this LeetCode problem in C++. Return the COMPLETE code exactly as it should be submitted on LeetCode, including the full 'class Solution { ... }' with all required method definitions and any necessary #include headers.",
    "csharp":     "Solve this LeetCode problem in C#. Return the COMPLETE code exactly as it should be submitted on LeetCode, including the full 'public class Solution { ... }' with all required method definitions.",
    "go":         "Solve this LeetCode problem in Go. Return the COMPLETE code exactly as it should be submitted on LeetCode, including the full function definition and any necessary imports.",
    "rust":       "Solve this LeetCode problem in Rust. Return the COMPLETE code exactly as it should be submitted on LeetCode, including the full 'impl Solution { ... }' block.",
}

SYSTEM_PROMPT = (
    "You are an expert competitive programmer who solves LeetCode problems. "
    "Your solutions MUST pass ALL test cases on LeetCode. "
    "Rules:\n"
    "1. Return ONLY the code — no explanations, no markdown fences (```), no extra text before or after the code.\n"
    "2. The code must be COMPLETE and ready to paste directly into LeetCode's editor as a full replacement.\n"
    "3. Include the complete class/function definition (e.g., 'class Solution:' for Python) with the exact method signature LeetCode expects.\n"
    "4. Include any necessary imports at the top of the code.\n"
    "5. Use optimal time and space complexity. Handle all edge cases.\n"
    "6. Do NOT include any test code, main functions, or print statements — only the solution class/function."
)


@app.route("/health", methods=["GET"])
def health():
    """Health check endpoint used by the extension popup."""
    return jsonify({"status": "ok", "model": MODEL})


@app.route("/solve", methods=["POST"])
def solve():
    """Accept a LeetCode problem and return an AI-generated solution."""
    data = request.get_json(force=True)
    problem = data.get("problem", "")
    language = data.get("language", "python")

    if not problem:
        return jsonify({"error": "No problem text provided"}), 400

    lang_instruction = LANG_PROMPTS.get(language, LANG_PROMPTS["python"])
    user_message = f"{lang_instruction}\n\n--- PROBLEM ---\n{problem}"

    try:
        response = client.chat.completions.create(
            model=MODEL,
            temperature=0.2,
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": user_message},
            ],
        )

        solution = response.choices[0].message.content.strip()

        # Strip markdown code fences if the model adds them
        if solution.startswith("```"):
            lines = solution.split("\n")
            lines = lines[1:]  # remove opening fence
            if lines and lines[-1].strip() == "```":
                lines = lines[:-1]  # remove closing fence
            solution = "\n".join(lines)

        return jsonify({"solution": solution, "model": MODEL, "language": language})

    except Exception as e:
        return jsonify({"error": str(e)}), 500


if __name__ == "__main__":
    print("🚀 LeetCode Solver backend running on http://localhost:3000")
    print(f"   Provider: Groq Cloud")
    print(f"   Model: {MODEL}")
    print(f"   API Key: {'✅ Set' if GROQ_API_KEY != 'YOUR_API_KEY_HERE' else '⚠️  Not set'}")
    app.run(host="0.0.0.0", port=3000, debug=True)
