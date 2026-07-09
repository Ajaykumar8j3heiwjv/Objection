// /api/transcribe-chunk.js
// Transcribes ONE short audio segment (a few minutes) and returns plain text.
// Used for long calls: the browser auto-splits recording into small segments,
// each one gets sent here separately so no single request ever nears
// Vercel's 4.5MB request body limit.

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '4mb'
    }
  }
};

export const maxDuration = 60;

const LANGUAGE_NAMES = {
  auto: 'an unspecified Indian language (detect it yourself)',
  en: 'English',
  ta: 'Tamil',
  hi: 'Hindi',
  te: 'Telugu'
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'Server is missing GEMINI_API_KEY.' });
  }

  try {
    const { audioBase64, mimeType, language } = req.body || {};
    if (!audioBase64) {
      return res.status(400).json({ error: 'No audio provided.' });
    }

    const languageLabel = LANGUAGE_NAMES[language] || LANGUAGE_NAMES.auto;
    const prompt = `Transcribe this audio segment exactly as spoken. The speaker is talking in ${languageLabel}, possibly mixed with English. This is one segment of a longer sales call, so it may start or end mid-sentence — that's fine, transcribe only what's audible. Respond with ONLY the transcript text, nothing else — no labels, no commentary, no markdown.`;

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
                { inline_data: { mime_type: mimeType || 'audio/webm', data: audioBase64 } }
              ]
            }
          ],
          generationConfig: { temperature: 0.2 }
        })
      }
    );

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      console.error('Gemini chunk transcription error:', errText);
      return res.status(502).json({ error: 'Transcription failed for one segment. Please try again.' });
    }

    const data = await geminiRes.json();
    const text = (data.candidates?.[0]?.content?.parts || []).map((p) => p.text || '').join('').trim();

    return res.status(200).json({ transcript: text });
  } catch (err) {
    console.error('transcribe-chunk.js error:', err);
    return res.status(500).json({ error: 'Unexpected server error while transcribing a segment.' });
  }
}
