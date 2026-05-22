# PSOTS Telegram Moderation Bot - User Guide

## 📋 Overview

The **PSOTS Telegram Moderation Bot** is an intelligent automated moderation system designed to maintain group quality and enforce community guidelines in the PSOTS Telegram groups. The bot monitors messages, detects policy violations, and takes automatic actions while maintaining transparency and fairness.

**Status:** ✅ Fully Operational  
**Groups Covered:** PSOTS - पूर्वैया बयार  
**Last Updated:** April 8, 2026

---

## 👨‍💼 For Group Admins

### What is the Admin Dashboard?

The **Admin Dashboard** is a web-based control center where group administrators can:
- Monitor group activity and violation statistics
- Manage user violations and reset records
- Configure moderation keywords
- View audit logs of all deletions
- Manage other admins
- Configure violation thresholds and actions

**Access:** https://telegram.psots.in/admin  
**Authentication:** Google OAuth (secure, single sign-in)

---

### Admin Features

#### 1. **📊 Status Dashboard**
View real-time statistics:
- **Messages Scanned**: Total messages monitored by the bot
- **Violations (30 days)**: Total policy violations detected in the last month
- **Users Tracked**: Number of unique users with violations
- **Admins**: Number of active administrators

#### 2. **⚠️ Violations Management**
- View all users with violations
- See violation count per user
- Reset user violation count when appropriate
- Track violation history with timestamps

#### 3. **🔑 Keyword Configuration**
Manage the list of prohibited keywords across categories:
- **Buy/Sell Content**: Commercial messages, product sales, rentals
- **Political Content**: Political discussions, elections, parties
- **Religious Content**: Religious solicitation, fundraising
- **Spam**: Unsolicited promotions, referral schemes
- **Abusive Language**: Hindi and English profanities
- **Personal Attacks**: Insults, personal harassment
- **Society Fees**: Maintenance charges, dues (with exemptions)
- **Approved Events**: Chhath Puja, Diwali, etc. (always allowed)

**Example:** If "Buy/Sell" keywords include "buy", "sell", "rent", etc., messages containing these words will be flagged.

#### 4. **👥 Admin Management**
- Add new administrators by email
- Remove administrators
- Manage access control

#### 5. **⚙️ Action Settings**
Configure what happens at each violation level:
- **1st Violation**: Warning message sent via DM
- **2nd Violation**: 2nd warning message
- **3rd Violation**: Warning + Admin notified
- **5th Violation**: Further escalation
- **10th Violation**: Repeated violators flagged

#### 6. **📝 Audit Logs**
Complete record of:
- Messages deleted by the bot
- User who posted the message
- Violation type (category)
- Timestamp
- Original message text (for reference)

---

### Admin Privileges

**Admins are EXEMPT from moderation** because:
- Admins send official warnings and announcements
- Group management requires flexibility
- Admins need to discuss policies without restrictions
- Trust is placed in admin responsibility

**Important:** Admin status should only be given to trusted users who will use it responsibly.

---

### How to Use the Admin Dashboard

1. **Login**
   - Go to https://telegram.psots.in/admin
   - Click "Sign in with Google"
   - Use your email account registered as admin

2. **Monitor Activity**
   - Check Status tab for daily statistics
   - Review Violations tab to see active violators
   - Check Logs tab for deleted messages

3. **Reset Violations**
   - If a user has improved, reset their count to give them a fresh start
   - Document the reason for transparency

4. **Update Keywords**
   - Add new prohibited terms as needed
   - Remove keywords that are causing false positives
   - Changes take effect immediately

5. **Manage Team**
   - Add trusted members as admins
   - Only add those who understand the guidelines

---

## 👤 For Group Members (Regular Residents)

### How the Bot Works

The **PSOTS Bot** automatically monitors all messages in the group and:
1. ✅ **Scans** every message against community guidelines
2. 🚫 **Detects** policy violations (prohibited content)
3. 🗑️ **Removes** violating messages automatically
4. 📬 **Notifies** you via private Telegram message
5. 📊 **Tracks** your violation history for pattern detection

---

### What Gets Flagged?

Messages are automatically deleted if they contain:

**❌ Buy/Sell Content** - Commercial messages
- "I want to buy a car"
- "Selling old furniture, ₹500"
- "Rent a flat - contact me"

**❌ Political Discussions** - Political content
- "BJP vs Congress elections"
- "Vote for this candidate"
- Political party discussions

**❌ Religious Solicitation** - Religious fundraising
- "Temple donation drive"
- "Prayer meeting tomorrow"
- "Religious collection"

**❌ Spam** - Unsolicited promotions
- "Limited time offer! Click here!"
- "Earn money with this scheme"
- "Refer a friend and earn"

**❌ Abusive Language** - Profanities
- Hindi or English abuse/slurs
- Insults or personal attacks
- Disrespectful language

**✅ Approved Content** - Always Allowed
- Chhath Puja discussions
- Diwali, Holi, Eid, etc.
- Cultural celebrations
- Administrative announcements from admins

**✅ Normal Conversation** - Always Allowed
- Friendly chatter
- Group discussions
- Sharing information
- Administrative matters

---

### What Happens When You Violate?

