import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { transcript } = req.body;

  // Replace this with OpenAI or custom logic
  const feedback = {
    score: 7,
    tone: 'Neutral',
    fillerWords: 5,
    suggestions: [
      'Use more persuasive language.',
      'Avoid repeating phrases.',
      'Add a stronger call to action.',
    ],
  };

  res.status(200).json(feedback);
}
