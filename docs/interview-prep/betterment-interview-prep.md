# Betterment — First Round EM Interview Prep
**Bilal Malik · iOS / Mobile Engineer · Interview: tomorrow**

---

## The one thing to remember

This is a **first-round hiring-manager screen**, not a coding test. The EM is deciding two things: *Can this person do the job?* and *Do I want them on my team?* Your job tomorrow is to come across as a **calm, senior, AI-native mobile engineer who's excited about Betterment specifically** — not desperate, not scattered. You have 15 years of mobile depth and you build with AI daily. Betterment is actively betting on AI. That's the whole story. Lead with it.

Energy: warm, concise, confident. Let them talk. Answer the question asked, then stop. Seniority reads as *calm*, not *comprehensive*.

---

## 1. Betterment at a glance (so you sound informed)

- **What they are:** The largest independent online financial advisor (robo-advisor). Automated, low-cost ETF portfolios, plus cash/checking, crypto, tax-loss harvesting, 401(k) for small businesses.
- **Scale:** ~$65B+ assets under management, 1M+ customers, ~600 employees, HQ in NYC. Privately held, ~$1.36B valuation.
- **CEO:** Sarah Levy (since 2020, took over from founder Jon Stein).
- **Engineering culture:** Known for craftsmanship, pair programming, and a thoughtful, non-FAANG-intense interview process. Ruby on Rails heritage on the backend; native mobile apps. They blog about engineering culture openly.

### Why this matters for YOU — the AI angle (lead with this)
Betterment is in the middle of a real, funded **AI push**, which is exactly the pro-AI environment you're looking for:
- **March 2026:** launched an **AI-enabled Account Recommender** — combines advisor-built logic with AI-generated explanations, built on dedicated infrastructure with **structured prompt governance, guardrails, and secure data orchestration**. (This is *your* vocabulary — evals, guardrails, context engineering.)
- CEO Sarah Levy has publicly called **AI "the most powerful expression"** of their thesis of expanding access to wealth-building.
- **73% of their customers** said they want AI-powered guidance; they've said more AI releases are coming through 2026 across service, product delivery, and productivity.

**Your hook:** *"You're building AI into a regulated, fiduciary product with real guardrails and governance — that's exactly the kind of engineering I've been doing and want to keep doing."*

---

## 2. What this round will actually cover

Betterment's full loop is long (phone screen → technical phone screen → a full onsite day of pair programming + product + hiring manager + exec). **You're at the front of that.** An EM first-round almost always covers:

1. **"Walk me through your background."** (Your opener — practice it cold.)
2. **Why Betterment? Why now?** (Motivation + culture fit.)
3. **A recent technical challenge / project you're proud of.** (They literally open their technical rounds with this — have one loaded.)
4. **How you work** — collaboration, mentoring, code review, disagreements.
5. **The gaps** — why you left VPG, and possibly the shape of your recent roles.
6. **Your questions for them.**

No LeetCode this round. But be ready to *talk* code fluently — architecture, trade-offs, how you'd approach a mobile problem — because Betterment weights "software craftsmanship" heavily and this EM is screening for the pairing rounds ahead.

---

## 3. Your 90-second background pitch (memorize the shape, not the words)

> "I'm a mobile engineer with about 15 years of experience, mostly iOS since 2013, and full-stack with React Native and a real backend/cloud footprint on top of that. I've spent most of my career in regulated, high-stakes products — patient health platforms at Allscripts reaching over a million patients, clinical-trial apps with connected medical devices at NuvoAir, and most recently the sole mobile engineer on an AI-first clinical research platform. I also led and built out the mobile team at FreedomCare, an app with 25,000+ daily users, so I've done the management side too. What's defined the last couple of years for me is going all-in on AI-assisted engineering — I build with Claude Code and Cursor and multi-agent workflows daily, and I even run a small studio, bamware, where specialist AI agents ship real apps behind guardrails and review gates. That's why Betterment jumped out at me — you're putting AI into a regulated product the right way, and that's exactly where I want to be."

Notice: regulated-industry depth (maps to fintech), management experience (relevant to an EM), and the AI throughline. Land it in ~90 seconds, then stop and let them steer.

---

## 4. Likely questions + how to answer

**"Why Betterment?"**
Three specifics: (1) the AI push done responsibly — Account Recommender, governance and guardrails, Levy's public bet on AI; (2) regulated/fiduciary product, which is where you've spent your career (health-tech, clinical research, compliance); (3) their engineering culture — craftsmanship, pairing, open engineering blog. Avoid generic "great mission." Name the Account Recommender by name; it shows you did the work.

**"Why are you looking / why did you leave VPG?"** *(see the tough-questions section — use the clean framing)*

