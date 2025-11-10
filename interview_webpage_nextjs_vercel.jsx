# Interview Webpage — Next.js + Tailwind starter

This single-file developer-ready package contains everything you need to deploy an **Interview Practice** webpage to **Vercel**.

Features
- Enter role, company, program (optional)
- Requests interview questions (uses OpenAI to synthesize questions and simulate "web search")
- Presents questions one-by-one
- Lets the candidate type answers and submit for AI grading with a score + feedback
- A simple history of Q&A for the session
- Designed as a minimal Next.js app (React component) + serverless API route using the OpenAI REST API

---

## Files included below (copy each into your Next.js project)

### 1) `pages/index.jsx` — Client page (React)

```jsx
import { useState } from 'react'

export default function Home() {
  const [role, setRole] = useState('Software Engineer')
  const [company, setCompany] = useState('Acme Corp')
  const [program, setProgram] = useState('New Grad')
  const [questions, setQuestions] = useState([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [answer, setAnswer] = useState('')
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(false)

  async function fetchQuestions() {
    setLoading(true)
    const res = await fetch('/api/interview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'generate_questions', role, company, program }),
    })
    const data = await res.json()
    setQuestions(data.questions || [])
    setCurrentIndex(0)
    setHistory([])
    setAnswer('')
    setLoading(false)
  }

  async function gradeAnswer() {
    if (!questions[currentIndex]) return
    setLoading(true)
    const res = await fetch('/api/interview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'grade_answer',
        role,
        company,
        program,
        question: questions[currentIndex],
        answer,
      }),
    })
    const data = await res.json()
    const entry = {
      question: questions[currentIndex],
      answer,
      score: data.score,
      feedback: data.feedback,
    }
    setHistory((h) => [entry, ...h])
    setAnswer('')
    setCurrentIndex((i) => Math.min(i + 1, questions.length - 1))
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto bg-white rounded-2xl shadow p-6">
        <h1 className="text-2xl font-bold mb-4">Interview Practice — AI</h1>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
          <input value={role} onChange={(e)=>setRole(e.target.value)} placeholder="Role (e.g. Product Manager)" className="p-2 border rounded" />
          <input value={company} onChange={(e)=>setCompany(e.target.value)} placeholder="Company (optional)" className="p-2 border rounded" />
          <input value={program} onChange={(e)=>setProgram(e.target.value)} placeholder="Program (optional)" className="p-2 border rounded" />
        </div>

        <div className="flex gap-2 mb-6">
          <button onClick={fetchQuestions} className="px-4 py-2 bg-blue-600 text-white rounded">Fetch Questions</button>
          <button onClick={() => { setQuestions([]); setHistory([]); setAnswer('') }} className="px-4 py-2 border rounded">Reset</button>
          {loading && <div className="ml-2">Loading…</div>}
        </div>

        {questions.length === 0 ? (
          <div className="text-gray-500">No questions yet. Click &quot;Fetch Questions&quot; to generate a set tailored to your role.</div>
        ) : (
          <div>
            <div className="mb-4">
              <div className="text-sm text-gray-600">Question {currentIndex+1} / {questions.length}</div>
              <div className="mt-2 p-4 border rounded bg-gray-50">{questions[currentIndex]}</div>
            </div>

            <textarea value={answer} onChange={(e)=>setAnswer(e.target.value)} rows={6} placeholder="Type your answer here..." className="w-full p-3 border rounded mb-3" />

            <div className="flex gap-2">
              <button onClick={gradeAnswer} className="px-4 py-2 bg-green-600 text-white rounded">Submit & Grade</button>
              <button onClick={() => setCurrentIndex(i => Math.max(0, i-1))} className="px-4 py-2 border rounded">Prev</button>
              <button onClick={() => setCurrentIndex(i => Math.min(questions.length-1, i+1))} className="px-4 py-2 border rounded">Next</button>
            </div>

            <div className="mt-6">
              <h3 className="font-semibold mb-2">Session history</h3>
              {history.length === 0 ? <div className="text-gray-500">No answered questions yet.</div> : (
                <div className="space-y-3">
                  {history.map((h, idx) => (
                    <div key={idx} className="p-3 border rounded">
                      <div className="text-sm text-gray-600">Score: <strong>{h.score}</strong></div>
                      <div className="mt-1"><strong>Q:</strong> {h.question}</div>
                      <div className="mt-1"><strong>A:</strong> {h.answer}</div>
                      <div className="mt-2 text-gray-700"><strong>Feedback:</strong> {h.feedback}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
```


