# PSOTS Admin Dashboard Guide

## 🎛️ Administrator Control Panel

**For Group Moderators and Admin Team**

---

## Quick Start

**Access URL:** https://telegram.psots.in/admin  
**Login:** Google OAuth (use your registered admin email)  
**Role:** Admin (Full control over moderation settings)

---

## Admin Dashboard Features

### 1. 📊 Status Dashboard

View real-time statistics at a glance:

- **Messages Scanned**: Total messages monitored today/this month
- **Violations (30 days)**: Total policy violations detected
- **Users Tracked**: How many users have violations
- **Admins**: Number of active administrators

**Use:** Monitor bot health and group activity trends.

---

### 2. ⚠️ Violations Management

**What you can do:**
- View all users with violations
- See violation count per user
- Reset user violation count (for improved behavior)
- Track violation history with exact timestamps

**When to use:**
- User requests a fresh start after improving
- Need to check repeat offenders
- Review patterns of misbehavior

**How to reset:**
1. Find the user in violations list
2. Click "Reset"
3. Confirm the action
4. User count goes back to 0

---

### 3. 🔑 Keyword Configuration

Manage prohibited content categories:

**Available Categories:**
- Buy/Sell Content
- Political Discussions
- Religious Solicitation
- Spam/Unsolicited Promotions
- Abusive Language (Hindi/English)
- Personal Attacks
- Society Fees
- Approved Events (always allowed)

**How to manage:**
1. Select category from dropdown
2. View current keywords
3. Add new keywords: Type keyword → Click "Add"
4. Remove keywords: Click "X" on any keyword

**Examples:**
- Buy/Sell: "buy", "sell", "rent", "₹500"
- Political: "bjp", "election", "vote"
- Spam: "limited offer", "earn money"

**Tips:**
- Changes take effect immediately
- Be specific to avoid false positives
- Review rejected keywords weekly

---

### 4. 👥 Admin Management

Add or remove administrators:

**How to add admin:**
1. Enter email address
2. Click "Add Admin"
3. They can now access dashboard

**How to remove admin:**
1. Find admin in list
2. Click "Remove"
3. They lose dashboard access

**Important:**
- Only add trusted users
- Admins are exempt from moderation
- Admins can see all audit logs

---

### 5. ⚙️ Action Settings

Configure what happens at each violation level:

**Violation Thresholds:**

| Count | Action | Message |
|-------|--------|---------|
| 1st | Warn | "Please follow guidelines" |
| 2nd | Warn | "This is your 2nd warning" |
| 3rd+ | Alert Admin | Admin gets notified |
| 5th | Critical Alert | "Repeat offender" |
| 10th | Extreme Alert | "Removal candidate" |

**How to customize:**
1. Go to Settings tab
2. Edit message for each threshold
3. Click "Save"
4. Verify changes saved

---

### 6. 📝 Audit Logs

Complete record of all moderation actions:

**View:**
- Message that was deleted
- User who posted it
- Reason (violation category)
- Exact timestamp
- Original message text (first 200 chars)

**Use for:**
- Reviewing admin decisions
- Tracking patterns
- Appeals verification
- Transparency documentation

**How to access:**
1. Click "Logs" tab
2. Scroll through recent deletions
3. Filter by username if needed
4. Use timestamps for cross-reference

---

## Admin Privileges & Responsibilities

### ✅ What Admins CAN Do:
- Send any message without restrictions
- Send announcements and guidelines
- Have discussions without flagging
- Modify moderation settings
- Reset user violation counts
- View all audit logs
- Manage other admins

### ⚠️ Admin Responsibilities:
- Use power responsibly
- Set example for group
- Review violations regularly
- Respond to appeals fairly
- Maintain group standards
- Document decisions
- Keep passwords secure

---

## Telegram ID Registration

Get direct notifications when violations occur:

**Setup:**
1. Go to Admin Panel → Admins tab
2. Click "Register Telegram ID"
3. Enter your Telegram username (without @)
4. Click "Save"

**Benefits:**
- Get DM alerts for violations
- Immediate notifications
- No need to check dashboard
- Direct user communication

**Alerts at:**
- 3rd violation
- 5th violation (critical)
- 10th violation (extreme)

---

## Escalation System

### Alert Levels:

**🟢 1st-2nd Violations**
- User gets DM warning
- No admin alert
- Record kept

**🟡 3rd Violation**
- User gets warning
- Admin gets alert
- Review needed

**🔴 5th Violation**
- CRITICAL ALERT to admin
- User flagged as repeat offender
- Consider action plan

**⛔ 10th Violation**
- EXTREME ALERT to admin
- Flagged as "Removal Candidate"
- **Admin makes final decision on removal**

**Important:** Bot only alerts. Admins decide if removal is warranted based on:
- Overall behavior patterns
- Whether user is improving
- Severity of violations
- Whether deserving of another chance

---

## Best Practices

### Daily Checks:
✅ Review Status dashboard  
✅ Check for critical alerts  
✅ Review new violations  
✅ Process appeals if any  

### Weekly Tasks:
✅ Review keyword effectiveness  
✅ Check for false positives  
✅ Update settings as needed  
✅ Analyze patterns  

### Monthly Review:
✅ Audit all deletions  
✅ Update documentation  
✅ Review admin team  
✅ Plan improvements  

---

## Common Admin Tasks

### Reset a User (User Improved)
1. Go to Violations tab
2. Find user
3. Click "Reset"
4. Send them encouraging message

### Add a Keyword
1. Go to Keywords tab
2. Select category
3. Type new keyword
4. Click "Add"

### Remove a False Positive
1. Check Logs tab
2. Note the deleted message
3. Review the keyword that triggered it
4. Go to Keywords tab
5. Remove that keyword
6. Reset user count if helpful

### Handle an Appeal
1. Get appeal from user
2. Review in Logs tab
3. Check context of message
4. Make decision:
   - **Grant**: Reset user, explain decision
   - **Deny**: Explain why violation was valid
5. Document decision

---

## Troubleshooting

**Can't login?**
- Verify email is registered as admin
- Clear browser cache
- Try different browser
- Contact system admin

**Keywords not working?**
- Check exact spelling
- Verify case sensitivity (bot uses lowercase)
- Ensure keyword is in correct category
- Reload page to refresh

**Can't see violations?**
- Refresh page
- Check date range
- Verify you have admin access
- Check audit logs

**Alerts not received?**
- Verify Telegram ID registered
- Check Telegram username format
- Ensure bot has your number
- Restart Telegram app

---

## Security Notes

- **Never share dashboard link** with non-admins
- **Logout** when done with dashboard
- **Use strong password** for admin email
- **Verify changes** before trusting them
- **Document decisions** for transparency

---

## Support & Questions

- Message group mods
- Email admin team
- Check documentation
- Review audit logs

---

**Bot Version:** v2  
**Last Updated:** April 8, 2026  
**Dashboard:** https://telegram.psots.in/admin

---

*Thank you for maintaining community standards! 🙏*
