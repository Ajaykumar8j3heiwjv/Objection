// /api/analyze-transcript.js
// Takes a full transcript (already assembled from one or more chunks, or from
// the single-shot audio flow) and runs the coaching rubric on it.
// Text-only request, so it never approaches Vercel's body size limit even for
// a 40-minute call's worth of transcript.

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '2mb'
    }
  }
};

export const maxDuration = 60;

const LANGUAGE_NAMES = {
  auto: 'an unspecified Indian language',
  en: 'English',
  ta: 'Tamil',
  hi: 'Hindi',
  te: 'Telugu'
};

const RUBRIC_PROMPT = (languageLabel) => `You are a sales coach for BDAs (Business Development Associates) at GUVI/HCL who sell upskilling courses over the phone in India. BDAs pitch in English, Tamil, Hindi, or Telugu, often mixed together. The call below was spoken in ${languageLabel}.

You are given the full transcript of a real or practice sales call (it may have been stitched together from multiple recording segments, so there may be minor breaks or repeats at the seams — treat it as one continuous call).

Coach the pitch using this rubric:
- Opening & rapport — did they build trust before pitching?
- Needs discovery — did they ask about the customer's goals, background, or constraints before pushing the course?
- Objection handling — did they acknowledge the customer's concern (price, time, family approval, etc.) before responding, or did they argue/dismiss it?
- Clarity & structure — was the pitch clear and not rambling?
- Tone & confidence — consultative and confident, or pushy/scripted?
- Call to action / next step — did the call end with a clear next step?

Respond with ONLY valid JSON (no markdown fences, no commentary) matching exactly this shape:

{
  "overall_score": <integer 0-100>,
  "headline": "<one short phrase summarizing pitch quality, e.g. 'Strong rapport, weak close'>",
  "summary": "<2-3 sentence overview of how the call went>",
  "strengths": ["<specific thing they did well>", "..."],
  "improvements": ["<specific, actionable coaching tip>", "..."],
  "objection_notes": ["<note on a specific objection moment and how it was handled, or state none were raised>", "..."]
}

Rules:
- Base every point on specific evidence from the transcript. Do not invent details.
- Keep each bullet under 25 words.
- Give 3-6 items per list where the transcript supports it (long calls usually have more to comment on).
- Output must be raw JSON only — nothing before or after it.`;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'Server is missing GEMINI_API_KEY.' });
  }

  try {
    const { transcript, language } = req.body || {};
    if (!transcript || !transcript.trim()) {
      return res.status(400).json({ error: 'No transcript provided.' });
    }

    const languageLabel = LANGUAGE_NAMES[language] || LANGUAGE_NAMES.auto;
    const prompt = `${RUBRIC_PROMPT(languageLabel)}\n\nTranscript:\n"""\n${transcript.trim()}\n"""`;

    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.4, responseMimeType: 'application/json' }
        })
      }
    );

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      console.error('Gemini analysis error:', errText);
      return res.status(502).json({ error: 'Analysis failed. Please try again.' });
    }

    const data = await geminiRes.json();
    const rawText = (data.candidates?.[0]?.content?.parts || []).map((p) => p.text || '').join('').trim();
    const cleaned = rawText.replace(/^```json\s*/i, '').replace(/```$/, '').trim();

    let parsed;
    try {
      parsed = JSON.parse(cleaned);
    } catch (e) {
      console.error('Failed to parse Gemini JSON:', rawText);
      return res.status(502).json({ error: 'Analysis returned an unexpected format. Please try again.' });
    }

    return res.status(200).json(parsed);
  } catch (err) {
    console.error('analyze-transcript.js error:', err);
    return res.status(500).json({ error: 'Unexpected server error during analysis.' });
  }
}
