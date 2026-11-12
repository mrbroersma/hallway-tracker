// All state mutations use a compare-and-swap version check to prevent conflicting passes.
export function createApi(DB) {
const empty = {
  students: [],
  trips: [],
  rules: []
};
const json = (data, status = 200) => Response.json(data, {
  status,
  headers: {
    'Cache-Control': 'no-store'
  }
});
async function read() {
  return await DB.prepare('SELECT body, version FROM school_state WHERE id=1').first();
}
async function GET() {
  const row = await read();
  return json(row ? JSON.parse(row.body) : empty);
}
async function POST(req) {
  try {
    const a = await req.json();
    for (let attempt = 0; attempt < 5; attempt++) {
      const row = await read();
      const s = row ? JSON.parse(row.body) : structuredClone(empty);
      const clean = (x, n = 120) => typeof x === 'string' ? x.trim().slice(0, n) : '';
      if (a.type === 'students') {
        if (!Array.isArray(a.students) || !a.students.length || a.students.length > 500) return json({
          error: 'Enter between 1 and 500 students.'
        }, 400);
        for (const x of a.students) {
          const name = clean(x.name);
          if (!name) return json({
            error: 'Each student needs a name.'
          }, 400);
          s.students.push({
            id: crypto.randomUUID(),
            name,
            room: clean(x.room, 60)
          });
        }
      } else if (a.type === 'rule') {
        const members = [...new Set(Array.isArray(a.members) ? a.members : [])];
        if (!clean(a.name) || members.length < 2 || members.some(id => !s.students.some(x => x.id === id))) return json({
          error: 'Name the rule and choose at least two students.'
        }, 400);
        if (s.trips.filter(t => !t.back && members.includes(t.studentId)).length > 1) return json({
          error: 'These students are already out together. Check them in before creating this rule.'
        }, 409);
        s.rules.push({
          id: crypto.randomUUID(),
          name: clean(a.name),
          members
        });
      } else if (a.type === 'deleteRule') {
        s.rules = s.rules.filter(r => r.id !== a.id);
      } else if (a.type === 'out') {
        if (!s.students.some(x => x.id === a.studentId) || !['Restroom', 'Water', 'Office', 'Nurse', 'Counselor', 'Other'].includes(a.reason) || !clean(a.teacher) || !clean(a.room)) return json({
          error: 'Choose a student, reason, teacher, and classroom.'
        }, 400);
        if (s.trips.some(t => t.studentId === a.studentId && !t.back)) return json({
          error: 'This student is already in the hallway.'
        }, 409);
        for (const r of s.rules.filter(r => r.members.includes(a.studentId))) {
          const conflict = s.trips.find(t => !t.back && r.members.includes(t.studentId));
          if (conflict) return json({
            error: `Please wait — ${s.students.find(x => x.id === conflict.studentId)?.name} is already out. Try again when they return.`
          }, 409);
        }
        s.trips.push({
          id: crypto.randomUUID(),
          studentId: a.studentId,
          reason: a.reason,
          teacher: clean(a.teacher),
          room: clean(a.room, 60),
          out: Date.now(),
          back: null
        });
      } else if (a.type === 'back') {
        const t = s.trips.find(t => t.id === a.id);
        if (!t) return json({
          error: 'Pass not found.'
        }, 404);
        if (!t.back) t.back = Date.now();
      } else return json({
        error: 'Unknown action.'
      }, 400);
      const body = JSON.stringify(s);
      const result = row ? await DB.prepare('UPDATE school_state SET body=?, version=version+1 WHERE id=1 AND version=?').bind(body, row.version).run() : await DB.prepare('INSERT OR IGNORE INTO school_state (id,body,version) VALUES (1,?,0)').bind(body).run();
      if (result.meta.changes) return json(s);
    }
    return json({
      error: 'Another teacher updated the hallway. Please try again.'
    }, 409);
  } catch {
    return json({
      error: 'Could not save. Please retry; no pass has been confirmed.'
    }, 500);
  }
}
return {GET, POST};
}