**"Tell me about a technical challenge you're proud of."**
Best options:
- *bamware / multi-agent studio:* orchestrating specialist AI agents (design, iOS, RN, cloud, QA) with Claude Code + CrewAI behind evals and review gates to ship a full React Native app (Baat). Shows AI depth + system design + shipping.
- *VPG eCOA platform:* sole mobile engineer building a regulated clinical-research data-capture app in React Native/TS — talk about the compliance constraints and how you moved fast with AI tooling anyway.
- *FreedomCare:* rebuilding legacy mobile apps + Node/AWS microservices for 25k+ daily users, while building the team.
Use **STAR** loosely: Situation → what made it hard → what *you* did → the outcome. Keep the "what I did" the biggest part.

**"How do you approach working with other engineers / code review / mentoring?"**
You've managed a team and led as an IC. Themes: raising the bar through review without ego, unblocking people, writing things down, pairing. Betterment *loves* pairing — signal that you enjoy collaborative coding, not just heads-down solo work.

**"Tell me about a disagreement with a coworker or manager."**
Pick a *technical* disagreement with a professional resolution (data won, or you committed-and-disagreed). Keep it low-drama. Show you can be challenged and stay collaborative.

**"Mobile-technical talk"** — be ready to speak fluently on: Swift concurrency (async/await), SwiftUI vs UIKit trade-offs, React Native + native modules (you've written custom Swift modules), offline/sync, BLE, app architecture (MVVM), CI/CD (Fastlane/EAS/GitHub Actions), and testing. You don't need to whiteboard — just sound like someone who's shipped this many times, because you have.

**"Where do you want to go in your career? / IC or management?"**
Honest and flexible: you're strong as a senior/lead IC and you've managed, so you're open to either — what matters is a team that's all-in on AI, strong craft, and good balance. Don't sound rudderless; sound *deliberately open*.

---

## 5. The tough questions — handle these cleanly and move on

These will come. The winning move is **short, honest, forward-looking, zero defensiveness.** Answer in a few sentences and pivot to what you're excited about. Do **not** over-explain or bring up personal hardship in a first-round screen — you're not obligated to, and brevity reads as strength.

**"Why did you leave VPG / your last role?"**
> "My role at VPG wrapped up in July. The honest short version is it wasn't a long-term fit — the company restricted AI tooling, and I've committed to building AI-first. I'm specifically looking for a team that embraces it, which is a big part of why Betterment stood out."

That's it. It's true, it's professional, and it reframes the exit as *values alignment*, not a problem. If pressed, stay calm and consistent — don't add more than you need to.

**"Your recent roles have been fairly short — what's going on there?"**
Frame it factually and forward: several were **contract or lead roles by nature** (Photobucket, NuvoAir were project/contract-shaped), you go where the interesting mobile work is, and now you're looking to **plant roots somewhere for the long haul** — a stable, pro-AI team with good balance. The message: *this next one is the one I want to stay at.* Don't apologize; frame it as intentional and say plainly that stability and a long tenure are what you want now.

**If you're ever asked something you'd rather not detail:** "I'd rather focus forward — here's what I'm looking for next and why Betterment fits." Confident redirection is completely acceptable and lands well.

**Guardrail for tomorrow:** keep it professional and about the work. The divorce, your sister, the harder personal chapters — none of that belongs in a first-round screen, and you're under no obligation to raise it. You're healthy, focused, and ready. Let that show through *how* you carry yourself, not through disclosure.

---

## 6. Smart questions to ask the EM (pick 3–4)

Asking good questions is half the interview. Tailored ones:

- "I saw the Account Recommender launch in March — how is AI changing the way your engineering teams actually build day to day? Are engineers encouraged to use AI coding tools?" *(surfaces the fit that matters most to you, without leading with a demand)*
- "What does the mobile stack look like today — native iOS/Android, or React Native, or a mix? Where's it heading?"
- "How is the mobile team structured, and where would this role fit in?"
- "You're known for pairing and craftsmanship — what does a strong first 90 days look like for someone in this role?"
- "What's the biggest technical challenge the mobile team is focused on over the next year?"
- "What do you enjoy about managing here, and what makes someone thrive on your team?"

Avoid asking about comp, WFH policy, or work-life balance in *this* round — save those for the recruiter or a later stage. (You care about them; just not the questions that win a hiring-manager screen.)

---

## 7. Logistics & final checklist for tomorrow

- [ ] Confirm the **exact time, timezone (ET), and format** (Zoom/Google Meet/phone) and the EM's name — reread it in the calendar invite tonight.
- [ ] If video: test camera/mic, clean background, good light, water nearby.
- [ ] Have your **resume**, this doc, and the Betterment tab open but off to the side.
- [ ] Reread the job description once more for the exact title and any keywords to echo.
- [ ] Have **one project you can talk about for 5+ minutes** locked in (bamware or VPG).
- [ ] Have **your 3–4 questions** ready on screen.
- [ ] Sleep. Seriously — calm and rested beats over-prepared and wired.

**Salary, if it comes up early (it usually doesn't in an EM screen):** deflect gently — "I'm sure we can find a fair number if it's the right fit; I'd love to learn more about the role first." Your target band is $230–280k if you're pushed for a number later.

---

*You've shipped mobile for 15 years and you're ahead of almost everyone on AI. This is a screen you're well-positioned to pass. Go be the calm, senior version of yourself.*
