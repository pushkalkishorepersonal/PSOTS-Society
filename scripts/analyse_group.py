import json
import sys
from datetime import datetime, timezone
from collections import Counter, defaultdict

def parse_date(date_str):
    try:
        return datetime.fromisoformat(str(date_str)).replace(tzinfo=None)
    except:
        return None

def analyse(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        data = json.load(f)

    messages = []
    for m in data:
        if isinstance(m, dict) and m.get('message'):
            messages.append({
                'text': m.get('message', ''),
                'date': parse_date(m.get('date')),
                'from': m.get('user_display_name') or str(m.get('from_id', {}).get('user_id', 'Unknown')),
                'has_media': m.get('media') is not None
            })

    messages = [m for m in messages if m['date']]

    print(f"\n{'='*50}")
    print(f"PSOTS Foodies Analysis")
    print(f"{'='*50}")

    print(f"\n📊 BASIC STATS")
    print(f"Total messages: {len(messages)}")
    dates = [m['date'] for m in messages]
    print(f"Date range: {min(dates).strftime('%d %b %Y')} → {max(dates).strftime('%d %b %Y')}")
    days = (max(dates) - min(dates)).days or 1
    print(f"Posts per day (avg): {len(messages)/days:.1f}")
    print(f"Posts per week (avg): {len(messages)/days*7:.1f}")
    print(f"Posts per month (avg): {len(messages)/days*30:.1f}")

    print(f"\n👤 TOP POSTERS (potential vendors)")
    posters = Counter()
    for m in messages:
        posters[m['from']] += 1
    total = len(messages)
    for name, count in posters.most_common(20):
        pct = count/total*100
        print(f"  {name}: {count} posts ({pct:.1f}%)")

    print(f"\n⏰ PEAK HOURS (IST)")
    hours = Counter()
    for m in messages:
        hour = (m['date'].hour + 5) % 24  # UTC to IST approx
        hours[hour] += 1
    for hour in sorted(hours, key=hours.get, reverse=True)[:8]:
        bar = '█' * (hours[hour] * 20 // max(hours.values()))
        print(f"  {hour:02d}:00 — {hours[hour]:4d} posts {bar}")

    print(f"\n📅 PEAK DAYS")
    days_map = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun']
    weekdays = Counter()
    for m in messages:
        weekdays[m['date'].weekday()] += 1
    for day in sorted(weekdays, key=weekdays.get, reverse=True):
        bar = '█' * (weekdays[day] * 20 // max(weekdays.values()))
        print(f"  {days_map[day]} — {weekdays[day]:4d} posts {bar}")

    print(f"\n💰 PRICE MENTIONS")
    price_posts = [m for m in messages if
                   any(x in str(m['text']).lower() for x in ['₹','rs.','@rs','/rs','/-'])]
    print(f"  Posts with price: {len(price_posts)} ({len(price_posts)/len(messages)*100:.1f}%)")

    print(f"\n🖼 MEDIA POSTS")
    media_posts = [m for m in messages if m['has_media']]
    print(f"  Posts with media: {len(media_posts)} ({len(media_posts)/len(messages)*100:.1f}%)")

    print(f"\n📈 MONTHLY ACTIVITY")
    monthly = defaultdict(int)
    for m in messages:
        monthly[m['date'].strftime('%Y-%m')] += 1
    for month in sorted(monthly):
        bar = '█' * (monthly[month] * 30 // max(monthly.values()))
        print(f"  {month}: {monthly[month]:4d} {bar}")

    print(f"\n🔢 SUMMARY")
    print(f"  Unique senders: {len(posters)}")
    top3 = sum(c for _,c in posters.most_common(3))
    top10 = sum(c for _,c in posters.most_common(10))
    print(f"  Top 3 senders: {top3/total*100:.1f}% of all messages")
    print(f"  Top 10 senders: {top10/total*100:.1f}% of all messages")
    print(f"\n{'='*50}\n")

if __name__ == '__main__':
    filepath = sys.argv[1] if len(sys.argv) > 1 else 'result.json'
    analyse(filepath)
