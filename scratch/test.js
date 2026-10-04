const cleanForSpeech = (text) => {
  if (!text) return "";
  let cleaned = text;
  // Remove code blocks completely first
  cleaned = cleaned.replace(/```[\s\S]*?```/g, " ");
  // Remove markdown URLs but keep the link text
  cleaned = cleaned.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
  // Remove bold/italic markers
  cleaned = cleaned.replace(/[*_~#`]/g, "");
  // Remove HTML tags if any
  cleaned = cleaned.replace(/<[^>]*>?/gm, "");
  // Remove extra whitespace
  cleaned = cleaned.replace(/\s{2,}/g, " ").trim();
  return cleaned;
};

const text = "Here is a **bold** statement and [a link](https://example.com). Also `code`.\n\n```python\nprint('hello')\n```\n# Header!";
console.log(cleanForSpeech(text));
