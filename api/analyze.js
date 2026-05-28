// Vercel Serverless Function - Math Problem Analysis API
// Using Xiaomi MiMo Vision Model

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Only POST allowed' });
  }

  try {
    const { image } = req.body;

    if (!image) {
      return res.status(400).json({ error: 'No image provided' });
    }

    const apiKey = process.env.XIAOMI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'API Key not configured' });
    }

    const response = await fetch('https://api.xiaomimimo.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'mimo-vision',
        messages: [
          {
            role: 'system',
            content: `You are a professional high school math teacher. Analyze the math problem in the image and provide:
1. Problem Content: Accurately transcribe the problem text
2. Knowledge Points: List the math concepts tested
3. Error Analysis: If it is a wrong answer, analyze the possible error reasons
4. Solution Method: Provide clear step-by-step solution
5. Practice Problems: Suggest 2-3 similar problems for practice

Use concise and easy-to-understand language suitable for first-year high school students.`
          },
          {
            role: 'user',
            content: [
              {
                type: 'image_url',
                image_url: {
                  url: image.startsWith('data:') ? image : `data:image/jpeg;base64,${image}`
                }
              },
              {
                type: 'text',
                text: 'Please analyze this math problem. Tell me the problem content, knowledge points, solution method, and if it is a wrong answer, analyze the error reason.'
              }
            ]
          }
        ],
        max_tokens: 2000
      })
    });

    if (!response.ok) {
      console.error('API Error:', await response.text());
      return res.status(500).json({ error: 'AI analysis failed' });
    }

    const data = await response.json();
    const analysis = data.choices?.[0]?.message?.content;

    if (!analysis) {
      return res.status(500).json({ error: 'No analysis result' });
    }

    return res.status(200).json({
      success: true,
      analysis: analysis,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Server Error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
