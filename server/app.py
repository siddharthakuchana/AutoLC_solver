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
    "python":     "Solve this LeetCode problem in Python 3. Return ONLY the code inside the Solution class.",
    "javascript": "Solve this LeetCode problem in JavaScript. Return ONLY the code for the solution function.",
    "typescript": "Solve this LeetCode problem in TypeScript. Return ONLY the code for the solution function.",
    "java":       "Solve this LeetCode problem in Java. Return ONLY the code inside the Solution class.",
    "cpp":        "Solve this LeetCode problem in C++. Return ONLY the code inside the Solution class.",
    "csharp":     "Solve this LeetCode problem in C#. Return ONLY the code inside the Solution class.",
    "go":         "Solve this LeetCode problem in Go. Return ONLY the solution function.",
    "rust":       "Solve this LeetCode problem in Rust. Return ONLY the impl Solution block.",
}

SYSTEM_PROMPT = (
    "You are an expert competitive programmer. "
    "Provide clean, efficient, and well-commented solutions. "
    "Return ONLY the code — no explanations, no markdown fences, no extra text."
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
