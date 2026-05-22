import json
import sys
import re
from collections import defaultdict

def extract(filepath, group_type):
    with open(filepath, 'r', encoding='utf-8') as f:
        data = json.load(f)

    messages = []
    for m in data:
        if isinstance(m, dict) and m.get('message'):
            messages.append({
                'text': m.get('message', ''),
                'from': m.get('user_display_name', 'Unknown'),
                'date': m.get('date', ''),
                'has_media': m.get('media') is not None
            })

    print(f"\n{'='*60}")
    print(f"EXTRACTED DATA — {group_type.upper()}")
    print(f"{'='*60}\n")

    if group_type == 'carpooling':
        extract_carpooling(messages)
    elif group_type == 'hire':
        extract_hire(messages)
    elif group_type == 'diy':
        extract_diy(messages)

def extract_carpooling(messages):
    print("🚗 CARPOOLING OFFERS & REQUESTS\n")
    for m in messages:
        text = m['text']
        if len(text) < 10:
            continue
        print(f"FROM: {m['from']}")
        print(f"DATE: {m['date'][:10] if m['date'] else 'Unknown'}")
        print(f"MSG:  {text[:300]}")
        print("-" * 50)

def extract_hire(messages):
    print("🔧 HIRE SERVICES — CONTACT CARDS\n")
    vendors = defaultdict(list)
    for m in messages:
        text = m['text']
        if len(text) < 10:
            continue
        vendors[m['from']].append(text)
    
    for vendor, posts in vendors.items():
        print(f"\n👤 VENDOR: {vendor}")
        print(f"   Posts: {len(posts)}")
        for post in posts[:3]:
            print(f"   → {post[:200]}")
        print("-" * 50)

def extract_diy(messages):
    print("🔨 DIY TIPS — BLOG CONTENT\n")
    for m in messages:
        text = m['text']
        if len(text) < 20:
            continue
        print(f"\n👤 BY: {m['from']}")
        print(f"📅 DATE: {m['date'][:10] if m['date'] else 'Unknown'}")
        print(f"💡 TIP:\n{text[:500]}")
        print("-" * 50)

if __name__ == '__main__':
    filepath = sys.argv[1]
    group_type = sys.argv[2]
    extract(filepath, group_type)
