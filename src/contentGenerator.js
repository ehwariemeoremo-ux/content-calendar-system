/**
 * Uses Google's Gemini API (free tier) to:
 *  1. Research a fresh, non-repeated, trending idea for the given pillar
 *  2. Decide the best format for IG/TikTok (Reel, Story, or B-roll)
 *  3. Write a Facebook draft using Hook / Context / Value / CTA structure
 *
 * Returns a single structured object — this is the ONE idea posted that day
 * across all three platforms.
 *
 * Uses plain fetch (built into Node 18+) to call the Gemini REST API directly —
 * no extra SDK dependency needed.
 */

const GEMINI_MODEL = 'gemini-3.6-flash';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

function buildSystemInstruction() {
  return `You are a content strategist for a personal brand run by a Nigerian freelance developer who helps young people navigate education, build digital skills, find remote work, and grow their careers.

You generate ONE content idea per request for a given content pillar. The same idea is posted the same day across Facebook, TikTok, and Instagram — but adapted per platform:
- Facebook: ALWAYS a written post (text alone, or text + image). Never video/reel/story.
- TikTok and Instagram: the SAME format as each other for that day — choose the single best fit from: "Reel", "Story", "B-roll".

Format-matching rules:
- Reel: how-tos, quick tips, step-by-step, transformations, anything demonstrable in 15-30s.
- Story: quick polls, behind-the-scenes, reminders, teaser/engagement questions.
- B-roll: mood/atmosphere, day-in-the-life, workspace/process shown without narration.

For the Facebook written post, structure the draft in 4 parts:
- Hook: 1 scroll-stopping opening line tied to the topic.
- Context: 2-3 sentences of relatable context or a mini-story.
- Value: the core tip/insight/lesson — the actual substance.
- CTA: one question or prompt inviting comments.

Draw on your own knowledge of current, relevant, evergreen trends and angles when proposing the topic — you do not have live web access. Never propose a topic that duplicates or closely overlaps an already-used topic for this pillar.

Respond ONLY with valid JSON, no markdown fences, no preamble, matching this exact shape:
{
  "topic": "short topic title, under 12 words",
  "topic_summary": "1-2 sentence explanation of the angle",
  "ig_tiktok_format": "Reel" | "Story" | "B-roll",
  "format_reason": "1 short sentence on why this format fits",
  "facebook_format": "Written" | "Written + Image",
  "facebook_draft": {
    "hook": "...",
    "context": "...",
    "value": "...",
    "cta": "..."
  },
  "reference": "short note on the angle/inspiration for this idea (no links required)"
}`;
}

function buildUserPrompt(pillar, usedTopics) {
  const usedList = usedTopics.length
    ? usedTopics.map((t) => `- ${t}`).join('\n')
    : '(none yet)';

  return `Pillar: ${pillar.name}
Pillar angle: ${pillar.angle}

Topics already used for this pillar (do NOT repeat or closely overlap any of these):
${usedList}

Generate today's single content idea for this pillar following all the rules in your instructions.`;
}

async function generateDailyContent({ pillar, usedTopics }) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('Missing GEMINI_API_KEY in your .env file.');
  }

  const body = {
    system_instruction: {
      parts: [{ text: buildSystemInstruction() }],
    },
    contents: [
      {
        role: 'user',
        parts: [{ text: buildUserPrompt(pillar, usedTopics) }],
      },
    ],
    generationConfig: {
      temperature: 0.9,
    },
  };

  const response = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Gemini API error (${response.status}): ${errText}`);
  }

  const data = await response.json();
  const candidate = data.candidates && data.candidates[0];
  const textPart =
    candidate && candidate.content && candidate.content.parts
      ? candidate.content.parts.map((p) => p.text || '').join('')
      : null;

  if (!textPart) {
    throw new Error(`No text returned from Gemini. Raw response: ${JSON.stringify(data)}`);
  }

  const cleaned = textPart.replace(/```json|```/g, '').trim();
  let parsed;
  try {
    parsed = JSON.parse(cleaned);
  } catch (err) {
    throw new Error(`Failed to parse model output as JSON: ${err.message}\nRaw: ${cleaned}`);
  }

  return parsed;
}

module.exports = { generateDailyContent };
