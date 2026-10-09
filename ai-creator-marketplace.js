/**
 * Luma — AI Creator Marketplace MVP
 *
 * Run: node ai-creator-marketplace.js
 * Open: http://localhost:3000
 *
 * Requires Node.js 22.5+ (uses the built-in SQLite module). No npm install.
 * A marketplace.db file is created beside this file on the first run.
 */

"use strict";

const http = require("node:http");
const path = require("node:path");
const { DatabaseSync } = require("node:sqlite");

const PORT = Number(process.env.PORT || 3000);
// Set DATABASE_PATH on a host to a persistent-disk location, e.g. /var/data/marketplace.db.
// Without it, local development stores the database beside this source file.
const DB_PATH = process.env.DATABASE_PATH || path.join(__dirname, "luma-marketplace");
const db = new DatabaseSync(DB_PATH);
db.exec("PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;");

function json(value) {
  return JSON.stringify(value);
}

function asList(value) {
  try {
    return Array.isArray(JSON.parse(value)) ? JSON.parse(value) : [];
  } catch {
    return [];
  }
}

function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY,
      handle TEXT NOT NULL UNIQUE,
      email TEXT NOT NULL UNIQUE,
      role TEXT NOT NULL CHECK (role IN ('creator', 'brand', 'agency')),
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS creator_profiles (
      user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      display_name TEXT NOT NULL,
      headline TEXT NOT NULL,
      bio TEXT NOT NULL,
      location TEXT NOT NULL,
      rate_min INTEGER NOT NULL,
      rate_max INTEGER NOT NULL,
      availability TEXT NOT NULL,
      tags TEXT NOT NULL DEFAULT '[]',
      tools TEXT NOT NULL DEFAULT '[]',
      followers INTEGER NOT NULL DEFAULT 0,
      completed_projects INTEGER NOT NULL DEFAULT 0,
      rating REAL NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS portfolio_items (
      id INTEGER PRIMARY KEY,
      creator_id INTEGER NOT NULL REFERENCES creator_profiles(user_id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      format TEXT NOT NULL,
      description TEXT NOT NULL,
      cover_gradient TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS briefs (
      id INTEGER PRIMARY KEY,
      brand_id INTEGER NOT NULL REFERENCES users(id),
      company TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      budget_min INTEGER NOT NULL,
      budget_max INTEGER NOT NULL,
      deadline TEXT NOT NULL,
      tags TEXT NOT NULL DEFAULT '[]',
      status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('draft', 'open', 'paused', 'filled')),
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS applications (
      id INTEGER PRIMARY KEY,
      brief_id INTEGER NOT NULL REFERENCES briefs(id) ON DELETE CASCADE,
      creator_id INTEGER NOT NULL REFERENCES creator_profiles(user_id) ON DELETE CASCADE,
      message TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted', 'shortlisted', 'declined', 'contracted')),
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (brief_id, creator_id)
    );
  `);

  const { count } = db.prepare("SELECT COUNT(*) AS count FROM users").get();
  if (count) return;

  const addUser = db.prepare("INSERT INTO users (id, handle, email, role) VALUES (?, ?, ?, ?)");
  const addProfile = db.prepare(`
    INSERT INTO creator_profiles
    (user_id, display_name, headline, bio, location, rate_min, rate_max, availability, tags, tools, followers, completed_projects, rating)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const addPortfolio = db.prepare(`
    INSERT INTO portfolio_items (creator_id, title, format, description, cover_gradient)
    VALUES (?, ?, ?, ?, ?)
  `);
  const addBrief = db.prepare(`
    INSERT INTO briefs (brand_id, company, title, description, budget_min, budget_max, deadline, tags, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const creators = [
    [1, "maya-chen", "maya@example.com", "Maya Chen", "AI Art Director & Motion Designer", "I build cinematic launch worlds where generative visual systems meet sharp brand storytelling.", "Singapore", 1500, 4500, "Available this month", ["Midjourney", "Runway", "Brand Films", "3D"], ["Midjourney", "Runway", "After Effects", "Blender"], 124000, 38, 4.9],
    [2, "noah-studio", "noah@example.com", "Noah Williams", "AI Product Storyteller", "Product demos, social-first narratives and delightfully strange generative motion for technology brands.", "London, UK", 900, 3200, "Available in 2 weeks", ["Product Video", "Sora", "Social", "Copy"], ["Sora", "Figma", "Premiere Pro", "ElevenLabs"], 86000, 52, 4.8],
    [3, "amina-rahman", "amina@example.com", "Amina Rahman", "Generative Fashion & Image Maker", "I turn editorial concepts into distinctive AI image campaigns with a considered eye for culture and craft.", "New York, USA", 2000, 6000, "Available now", ["Fashion", "Campaigns", "Stable Diffusion", "Editorial"], ["ComfyUI", "Photoshop", "Stable Diffusion", "Krea"], 211000, 29, 5.0],
    [4, "jo-kim", "jo@example.com", "Jo Kim", "AI Sound & Interactive Artist", "Sound identities, generative music and interactive web pieces for brands that want to be heard differently.", "Seoul, South Korea", 1200, 5000, "Booking April", ["Audio", "Suno", "Interactive", "Experiential"], ["Suno", "TouchDesigner", "Ableton", "p5.js"], 44000, 24, 4.9],
    [5, "leon-orbit", "leon@example.com", "Leon Ortiz", "AI World Builder", "I prototype speculative worlds for games, culture and entertainment—fast enough to take an idea to pitch-ready.", "Mexico City, Mexico", 1800, 5500, "Available now", ["Games", "Unreal", "Concept Art", "Characters"], ["Unreal Engine", "Midjourney", "Houdini", "Runway"], 67000, 31, 4.7],
    [6, "sana-patel", "sana@example.com", "Sana Patel", "AI Social Creative Director", "High-volume, on-brand social concepts that turn trends into platform-native campaigns without losing the idea.", "Mumbai, India", 700, 2500, "Available next week", ["Social", "UGC", "TikTok", "Copy"], ["CapCut", "ChatGPT", "Midjourney", "Canva"], 189000, 74, 4.8]
  ];

  db.exec("BEGIN");
  try {
    for (const c of creators) {
      addUser.run(c[0], c[1], c[2], "creator");
      addProfile.run(c[0], c[3], c[4], c[5], c[6], c[7], c[8], c[9], json(c[10]), json(c[11]), c[12], c[13], c[14]);
    }
    addUser.run(20, "northstar", "hello@northstar.example", "brand");
    addUser.run(21, "signal-agency", "studio@signal.example", "agency");

    const work = [
      [1, "Chrome Mirage", "Brand film", "A liquid-metal launch world for a next-generation electric vehicle.", "linear-gradient(135deg,#6d5dfc,#beff63)"],
      [1, "Afterlight", "Campaign", "Dreamlike visual directions for a global beauty launch.", "linear-gradient(135deg,#ff8f70,#8f6fff)"],
      [2, "Orbit OS", "Product story", "A tactile, impossible product demonstration for a new operating system.", "linear-gradient(135deg,#10b7bb,#153a6f)"],
      [3, "Soft Armour", "Editorial", "AI-made fashion editorial exploring protection and softness.", "linear-gradient(135deg,#f8d3c5,#3c306a)"],
      [4, "Pulse Objects", "Sound identity", "A sonic system for objects that react to touch.", "linear-gradient(135deg,#fa4e8b,#281a62)"],
      [5, "Sundown Protocol", "Game world", "A cinematic near-future city developed for a games pitch.", "linear-gradient(135deg,#ff9a3e,#402656)"],
      [6, "Snackverse", "Social campaign", "Thirty scroll-stopping short-form ideas for a challenger food brand.", "linear-gradient(135deg,#f4c81c,#e84369)"]
    ];
    for (const item of work) addPortfolio.run(...item);

    const briefs = [
      [20, "Northstar Audio", "Give our wireless earbuds an impossible launch world", "Create a 20–30 second hero film and a handful of social cut-downs. We want sound to become visible: playful, tactile and not another neon waveform.", 3500, 6500, "2026-11-15", ["Brand Films", "Audio", "Runway", "Product Video"], "open"],
      [21, "Signal / Arc", "Fashion campaign: synthetic summer", "We need a visual creator to make a stills-led campaign for a global fashion client. The mood is sun-bleached, surreal and joyfully over-composed.", 5000, 9000, "2026-11-30", ["Fashion", "Campaigns", "Editorial", "Stable Diffusion"], "open"],
      [20, "Northstar Audio", "Creator-led social series for a new audio product", "Develop 12 platform-native concepts and produce six rapid-turnaround videos. Strong taste in internet culture and product storytelling essential.", 2000, 4200, "2026-10-31", ["Social", "TikTok", "Product Video", "Copy"], "open"]
    ];
    for (const brief of briefs) addBrief.run(brief[0], brief[1], brief[2], brief[3], brief[4], brief[5], brief[6], json(brief[7]), brief[8]);
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

function publicCreator(row) {
  if (!row) return null;
  return { ...row, tags: asList(row.tags), tools: asList(row.tools) };
}

function publicBrief(row) {
  return { ...row, tags: asList(row.tags) };
}

function tokens(value) {
  return new Set(asList(value).map((x) => String(x).toLowerCase()));
}

function score(creator, brief) {
  const creatorTags = tokens(creator.tags);
  const briefTags = tokens(brief.tags);
  const matched = [...briefTags].filter((tag) => creatorTags.has(tag));
  const total = Math.max(briefTags.size, 1);
  const skillScore = Math.round((matched.length / total) * 70);
  const budgetScore = creator.rate_min <= brief.budget_max ? 15 : 0;
  const ratingScore = Math.round(creator.rating * 3);
  return { value: Math.min(99, skillScore + budgetScore + ratingScore), matched };
}

function getCreators(search = "", skill = "") {
  const query = String(search).trim().toLowerCase();
  const filter = String(skill).trim().toLowerCase();
  const rows = db.prepare("SELECT cp.*, u.handle FROM creator_profiles cp JOIN users u ON u.id = cp.user_id ORDER BY cp.rating DESC, cp.followers DESC").all();
  return rows.map(publicCreator).filter((creator) => {
    const haystack = [creator.display_name, creator.headline, creator.bio, creator.location, ...creator.tags, ...creator.tools].join(" ").toLowerCase();
    return (!query || haystack.includes(query)) && (!filter || creator.tags.some((tag) => tag.toLowerCase() === filter));
  });
}

function getBriefs() {
  return db.prepare("SELECT * FROM briefs WHERE status = 'open' ORDER BY created_at DESC, id DESC").all().map(publicBrief);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk;
      if (raw.length > 1_000_000) req.destroy();
    });
    req.on("end", () => {
      try { resolve(raw ? JSON.parse(raw) : {}); }
      catch { reject(new Error("Request body must be valid JSON.")); }
    });
    req.on("error", reject);
  });
}

function send(res, status, payload) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  res.end(JSON.stringify(payload));
}

async function api(req, res, url) {
  if (req.method === "GET" && url.pathname === "/api/creators") {
    return send(res, 200, { creators: getCreators(url.searchParams.get("search"), url.searchParams.get("skill")) });
  }

  const creatorMatch = url.pathname.match(/^\/api\/creators\/(\d+)$/);
  if (req.method === "GET" && creatorMatch) {
    const id = Number(creatorMatch[1]);
    const row = db.prepare("SELECT cp.*, u.handle FROM creator_profiles cp JOIN users u ON u.id = cp.user_id WHERE cp.user_id = ?").get(id);
    if (!row) return send(res, 404, { error: "Creator not found." });
    const portfolio = db.prepare("SELECT * FROM portfolio_items WHERE creator_id = ? ORDER BY id DESC").all(id);
    return send(res, 200, { creator: publicCreator(row), portfolio });
  }

  if (req.method === "GET" && url.pathname === "/api/briefs") {
    return send(res, 200, { briefs: getBriefs() });
  }

  if (req.method === "GET" && url.pathname === "/api/matches") {
    const briefId = Number(url.searchParams.get("briefId"));
    const brief = db.prepare("SELECT * FROM briefs WHERE id = ?").get(briefId);
    if (!brief) return send(res, 404, { error: "Brief not found." });
    const matches = getCreators().map((creator) => ({ creator, ...score(creator, brief) })).sort((a, b) => b.value - a.value);
    return send(res, 200, { brief: publicBrief(brief), matches });
  }

  if (req.method === "GET" && url.pathname === "/api/dashboard") {
    const stats = {
      creators: db.prepare("SELECT COUNT(*) AS value FROM creator_profiles").get().value,
      openBriefs: db.prepare("SELECT COUNT(*) AS value FROM briefs WHERE status = 'open'").get().value,
      applications: db.prepare("SELECT COUNT(*) AS value FROM applications").get().value
    };
    return send(res, 200, { stats, briefs: getBriefs() });
  }

  if (req.method === "POST" && url.pathname === "/api/briefs") {
    const body = await readBody(req);
    const title = String(body.title || "").trim();
    const company = String(body.company || "").trim();
    const description = String(body.description || "").trim();
    const minimum = Number(body.budget_min);
    const maximum = Number(body.budget_max);
    const deadline = String(body.deadline || "").trim();
    const tags = Array.isArray(body.tags) ? body.tags.map((x) => String(x).trim()).filter(Boolean).slice(0, 8) : [];
    if (!title || !company || !description || !Number.isFinite(minimum) || !Number.isFinite(maximum) || minimum <= 0 || maximum < minimum || !deadline) {
      return send(res, 400, { error: "Complete the title, company, description, valid budget and deadline." });
    }
    const result = db.prepare("INSERT INTO briefs (brand_id, company, title, description, budget_min, budget_max, deadline, tags, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'open')")
      .run(20, company, title, description, Math.round(minimum), Math.round(maximum), deadline, json(tags));
    const brief = db.prepare("SELECT * FROM briefs WHERE id = ?").get(Number(result.lastInsertRowid));
    return send(res, 201, { brief: publicBrief(brief), message: "Your brief is live. Matching creators are ready to review." });
  }

  if (req.method === "POST" && url.pathname === "/api/applications") {
    const body = await readBody(req);
    const briefId = Number(body.brief_id);
    const creatorId = Number(body.creator_id || 1); // Demo identity: Maya Chen.
    const message = String(body.message || "I would love to explore this with you.").trim().slice(0, 1200);
    if (!briefId || !message) return send(res, 400, { error: "A brief and a short note are required." });
    try {
      db.prepare("INSERT INTO applications (brief_id, creator_id, message) VALUES (?, ?, ?)").run(briefId, creatorId, message);
      return send(res, 201, { message: "Application sent. The brand can now shortlist or contact the creator." });
    } catch (error) {
      if (String(error.message).includes("UNIQUE")) return send(res, 409, { error: "This demo creator has already applied to that brief." });
      throw error;
    }
  }

  return false;
}

const page = String.raw`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="description" content="Luma — the AI-native creator marketplace.">
  <title>Luma — AI Creator Marketplace</title>
  <style>
    :root{--ink:#141018;--muted:#6d6672;--paper:#fffdfa;--line:#e8e1e8;--violet:#6d46f7;--lime:#cff56b;--pink:#ff86a7;--lav:#ded5ff;--shadow:0 18px 50px rgba(47,30,71,.12)}
    *{box-sizing:border-box} html{scroll-behavior:smooth} body{margin:0;background:var(--paper);color:var(--ink);font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;letter-spacing:-.015em} button,input,textarea{font:inherit} button{cursor:pointer} a{color:inherit;text-decoration:none}
    .shell{max-width:1180px;margin:auto;padding:0 24px}.topbar{height:76px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid transparent}.brand{font-family:Georgia,serif;font-size:30px;font-weight:700;letter-spacing:-.08em}.brand i{display:inline-block;width:10px;height:10px;background:var(--pink);border-radius:50%;margin-left:3px}.nav{display:flex;gap:24px;color:var(--muted);font-size:14px}.nav button{color:inherit;border:0;background:transparent;padding:9px 0}.nav button:hover{color:var(--violet)}.pill,.button{border:0;border-radius:999px;padding:12px 18px;font-weight:700;font-size:14px}.pill{background:var(--ink);color:#fff}.button{background:var(--violet);color:#fff;box-shadow:0 8px 18px rgba(109,70,247,.22)}.button:hover{transform:translateY(-1px)}.button.alt{color:var(--ink);background:var(--lime);box-shadow:none}.button.ghost{background:transparent;color:var(--ink);border:1px solid var(--line);box-shadow:none}.eyebrow{display:inline-flex;gap:8px;align-items:center;border:1px solid rgba(20,16,24,.13);border-radius:999px;padding:7px 11px;font-size:12px;font-weight:700;background:#fff}.dot{width:7px;height:7px;background:#3ab77a;border-radius:50%}
    .hero{display:grid;grid-template-columns:1.15fr .85fr;gap:42px;padding:72px 0 54px;align-items:center}.hero h1{font:700 clamp(48px,7vw,89px)/.92 Georgia,serif;letter-spacing:-.065em;margin:18px 0 24px;max-width:760px}.hero h1 em{font-style:normal;color:var(--violet)}.hero p{max-width:570px;color:var(--muted);font-size:18px;line-height:1.55;margin:0 0 28px}.action-row{display:flex;gap:12px;flex-wrap:wrap}.art-card{min-height:420px;border-radius:30px;overflow:hidden;padding:24px;position:relative;background:radial-gradient(circle at 82% 19%,#ffd466 0 8%,transparent 8.5%),radial-gradient(circle at 30% 74%,#ffaeb9 0 11%,transparent 11.5%),linear-gradient(135deg,#7658f9,#291b57);box-shadow:var(--shadow)}.art-card:before,.art-card:after{content:"";position:absolute;border:2px solid rgba(255,255,255,.75);border-radius:48% 52% 36% 64% / 63% 37% 63% 37%;mix-blend-mode:screen}.art-card:before{width:220px;height:290px;left:80px;top:85px;transform:rotate(25deg)}.art-card:after{width:180px;height:260px;right:22px;bottom:18px;transform:rotate(-20deg)}.art-label{position:absolute;z-index:1;bottom:24px;left:24px;background:#fff;padding:12px 14px;border-radius:12px;font-size:13px;font-weight:800}.art-label small{display:block;color:var(--muted);font-weight:500;margin-top:3px}.section{padding:54px 0}.section-head{display:flex;align-items:end;justify-content:space-between;gap:20px;margin-bottom:24px}.section h2{font:700 clamp(31px,4vw,48px)/.98 Georgia,serif;letter-spacing:-.055em;margin:0}.section-head p{color:var(--muted);margin:9px 0 0;max-width:530px;line-height:1.5}.link{border:0;background:transparent;color:var(--violet);font-weight:800;white-space:nowrap}.stats{display:grid;grid-template-columns:repeat(3,1fr);gap:1px;background:var(--line);border:1px solid var(--line);border-radius:20px;overflow:hidden}.stat{background:#fff;padding:24px}.stat strong{display:block;font:700 39px/1 Georgia,serif;letter-spacing:-.05em}.stat span{display:block;color:var(--muted);font-size:13px;margin-top:7px}.feature-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:18px}.feature{border:1px solid var(--line);border-radius:20px;padding:25px;min-height:210px;background:#fff}.feature b{display:block;width:38px;height:38px;border-radius:12px;padding:8px;text-align:center;background:var(--lav);color:var(--violet);margin-bottom:34px}.feature:nth-child(2) b{background:#ffe2c7;color:#dd6928}.feature:nth-child(3) b{background:#d9f8e9;color:#16885c}.feature h3{font-size:17px;margin:0 0 8px}.feature p{color:var(--muted);font-size:14px;line-height:1.5;margin:0}
    .view{display:none;min-height:62vh}.view.active{display:block}.toolbar{display:flex;gap:10px;flex-wrap:wrap;margin:30px 0 22px}.search{flex:1;min-width:220px;border:1px solid var(--line);background:#fff;border-radius:12px;padding:13px 14px;outline:none}.search:focus{border-color:var(--violet);box-shadow:0 0 0 3px rgba(109,70,247,.12)}.filter{border:1px solid var(--line);background:#fff;border-radius:12px;padding:10px 13px;color:var(--muted)}.creator-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:18px}.creator-card{background:#fff;border:1px solid var(--line);border-radius:20px;padding:18px;transition:transform .2s,box-shadow .2s}.creator-card:hover{transform:translateY(-4px);box-shadow:var(--shadow)}.avatar{width:52px;height:52px;border-radius:17px;display:grid;place-items:center;font:700 22px Georgia,serif;color:#fff;background:linear-gradient(135deg,#6844ef,#ff8dae)}.creator-top{display:flex;justify-content:space-between;gap:12px;align-items:start}.rating{font-size:12px;font-weight:800;background:#fff6d9;padding:6px 8px;border-radius:8px}.creator-card h3{font-size:17px;margin:16px 0 5px}.headline{font-size:13px;color:var(--violet);font-weight:700;margin:0 0 12px}.bio{font-size:13px;line-height:1.5;color:var(--muted);min-height:59px}.chips{display:flex;flex-wrap:wrap;gap:6px;margin:14px 0}.chip{font-size:11px;font-weight:700;padding:6px 8px;border-radius:999px;background:#f0edff;color:#4f39bc}.chip:nth-child(2n){background:#fff0e5;color:#bb5a20}.card-foot{border-top:1px solid var(--line);padding-top:13px;display:flex;align-items:center;justify-content:space-between;font-size:12px;color:var(--muted)}.card-foot strong{font-size:13px;color:var(--ink)}.text-button{border:0;background:transparent;color:var(--violet);font-weight:800;padding:0}.brief-list{display:grid;grid-template-columns:repeat(2,1fr);gap:18px}.brief{border:1px solid var(--line);background:#fff;border-radius:20px;padding:23px}.brief-top{display:flex;justify-content:space-between;align-items:center;color:var(--muted);font-size:12px}.brief h3{font-size:21px;line-height:1.15;margin:15px 0 9px;letter-spacing:-.03em}.brief p{font-size:14px;line-height:1.5;color:var(--muted);margin:0}.brief-meta{display:flex;justify-content:space-between;gap:8px;border-top:1px solid var(--line);padding-top:15px;margin-top:17px;color:var(--muted);font-size:13px}.brief-meta strong{color:var(--ink)}.empty{border:1px dashed var(--line);border-radius:18px;padding:40px;text-align:center;color:var(--muted);grid-column:1/-1}.dashboard{display:grid;grid-template-columns:1fr 1.65fr;gap:22px;margin-top:30px}.panel{border:1px solid var(--line);border-radius:20px;background:#fff;padding:22px}.panel h3{margin:0 0 16px;font-size:16px}.match-row{display:flex;gap:12px;align-items:center;padding:13px 0;border-bottom:1px solid var(--line)}.match-row:last-child{border-bottom:0}.match-score{margin-left:auto;font-size:12px;font-weight:900;color:#3e2aab;background:var(--lav);padding:6px 8px;border-radius:8px}.notice{border-radius:15px;background:#f2efff;padding:17px;font-size:13px;line-height:1.5;color:#493c85}.notice b{display:block;color:var(--ink);margin-bottom:4px}
    .modal{position:fixed;inset:0;z-index:10;background:rgba(20,12,27,.5);display:none;align-items:center;justify-content:center;padding:22px;backdrop-filter:blur(4px)}.modal.open{display:flex}.modal-box{max-height:min(720px,92vh);overflow:auto;width:min(700px,100%);background:var(--paper);border-radius:25px;padding:26px;position:relative;box-shadow:0 28px 80px rgba(0,0,0,.25)}.close{border:0;background:#eee8f3;float:right;width:34px;height:34px;border-radius:50%;font-size:20px}.modal-box h2{font:700 38px/.95 Georgia,serif;letter-spacing:-.05em;margin:7px 0 12px}.modal-intro{color:var(--muted);line-height:1.5;margin:0 0 20px}.portfolio{display:grid;grid-template-columns:repeat(2,1fr);gap:12px;margin:20px 0}.work{min-height:140px;padding:14px;border-radius:15px;color:white;display:flex;flex-direction:column;justify-content:end;box-shadow:inset 0 -65px 50px rgba(0,0,0,.18)}.work small{opacity:.78;font-weight:700}.work b{font-size:18px;margin-top:3px}.form-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}.field{display:grid;gap:6px;margin-bottom:13px}.field label{font-weight:800;font-size:12px}.field input,.field textarea{border:1px solid var(--line);border-radius:11px;background:#fff;padding:11px 12px;outline:none}.field textarea{resize:vertical;min-height:105px}.field input:focus,.field textarea:focus{border-color:var(--violet)}.field.full{grid-column:1/-1}.feedback{min-height:22px;color:#c04055;font-size:13px;margin-top:11px}.success{color:#18845c}.footer{padding:45px 0 55px;color:var(--muted);font-size:13px;display:flex;justify-content:space-between;gap:15px}.footer b{color:var(--ink)}
    @media(max-width:800px){.nav{display:none}.hero{grid-template-columns:1fr;padding-top:42px}.art-card{min-height:280px}.creator-grid{grid-template-columns:repeat(2,1fr)}.feature-grid{grid-template-columns:1fr}.dashboard{grid-template-columns:1fr}}@media(max-width:530px){.shell{padding:0 16px}.hero h1{font-size:50px}.creator-grid,.brief-list,.form-grid{grid-template-columns:1fr}.stats{grid-template-columns:1fr}.footer{flex-direction:column}.art-card{display:none}.section{padding:35px 0}}
  </style>
</head>
<body>
  <header class="shell topbar"><a href="#" class="brand" onclick="go('home');return false">luma<i></i></a><nav class="nav"><button onclick="go('creators')">Find creators</button><button onclick="go('briefs')">Browse briefs</button><button onclick="go('dashboard')">Dashboard</button></nav><button class="pill" onclick="openBriefForm()">Post a brief</button></header>
  <main class="shell">
    <section id="home" class="view active">
      <div class="hero"><div><span class="eyebrow"><span class="dot"></span> The AI-native creative network</span><h1>Find the <em>unusual</em> minds behind the next thing.</h1><p>Luma connects ambitious brands and agencies with AI creators who turn new tools into culture-shaping work.</p><div class="action-row"><button class="button" onclick="go('creators')">Explore creators</button><button class="button alt" onclick="openBriefForm()">Create a brief</button></div></div><div class="art-card"><div class="art-label">Featured work <small>Chrome Mirage — Maya Chen</small></div></div></div>
      <div class="stats"><div class="stat"><strong id="stat-creators">—</strong><span>vetted AI creators</span></div><div class="stat"><strong id="stat-briefs">—</strong><span>live opportunities</span></div><div class="stat"><strong>34</strong><span>countries represented</span></div></div>
      <section class="section"><div class="section-head"><div><h2>A better way to make <i>what's next.</i></h2><p>Built for the messy, exciting point where emerging tools, exceptional taste and a real brief meet.</p></div></div><div class="feature-grid"><article class="feature"><b>01</b><h3>Portfolios with proof</h3><p>See the thinking, tools and finished work—not just a feed of pretty experiments.</p></article><article class="feature"><b>02</b><h3>Matching with context</h3><p>Briefs are paired with relevant skill, creative fit, availability and budget.</p></article><article class="feature"><b>03</b><h3>Better engagements</h3><p>Bring discovery, shortlisting and project conversations into one clear workflow.</p></article></div></section>
    </section>
    <section id="creators" class="view"><div class="section" style="padding-top:48px"><div class="section-head"><div><h2>Meet the makers.</h2><p>Independent creators building with AI, selected for originality and execution.</p></div></div><div class="toolbar"><input id="creator-search" class="search" placeholder="Search skills, tools, formats or locations" oninput="loadCreators()"><select id="creator-skill" class="filter" onchange="loadCreators()"><option value="">All specialties</option><option>Brand Films</option><option>Fashion</option><option>Social</option><option>Product Video</option><option>Audio</option><option>Games</option></select></div><div id="creator-grid" class="creator-grid"></div></div></section>
    <section id="briefs" class="view"><div class="section" style="padding-top:48px"><div class="section-head"><div><h2>Good briefs attract great work.</h2><button class="button" onclick="openBriefForm()">Post a brief</button></div><div id="brief-list" class="brief-list"></div></div></section>
    <section id="dashboard" class="view"><div class="section" style="padding-top:48px"><div class="section-head"><div><h2>Your creative pipeline.</h2><p>Demo brand dashboard. Choose a live brief to see explainable creator matches.</p></div></div><div class="dashboard"><aside><div class="panel"><h3>Marketplace snapshot</h3><div class="stat" style="padding:12px 0"><strong id="dash-creators">—</strong><span>available creators</span></div><div class="stat" style="padding:12px 0"><strong id="dash-briefs">—</strong><span>open briefs</span></div><div class="stat" style="padding:12px 0"><strong id="dash-apps">—</strong><span>applications</span></div></div><div class="notice" style="margin-top:18px"><b>How matching works</b>Skills shared by a creator and brief carry the most weight. Budget fit and marketplace rating add a small boost. It is transparent—not a black box.</div></aside><div class="panel"><h3>Best matches for <select id="brief-picker" class="filter" onchange="loadMatches()"></select></h3><div id="matches"></div></div></div></div></section>
  </main>
  <footer class="shell footer"><span><b>luma.</b> AI-native creator marketplace</span><span>Demo MVP · Local SQLite database</span></footer>
  <div class="modal" id="modal" onclick="if(event.target===this)closeModal()"><div class="modal-box" id="modal-box"></div></div>
  <script>
    var state={creators:[],briefs:[]};
    function esc(value){return String(value==null?'':value).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]})}
    function initials(name){return name.split(' ').map(function(x){return x[0]}).join('').slice(0,2)}
    function money(n){return new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(n)}
    async function request(url,opts){var r=await fetch(url,opts);var data=await r.json();if(!r.ok)throw new Error(data.error||'Something went wrong.');return data}
    function go(id){document.querySelectorAll('.view').forEach(function(v){v.classList.remove('active')});document.getElementById(id).classList.add('active');window.scrollTo({top:0,behavior:'smooth'});if(id==='creators')loadCreators();if(id==='briefs')loadBriefs();if(id==='dashboard')loadDashboard()}
    function chips(items){return items.slice(0,4).map(function(x){return '<span class="chip">'+esc(x)+'</span>'}).join('')}
    async function loadCreators(){var q=document.getElementById('creator-search').value;var skill=document.getElementById('creator-skill').value;var data=await request('/api/creators?search='+encodeURIComponent(q)+'&skill='+encodeURIComponent(skill));state.creators=data.creators;var box=document.getElementById('creator-grid');if(!data.creators.length){box.innerHTML='<div class="empty">No creators match that search. Try a broader skill or tool.</div>';return}box.innerHTML=data.creators.map(function(c){return '<article class="creator-card"><div class="creator-top"><div class="avatar">'+initials(c.display_name)+'</div><span class="rating">★ '+c.rating+'</span></div><h3>'+esc(c.display_name)+'</h3><p class="headline">'+esc(c.headline)+'</p><p class="bio">'+esc(c.bio)+'</p><div class="chips">'+chips(c.tags)+'</div><div class="card-foot"><span>from <strong>'+money(c.rate_min)+'</strong></span><button class="text-button" onclick="showCreator('+c.user_id+')">View profile →</button></div></article>'}).join('')}
    async function showCreator(id){var data=await request('/api/creators/'+id);var c=data.creator;var work=data.portfolio.map(function(p){return '<div class="work" style="background:'+esc(p.cover_gradient)+'"><small>'+esc(p.format)+'</small><b>'+esc(p.title)+'</b></div>'}).join('');document.getElementById('modal-box').innerHTML='<button class="close" onclick="closeModal()">×</button><div class="avatar" style="width:60px;height:60px">'+initials(c.display_name)+'</div><h2>'+esc(c.display_name)+'</h2><p class="headline">'+esc(c.headline)+' · '+esc(c.location)+'</p><p class="modal-intro">'+esc(c.bio)+'</p><div class="chips">'+chips(c.tools)+'</div><div class="notice"><b>'+esc(c.availability)+'</b>'+money(c.rate_min)+'–'+money(c.rate_max)+' project range · '+c.completed_projects+' completed marketplace projects</div><h3 style="margin:23px 0 9px">Selected work</h3><div class="portfolio">'+work+'</div><button class="button" onclick="closeModal();go(\'briefs\')">See open briefs</button>';openModal()}
    async function loadBriefs(){var data=await request('/api/briefs');state.briefs=data.briefs;var box=document.getElementById('brief-list');if(!data.briefs.length){box.innerHTML='<div class="empty">No live briefs yet. Be the first to post one.</div>';return}box.innerHTML=data.briefs.map(function(b){return '<article class="brief"><div class="brief-top"><span>'+esc(b.company)+'</span><span>Open brief</span></div><h3>'+esc(b.title)+'</h3><p>'+esc(b.description)+'</p><div class="chips">'+chips(b.tags)+'</div><div class="brief-meta"><span><strong>'+money(b.budget_min)+'–'+money(b.budget_max)+'</strong><br>project budget</span><span>Due <strong>'+esc(b.deadline)+'</strong><br><button class="text-button" onclick="apply('+b.id+')">Apply →</button></span></div></article>'}).join('')}
    async function loadDashboard(){var data=await request('/api/dashboard');state.briefs=data.briefs;document.getElementById('dash-creators').textContent=data.stats.creators;document.getElementById('dash-briefs').textContent=data.stats.openBriefs;document.getElementById('dash-apps').textContent=data.stats.applications;var select=document.getElementById('brief-picker');select.innerHTML=data.briefs.map(function(b){return '<option value="'+b.id+'">'+esc(b.title)+'</option>'}).join('');if(data.briefs.length)loadMatches()}
    async function loadMatches(){var id=document.getElementById('brief-picker').value;if(!id)return;var data=await request('/api/matches?briefId='+id);var box=document.getElementById('matches');box.innerHTML=data.matches.slice(0,5).map(function(m){var c=m.creator;return '<div class="match-row"><div class="avatar" style="width:42px;height:42px;border-radius:13px;font-size:16px">'+initials(c.display_name)+'</div><div><b>'+esc(c.display_name)+'</b><div style="font-size:12px;color:#6d6672;margin-top:3px">'+(m.matched.length?esc(m.matched.join(' · ')): 'Strong available creator')+'</div></div><span class="match-score">'+m.value+'% fit</span><button class="text-button" onclick="showCreator('+c.user_id+')">View</button></div>'}).join('')}
    function openModal(){document.getElementById('modal').classList.add('open')}function closeModal(){document.getElementById('modal').classList.remove('open')}
    function openBriefForm(){document.getElementById('modal-box').innerHTML='<button class="close" onclick="closeModal()">×</button><h2>Start with a good brief.</h2><p class="modal-intro">Tell creators what you are making, why it matters and what a successful outcome looks like.</p><form onsubmit="submitBrief(event)"><div class="form-grid"><div class="field"><label>Company</label><input name="company" value="Northstar Audio" required></div><div class="field"><label>Project title</label><input name="title" placeholder="e.g. Launch film for…" required></div><div class="field full"><label>What do you need?</label><textarea name="description" placeholder="Scope, intended audience, creative direction and deliverables…" required></textarea></div><div class="field"><label>Minimum budget (USD)</label><input name="budget_min" type="number" min="1" placeholder="2500" required></div><div class="field"><label>Maximum budget (USD)</label><input name="budget_max" type="number" min="1" placeholder="5000" required></div><div class="field"><label>Deadline</label><input name="deadline" type="date" required></div><div class="field"><label>Skills (comma-separated)</label><input name="tags" placeholder="Brand Films, Runway"></div></div><button class="button" type="submit">Publish brief</button><div class="feedback" id="form-feedback"></div></form>';openModal()}
    async function submitBrief(event){event.preventDefault();var f=new FormData(event.target);var body={company:f.get('company'),title:f.get('title'),description:f.get('description'),budget_min:f.get('budget_min'),budget_max:f.get('budget_max'),deadline:f.get('deadline'),tags:String(f.get('tags')).split(',').map(function(x){return x.trim()}).filter(Boolean)};var out=document.getElementById('form-feedback');try{var data=await request('/api/briefs',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});out.textContent=data.message;out.className='feedback success';event.target.reset();setTimeout(function(){closeModal();go('dashboard')},900)}catch(err){out.textContent=err.message}}
    function apply(id){document.getElementById('modal-box').innerHTML='<button class="close" onclick="closeModal()">×</button><h2>Make your case.</h2><p class="modal-intro">This demo submits an application from Maya Chen. In production, it would use the signed-in creator account.</p><form onsubmit="submitApplication(event,'+id+')"><div class="field"><label>Short note to the brand</label><textarea name="message" required>I love the tension in this brief. I would explore how sound becomes a tactile visual language, then build a flexible launch system around it.</textarea></div><button class="button" type="submit">Send application</button><div class="feedback" id="apply-feedback"></div></form>';openModal()}
    async function submitApplication(event,id){event.preventDefault();var out=document.getElementById('apply-feedback');try{var message=new FormData(event.target).get('message');var data=await request('/api/applications',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({brief_id:id,creator_id:1,message:message})});out.textContent=data.message;out.className='feedback success'}catch(err){out.textContent=err.message}}
    async function boot(){try{var data=await request('/api/dashboard');document.getElementById('stat-creators').textContent=data.stats.creators+'+';document.getElementById('stat-briefs').textContent=data.stats.openBriefs}catch(e){console.error(e)}}boot();
  </script>
</body>
</html>`;

initDatabase();
const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
    if (url.pathname.startsWith("/api/")) {
      const handled = await api(req, res, url);
      if (handled === false) send(res, 404, { error: "API route not found." });
      return;
    }
    if (req.method !== "GET") return send(res, 405, { error: "Method not allowed." });
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });
    res.end(page);
  } catch (error) {
    console.error(error);
    if (!res.headersSent) send(res, 500, { error: "Unexpected server error." });
    else res.end();
  }
});

server.listen(PORT, () => {
  console.log(`Luma is running at http://localhost:${PORT}`);
  console.log(`SQLite database: ${DB_PATH}`);
});
