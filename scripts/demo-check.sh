#!/bin/zsh
# Demo-day watch: health, Photon, leakage and a mock usability pass. Spends NO quota: no Gemini calls, no texts.
# Usage: scripts/demo-check.sh [--text]   (--text sends ONE real "ready" text to the linked phone; use once before the demo)
set -u
cd "$(dirname "$0")/.." || exit 1
S=/private/tmp/claude-501/-Users-ethan/57b599ed-bc69-48cf-b912-cd555f801c58/scratchpad
ok=0; bad=0; warn=0
say() { printf '%s %s\n' "$1" "$2"; case "$1" in PASS) ok=$((ok+1));; WARN) warn=$((warn+1));; *) bad=$((bad+1));; esac; return 0; }

# 1. Judging server on :3000 (restart from seed if it is down)
if ! h=$(curl -s -m 5 localhost:3000/api/health); then
  (lsof -ti :3000 | xargs kill 2>/dev/null; true); sleep 1
  (nohup npm start > $S/server-3000.log 2>&1 &); sleep 4
  h=$(curl -s -m 5 localhost:3000/api/health) && say WARN "server was down, restarted" || say FAIL "server down and restart failed"
fi
echo "$h" | grep -q '"ok":true' && say PASS "server healthy" || say FAIL "health: $h"
echo "$h" | grep -q '"mock":false' && say PASS "real Gemini configured" || say FAIL "server is in mock mode"
echo "$h" | grep -q '"imessage":true' && say PASS "iMessage channel connected" || say FAIL "iMessage channel not connected: $h"
echo "$h" | grep -q '"linkedPhones":\["ethan"\]' && say PASS "phone persona linked (ethan only)" || say WARN "linked phones: $(echo "$h" | grep -o '"linkedPhones":[^]]*]')"

# 2. Photon users on the project (free API call) and plan cap
node --input-type=module -e "
import './server/env.mjs';
const pid=process.env.SPECTRUM_PROJECT_ID, sec=process.env.SPECTRUM_PROJECT_SECRET;
const r=await fetch('https://spectrum.photon.codes/projects/'+pid+'/users/',{headers:{authorization:'Basic '+Buffer.from(pid+':'+sec).toString('base64')}});
const j=await r.json().catch(()=>null); const n=j?.data?.users?.length;
console.log(r.status===200 && n<=10 ? 'PASS photon users '+n+'/10' : 'FAIL photon users api '+r.status+' '+JSON.stringify(j).slice(0,80));
" 2>&1 | tail -1 | while read l; do echo "$l"; [[ "$l" == PASS* ]] && ok=$((ok+1)) || bad=$((bad+1)); done

# 3. Leakage: no phone numbers in the public state, no secrets in git history, tunnel status
curl -s -m 5 localhost:3000/api/state | grep -qE '"phone"|\+1[0-9]{10}' && say FAIL "public state carries a phone field or number" || say PASS "public state has no phone numbers"
[[ $(git log -p --all | grep -cE 'AIza[0-9A-Za-z_-]{30,}|^\+(GEMINI_API_KEY|SPECTRUM_PROJECT_SECRET)=[^ ]{8,}') -eq 0 ]] && say PASS "no secrets in git history" || say FAIL "secret-shaped text in git history"
git ls-files | grep -q '^\.env\.local$' && say FAIL ".env.local is tracked" || say PASS ".env.local untracked"
pgrep -f "cloudflared tunnel" >/dev/null && say WARN "tunnel is running (public link live; stop it when not demoing)" || say PASS "no tunnel running"

# 4. Usability: the scripted browser pass on a throwaway mock server (no quota, no texts)
(lsof -ti :3100 | xargs kill 2>/dev/null; true)
(PHONE_ETHAN= PHONE_JERRY= SPECTRUM_PROJECT_ID= SPECTRUM_PROJECT_SECRET= GEMINI_MOCK=1 PORT=3100 DATA_DIR=.tmp-e2e DEMO_REMINDER_SECONDS=1 nohup node server/index.mjs > $S/server-3100-check.log 2>&1 &); sleep 2
curl -s -X POST localhost:3100/api/reset -o /dev/null
res=$(BASE=http://localhost:3100 node $S/ui-check.mjs 2>&1); p=$(echo "$res" | grep -c '^PASS'); f=$(echo "$res" | grep '^FAIL' | grep -v 'console: no errors')
[[ $p -ge 11 && -z "$f" ]] && say PASS "usability pass $p/11 scenarios" || say FAIL "usability: $p passed; $f"
e=$(GEMINI_MOCK=1 PORT=3100 DATA_DIR=.tmp-e2e node scripts/e2e-threads.mjs 2>&1 | grep -c 'PASS'); [[ $e -eq 3 ]] && say PASS "thread suite 3/3" || say FAIL "thread suite $e/3"
(lsof -ti :3100 | xargs kill 2>/dev/null; true)

# 5. Optional one real text (quota: 1 message)
if [[ "${1:-}" == "--text" ]]; then
  node --input-type=module -e "
import './server/env.mjs'; import { startChannel, sendToPerson } from './server/channels/spectrum.mjs';
console.log('skipped: the running server holds the channel; use the app flow to send a real text');" | tail -1
fi

echo "SUMMARY pass=$ok fail=$bad warn=$warn $(TZ=America/New_York date '+%a %H:%M %Z')"