#### **1st Violation**
- ✂️ Your message is deleted
- 📬 You receive a DM:
  ```
  Hi [Name], your message was removed for: Buy/Sell Content. 
  Please follow group guidelines. 🙏
  
  View your violations
  ```
- 📊 Your violation count: 1

#### **2nd Violation**
- ✂️ Your message is deleted
- 📬 You receive a DM:
  ```
  Hi [Name], this is your 2nd warning for Buy/Sell Content. 
  Please be careful. 🙏
  
  View your violations
  ```
- 📊 Your violation count: 2

#### **3rd+ Violations**
- ✂️ Your message is deleted
- 📬 You receive a notification
- 🔔 Admin is notified about you
- 📊 Your violation is tracked
- ⚠️ You may face further action

---

### View Your Violation History

**Click the link in the bot's DM:** https://telegram.psots.in/user?id=[YOUR_USER_ID]

This page shows:
- ✅ **Total Violations**: Count of all violations
- 📅 **Violation History**: Each violation with date and type
- 📝 **Appeal Option**: If you believe a violation was unfair

**Example:**
```
Your Violations - PSOTS Group (Last 30 Days)

Total Violations: 2

Violation History:
- Buy/Sell Content (4/8/2026)
- Buy/Sell Content (4/7/2026)
```

---

### Appealing a Violation

If you believe a violation was:
- **Misidentified** (the message wasn't actually a violation)
- **Unfair** (special circumstances)
- **Incorrect** (wrong detection)

**How to Appeal:**
1. Click the link in the bot's DM to view your violations
2. Click "Appeal Violation" button
3. Explain why the violation should be removed
4. Admin will review within 24 hours

**Admins will consider:**
- ✅ Context of the message
- ✅ Whether it was truly a violation
- ✅ Your overall behavior
- ✅ Pattern (is this your first mistake?)

---

### Tips to Stay Violation-Free

1. **Avoid Commercial Posts**
   - Don't post for-sale or rental ads
   - Use marketplace apps instead

2. **Keep Politics Out**
   - Avoid political discussions
   - Focus on group topics

3. **No Spam**
   - Don't post promotional links
   - Don't share "earn money" schemes

4. **Be Respectful**
   - Use appropriate language
   - No insults or abuse
   - Maintain group decorum

5. **Ask Admins**
   - If unsure about content, ask
   - Better to clarify than violate

---

## 🔄 System Architecture

### How Messages Flow

```
User sends message in group
          ↓
Bot receives via webhook
          ↓
Scan against keywords
          ↓
Match found? 
    ↙           ↘
  YES             NO
   ↓               ↓
Delete         Allow
message        message
   ↓               ↓
Track         No action
violation
   ↓
Send DM
warning
   ↓
Update
statistics
```

### Data Storage

- **Violations**: Securely stored for 30 days (then auto-deleted)
- **Audit Logs**: Complete deletion records
- **User History**: Individual violation tracking
- **Bot Token**: Encrypted, never exposed

---

## 📞 Support & Issues

### If Your Message Was Deleted

1. **Review the DM** from the bot - it explains why
2. **Check your violations** at the link provided
3. **Appeal** if you think it's wrong
4. **Ask an admin** in private if unsure

### If You Have Questions

- **Message an Admin** directly
- **Use /help** in the group
- **Email** the admin team

### Known Limitations

- Bot can only delete messages if it has admin permissions
- Bot cannot undo message deletions (but admins can verify via logs)
- Violation history resets after 30 days of no violations
- Appeals are reviewed manually by admins

---

## 📈 Statistics (Current)

**As of April 8, 2026:**
- ✅ **Bot Status**: Operational
- ✅ **Messages Scanned**: 1000+
- ✅ **Violations Detected**: 50+
- ✅ **Users Tracked**: 10+
- ✅ **Admins**: 1+
- ✅ **Uptime**: 99.9%

---

## 🎯 Guidelines Summary

| Category | What's OK | What's NOT OK |
|----------|-----------|---------------|
| **Sales** | Sharing marketplace links | "Buy my car for ₹500" |
| **Politics** | Historical context | "Vote for BJP" |
| **Religion** | Cultural celebrations | "Temple fundraiser" |
| **Promotions** | Group announcements | "Earn money fast!" |
| **Language** | Friendly banter | Profanity/insults |
| **Admin Posts** | Any message (admin exempt) | N/A |

---

## ⚖️ Fairness & Transparency

### Bot Design Principles

✅ **Transparent**: All actions logged and viewable  
✅ **Fair**: Same rules apply to everyone (except admins)  
✅ **Appealable**: Users can contest violations  
✅ **Predictable**: Clear guidelines and thresholds  
✅ **Recorded**: Complete audit trail maintained  

### Privacy

- Bot only stores violation data (not messages)
- Violation history is private to you
- Only admins can see full logs
- Data deleted after 30 days

---

## 📅 Updates & Changes

**System is live and operational.**

**Planned future features:**
- Multi-language support
- Custom violation thresholds per category
- Advanced reporting dashboard
- Integration with other platforms

---

**Last Updated:** April 8, 2026  
**Bot Version:** v2  
**Questions?** Contact an admin in the group

---

*Thank you for helping keep PSOTS a great community! 🙏*
