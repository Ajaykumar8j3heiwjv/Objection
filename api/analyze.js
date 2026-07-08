// /api/analyze.js
// Vercel serverless function — FREE VERSION using Google's Gemini API.
//
// Gemini accepts audio directly, so this one function both transcribes the
// pitch AND coaches it in a single call. No OpenAI, no Anthropic, no card needed.
//
// Setup:
// 1. Go to https://aistudio.google.com/apikey
// 2. Sign in with any Google account, click "Create API Key" — no billing required.
// 3. In Vercel: Project Settings -> Environment Variables, add:
//      GEMINI_API_KEY = your key
// 4. Redeploy.
//
// Free tier: no card, no expiry, generous daily request limit — more than enough
// for a BDA team practicing pitches. If you ever outgrow it, the same code works
// after enabling billing in Google AI Studio; nothing else changes.

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '25mb'
    }
  }
};

export const maxDuration = 60; // seconds — gives Gemini enough time on longer recordings

const LANGUAGE_NAMES = {
  auto: 'an unspecified Indian language (detect it yourself)',
  en: 'English',
  ta: 'Tamil',
  hi: 'Hindi',
  te: 'Telugu'
};

const PROMPT_TEMPLATE = (languageLabel) => `You are a sales coach for BDAs (Business Development Associates) at GUVI/HCL who sell upskilling courses over the phone in India. BDAs pitch in English, Tamil, Hindi, or Telugu, often mixed together.

You are given an audio recording of a real or practice sales call, spoken in ${languageLabel}.

Do two things:
1. Transcribe the audio as accurately as you can. If the speaker mixes languages, transcribe it as spoken (don't force-translate).
2. Coach the pitch using this rubric:
   - Opening & rapport — did they build trust before pitching?
   - Needs discovery — did they ask about the customer's goals, background, or constraints before pushing the course?
   - Objection handling — did they acknowledge the customer's concern (price, time, family approval, etc.) before responding, or did they argue/dismiss it?
   - Clarity & structure — was the pitch clear and not rambling?
   - Tone & confidence — consultative and confident, or pushy/scripted?
   - Call to action / next step — did the call end with a clear next step?

Respond with ONLY valid JSON (no markdown fences, no commentary) matching exactly this shape:

{
  "transcript": "<full transcript of the audio, in the original language/script as spoken>",
  "overall_score": <integer 0-100>,
  "headline": "<one short phrase summarizing pitch quality, e.g. 'Strong rapport, weak close'>",
  "summary": "<2-3 sentence overview of how the call went>",
  "strengths": ["<specific thing they did well>", "..."],
  "improvements": ["<specific, actionable coaching tip>", "..."],
  "objection_notes": ["<note on a specific objection moment and how it was handled, or state none were raised>", "..."]
}

Rules:
- Base every point on specific evidence from the audio. Do not invent details.
- Keep each bullet under 25 words.
- Give 3-5 items per list where the audio supports it.
- If the audio is silent, too short, or unclear, say so honestly in "summary", set transcript to whatever you could make out (or empty string), and score conservatively (below 30).
- Output must be raw JSON only — nothing before or after it.`;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'Server is missing GEMINI_API_KEY. Add it in Vercel project settings.' });
  }

  try {
    const { audioBase64, mimeType, language } = req.body || {};
    if (!audioBase64) {
      return res.status(400).json({ error: 'No audio provided.' });
    }

    const languageLabel = LANGUAGE_NAMES[language] || LANGUAGE_NAMES.auto;
    const prompt = PROMPT_TEMPLATE(languageLabel);

    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: prompt },
                {
                  inline_data: {
                    mime_type: mimeType || 'audio/webm',
                    data: audioBase64
                  }
                }
              ]
            }
          ],
          generationConfig: {
            temperature: 0.4,
            responseMimeType: 'application/json'
          }
        })
      }
    );

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      console.error('Gemini API error:', errText);
      return res.status(502).json({ error: 'Analysis service failed. Please try again in a moment.' });
    }

    const data = await geminiRes.json();
    const rawText = (data.candidates?.[0]?.content?.parts || [])
      .map((p) => p.text || '')
      .join('')
      .trim();

    const cleaned = rawText.replace(/^```json\s*/i, '').replace(/```$/, '').trim();

    let parsed;
    try {
      parsed = JSON.parse(cleaned);
    } catch (parseErr) {
      console.error('Failed to parse Gemini JSON:', rawText);
      return res.status(502).json({ error: 'Analysis returned an unexpected format. Please try again.' });
    }

    return res.status(200).json(parsed);
  } catch (err) {
    console.error('analyze.js error:', err);
    return res.status(500).json({ error: 'Unexpected server error during analysis.' });
  }
}
