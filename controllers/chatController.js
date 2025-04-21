const { model } = require('../services/geminiService');

let preloadedData = null;

const preloadData = (req, res) => {
  preloadedData = req.body.data; // Expecting { item, details } from the frontend
  res.json({ message: 'Data preloaded successfully!' });
};

const chat = async (req, res) => {
  const userMessage = req.body.message;

  if (!preloadedData) {
    return res.json({ reply: 'No data preloaded yet! Select a part first.' });
  }

  try {
    const prompt = `You're an educational AI assistant for engineering and materials science. Analyze this component: ${preloadedData.item}. Based on these details: ${preloadedData.details}, create an engaging educational explanation. Format your response as HTML with point-by-point information using emojis. Focus on what this part is, how it functions, its materials, and why it's important. Keep the tone conversational and educational, helping students understand this specific component thoroughly.
    don't fix any static method to respose, just return the respose what you get form user message`;

    const result = await model.generateContent(prompt);
    const speech = result.response.text();
    res.json({ reply: speech });
  } catch (error) {
    console.error('Error with Generative AI:', error);
    res.json({ reply: `Whoops, I hit a snag! Let’s talk about the ${preloadedData.item}—what do you want to know?` });
  }
};

module.exports = { preloadData, chat };