### 2) `pages/api/interview.js` — Serverless API (Node.js) to call OpenAI

```js
// pages/api/interview.js
import fetch from 'node-fetch'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()
  const { action, role, company, program, question, answer } = req.body || {}
  const promptBase = `You are an expert interviewer and interviewer coach. Be concise and use numbered lists where appropriate.`

  try {
    if (action === 'generate_questions') {
      const prompt = `${promptBase}\n\nGenerate 8 interview questions tailored to the role: ${role}. Company: ${company || 'generic'}. Program: ${program || 'general'}. Include a mix of behavioral, technical and role-specific questions. For each question include a short tag in parentheses like (behavioral) or (technical).`;

      const resp = await openaiCompletion(prompt)
      // Expecting plain text with questions separated by newlines — parse into array
      const questions = resp.split(/\n+/).map(s=>s.replace(/^\d+\.\s*/,'').trim()).filter(Boolean)
      return res.json({ questions })
    }

    if (action === 'grade_answer') {
      const gradingPrompt = `${promptBase}\n\nYou are grading an interview answer. Role: ${role}. Company: ${company || 'generic'}. Program: ${program || 'general'}.\n\nQuestion: ${question}\n\nCandidate answer: ${answer}\n\nProvide:\n1) A numeric score from 1-10 (only the number on the first line).\n2) A short paragraph (1-3 sentences) explaining the score and 3 bullet point suggestions to improve the answer.\nKeep the response JSON-stringifiable.`

      const resp = await openaiCompletion(gradingPrompt)
      // Try to parse score and feedback heuristically
      const lines = resp.split('\n').map(l=>l.trim()).filter(Boolean)
      let score = lines[0].match(/\d+/) ? parseInt(lines[0].match(/\d+/)[0],10) : 0
      const feedback = lines.slice(1).join(' ')
      return res.json({ score, feedback })
    }

    return res.status(400).json({ error: 'invalid action' })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: err.message || String(err) })
  }
}

async function openaiCompletion(prompt) {
  const key = process.env.OPENAI_API_KEY
  if (!key) throw new Error('OPENAI_API_KEY not set')

  const resp = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 700
    })
  })
  const data = await resp.json()
  if (!data.choices || !data.choices[0]) throw new Error('OpenAI error')
  return data.choices[0].message.content
}
```


---

## Quick setup & deployment to Vercel

1. Create a Next.js project (`npx create-next-app@latest my-interview-app`) or drop the files into an existing project.
2. Add Tailwind CSS (optional) or adjust classes. You can also remove Tailwind classes and use plain CSS.
3. Add the two files above: `pages/index.jsx` and `pages/api/interview.js`.
4. Set an environment variable in Vercel: `OPENAI_API_KEY` (your OpenAI API key). In Vercel dashboard: Project → Settings → Environment Variables.
5. Deploy to Vercel via `vercel` CLI or push to GitHub and import project in Vercel dashboard.

Notes & suggestions
- You must provide your own OpenAI API key. If you prefer not to expose an API key, consider using Vercel's serverless functions + a proxy, or an intermediate backend you control.
- The serverless handler `pages/api/interview.js` uses a basic parsing approach. You may want to make the OpenAI prompts more robust and sanitize inputs.
- To actually *search the web* for recent interview questions, you can:
  - call a web-search API (SerpAPI, Bing Search API) inside the serverless function and synthesize results before passing to OpenAI; or
  - instruct the model to "simulate" searching the web and generate likely up-to-date interview questions (the current example just asks the model to produce them).
- Rate limits & cost: each grading call uses an OpenAI chat completion. Keep an eye on usage.

---

If you'd like, I can:
- Provide a version that uses a real web-search API (I'll include code + how to get a SerpAPI key).
- Replace the backend to use edge functions or middleware optimized for Vercel.
- Add authentication (so each candidate's history is private) and persistent storage (e.g., Supabase).

