// /api/translate.js
// Translates a transcript (Tamil/Hindi/Telugu/mixed) to plain English.
// Text-only request, small and fast — no audio involved.

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '2mb'
    }
  }
};

export const maxDuration = 60;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'Server is missing GEMINI_API_KEY.' });
  }

  try {
    const { transcript } = req.body || {};
    if (!transcript || !transcript.trim()) {
      return res.status(400).json({ error: 'No transcript provided.' });
    }

    const prompt = `Translate the following sales call transcript into clear, natural English. It may be in Tamil, Hindi, Telugu, or a mix of these with English. Keep the meaning and tone faithful — don't summarize or shorten it, translate it in full. Respond with ONLY the translated text, nothing else (no labels, no commentary).\n\nTranscript:\n"""\n${transcript.trim()}\n"""`;

    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.2 }
        })
      }
    );

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      console.error('Gemini translate error:', errText);
      return res.status(502).json({ error: 'Translation failed. Please try again.' });
    }

    const data = await geminiRes.json();
    const translated = (data.candidates?.[0]?.content?.parts || []).map((p) => p.text || '').join('').trim();

    if (!translated) {
      return res.status(502).json({ error: 'Translation returned empty text. Please try again.' });
    }

    return res.status(200).json({ translated });
  } catch (err) {
    console.error('translate.js error:', err);
    return res.status(500).json({ error: 'Unexpected server error during translation.' });
  }
}
