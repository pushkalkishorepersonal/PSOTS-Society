import json
from datetime import datetime
from collections import defaultdict

def parse_date(date_val):
    if not date_val:
        return 0, 0
    try:
        if isinstance(date_val, (int, float)):
            dt = datetime.fromtimestamp(date_val)
        else:
            dt = datetime.fromisoformat(str(date_val).replace('Z','').split('+')[0])
        return dt.timestamp(), dt.year
    except:
        return 0, 0

def load_messages(filepath, group_name):
    with open(filepath, 'r', encoding='utf-8') as f:
        data = json.load(f)
    messages = []
    for m in data:
        if isinstance(m, dict) and m.get('message') and len(m.get('message','')) > 30:
            ts, year = parse_date(m.get('date'))
            messages.append({
                'text': m.get('message', ''),
                'from': m.get('user_display_name', 'Unknown'),
                'date': ts,
                'year': year,
                'group': group_name
            })
    return messages

pain_points = {
    '🚗 Parking': ['parking', 'park ', 'vehicle', 'visitor parking', 'basement'],
    '💧 Water': ['water', 'leakage', 'seepage', 'leak', 'water supply', 'tanker'],
    '⚡ Electricity': ['electricity', 'power cut', 'bescom', 'elmeasure', 'accl', 'generator'],
    '🔧 Maintenance': ['maintenance', 'repair', 'broken', 'not working', 'complaint', 'problem'],
    '🏗 Noise/Construction': ['construction', 'noise', 'renovation', 'civil work', 'drilling'],
    '🔒 Security': ['security', 'guard', 'gate', 'visitor', 'intercom', 'cctv', 'theft'],
    '🧹 Cleanliness': ['garbage', 'waste', 'cleaning', 'dirty', 'pest', 'cockroach', 'mosquito'],
    '📋 Property & Legal': ['khata', 'property tax', 'bbmp', 'registration', 'document', 'legal'],
    '🏊 Amenities': ['clubhouse', 'swimming', 'pool', 'gym', 'playground', 'tennis', 'badminton'],
    '🐕 Pets': ['dog', 'pet', 'cat', 'animal', 'bark', 'leash'],
    '🏛 Society Management': ['ec ', 'committee', 'management', 'ppms', 'association', 'rules', 'meeting'],
    '🌐 Internet': ['internet', 'wifi', 'broadband', 'jio', 'airtel', 'act ', 'connection'],
    '🚰 Gas & Utilities': ['gas', 'gail', 'lpg', 'cylinder', 'png'],
    '🏠 Flat Issues': ['ceiling', 'seepage', 'window', 'door', 'lift', 'elevator'],
}

print("Loading owners group (181k messages)...")
owners = load_messages('/Users/pushkalk/Desktop/owners_alltime.json', 'owners')
print(f"Loaded: {len(owners):,} messages")

print("Loading residents group (36k messages)...")
residents = load_messages('/Users/pushkalk/Desktop/residents_alltime.json', 'residents')
print(f"Loaded: {len(residents):,} messages")

all_messages = owners + residents
print(f"Total combined: {len(all_messages):,} messages\n")

owner_cats = defaultdict(int)
resident_cats = defaultdict(int)

for m in all_messages:
    text_lower = m['text'].lower()
    for category, keywords in pain_points.items():
        if any(kw in text_lower for kw in keywords):
            if m['group'] == 'owners':
                owner_cats[category] += 1
            else:
                resident_cats[category] += 1
            break

print(f"{'='*75}")
print("COMBINED PAIN POINT ANALYSIS — OWNERS + RESIDENTS (2018-2026)")
print(f"{'='*75}")
print(f"\n{'Category':<30} {'Owners':>10} {'Residents':>10} {'Total':>10} {'Priority'}")
print("-"*75)

combined = []
for cat in set(list(owner_cats.keys()) + list(resident_cats.keys())):
    o = owner_cats.get(cat, 0)
    r = resident_cats.get(cat, 0)
    combined.append((cat, o, r, o+r))

for cat, o, r, total in sorted(combined, key=lambda x: -x[3]):
    if o > 200 and r > 100:
        priority = "🔴 CRITICAL — Both groups"
    elif o > 200 or r > 100:
        priority = "🟡 HIGH"
    else:
        priority = "🟢 MEDIUM"
    print(f"{cat:<30} {o:>10,} {r:>10,} {total:>10,}  {priority}")

print(f"\n{'='*75}")
print("PLATFORM FEATURE MAPPING")
print(f"{'='*75}")
print("""
🔴 CRITICAL (Both groups) = Platform MUST solve
🟡 HIGH (One group heavily) = Platform SHOULD solve  
🟢 MEDIUM = FAQ entry
""")
