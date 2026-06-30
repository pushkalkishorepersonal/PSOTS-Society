// js/admin/moderation.js
// Telegram bot / group moderation module — extracted from admin.html.
// No Firestore dependency: all data comes from the Worker (KV-backed),
// so this module needs no changes when residents/admins move to D1.
import { auth } from '../core/firebase.js';

const workerUrl = 'https://telegram.psots.in';
let selectedGroupId = null;
let allMembers = [];
let _logsCache = [];      // full log list for client-side filter
    let _logsFilter = 'all';  // active filter
    let _logsRefreshTimer = null;

    
    
    
    
    
    
    
    
    // Auto-refresh every 60 s while Logs tab is active
        
    

    

    const DEFAULT_MESSAGE_LEVELS = [
      {
        atCount: 1, muteMinutes: 0, sendAs: 'dm',
        text: '⚠️ Hi {name}, your message was removed as it violated our community guidelines.\n\nThis is violation #1. Please review the community rules.\n\nView your record: {profile}'
      },
      {
        atCount: 2, muteMinutes: 0, sendAs: 'dm',
        text: '⚠️ Hi {name}, this is your 2nd violation. Your message has been removed.\n\nReason: {reason}\n\nRepeated violations will result in being muted.\n\nView & appeal: {profile}'
      },
      {
        atCount: 3, muteMinutes: 60, sendAs: 'dm',
        text: '🔇 Hi {name}, you have been muted for 60 minutes (violation #3).\n\nReason: {reason}\n\nYou may appeal at: {profile}'
      },
      {
        atCount: 5, muteMinutes: 1440, sendAs: 'group',
        text: '🔇 Hi {name}, you have been muted for 24 hours (violation #{count}).\n\nThis is a serious violation. Admin has been notified.\n\nAppeal: {profile}'
      },
      {
        atCount: 10, muteMinutes: 99999, sendAs: 'group',
        text: '⛔ Hi {name}, you have reached the maximum violation limit (#{count}).\n\nYou are muted pending admin review. Bans are admin-only.\n\nTo appeal: {profile}'
      }
    ];
window.toggleBotGuide = function() {
      const content = document.getElementById('botGuideContent');
      const chevron = document.getElementById('botGuideChevron');
      const isOpen = content.style.display !== 'none';
      content.style.display = isOpen ? 'none' : 'block';
      chevron.style.transform = isOpen ? 'rotate(0deg)' : 'rotate(180deg)';
    };
window.renderGroupTiles = async function() {
      const groupTilesContainer = document.getElementById('groupTiles');
      if (!groupTilesContainer) return;

      try {
        const idToken = await auth.currentUser?.getIdToken().catch(() => null);
        const groupsRes = await fetch(`${workerUrl}/admin/groups`, { credentials: 'include',
          headers: { 'Authorization': `Bearer ${idToken}` }
        });
        const groupsData = await groupsRes.json();

        if (!groupsData.ok || !groupsData.groups || groupsData.groups.length === 0) {
          groupTilesContainer.innerHTML = '<p style="color:var(--muted);">No groups found.</p>';
          return;
        }

        groupTilesContainer.innerHTML = '';

        // PHASE 1: Render all tiles synchronously (instant UI)
        const tileMap = {}; // chatId -> tile element
        for (const group of groupsData.groups) {
          const chatId = String(group.chatId);
          const photo = group.photo || '';
          const photoSrc = photo && !photo.startsWith('http') ? `${workerUrl}${photo}` : photo;
          const photoHtml = photoSrc
            ? `<img src="${photoSrc}" class="group-tile-photo" alt="${window.escapeHTML(group.title)}" onerror="this.style.display='none';this.nextElementSibling.style.display='flex';" style="width:56px;height:56px;border-radius:50%;object-fit:cover;"><div style="display:none;width:56px;height:56px;border-radius:50%;background:var(--jade-light);align-items:center;justify-content:center;font-size:24px;color:white;flex-direction:column;">👥</div>`
            : `<div class="group-tile-placeholder">👥</div>`;

          // Fetch config synchronously to determine enabled status
          const configRes = await fetch(`${workerUrl}/admin/moderation-config?chatId=${chatId}`, { credentials: 'include',
            headers: { 'Authorization': `Bearer ${idToken}` }
          });
          const configData = await configRes.json();
          const config = configData.ok ? configData.config : { enabled: false };
          const statusBadge = config.enabled ? '🟢 Active' : '⚫ Inactive';

          const tile = document.createElement('div');
          tile.className = 'group-tile';
          tile.setAttribute('data-chatid', chatId);
          tile.onclick = () => window.selectGroup(chatId);
          tile.innerHTML = `
            ${photoHtml}
            <div class="group-tile-name">${window.escapeHTML(group.title)}</div>
            <div class="group-tile-count tile-member-count" data-chatid="${chatId}">—</div>
            <div class="group-tile-status">${statusBadge}</div>
          `;
          groupTilesContainer.appendChild(tile);
          tileMap[chatId] = tile;
        }

        // PHASE 2: Fetch member counts in background (non-blocking)
        for (const group of groupsData.groups) {
          const chatId = String(group.chatId);
          window.fetchMemberCount(chatId, idToken);
        }

        // Auto-select first group
        if (groupsData.groups.length > 0) {
          const firstChatId = String(groupsData.groups[0].chatId);
          window.selectGroup(firstChatId);
        }
      } catch (err) {
        console.error('Error rendering group tiles:', err);
        groupTilesContainer.innerHTML = '<p style="color:var(--red);">Error loading groups</p>';
      }
    };
window.fetchMemberCount = async function(chatId, idToken) {
      try {
        const groupInfoRes = await fetch(`${workerUrl}/admin/group-info?chatId=${chatId}`, { credentials: 'include',
          headers: { 'Authorization': `Bearer ${idToken}` }
        });
        const groupInfoData = await groupInfoRes.json();
        if (groupInfoData.ok) {
          const memberCountEl = document.querySelector(`.tile-member-count[data-chatid="${chatId}"]`);
          if (memberCountEl) {
            memberCountEl.textContent = `${groupInfoData.memberCount.toLocaleString()}`;
          }
        }
      } catch (_e) {
        console.log('Could not fetch live member count for', chatId);
      }
    };
window.selectGroup = async function(chatId) {
      console.log('Selecting group:', chatId);

      // Remove selected class from all tiles
      document.querySelectorAll('.group-tile').forEach(tile => {
        tile.classList.remove('selected');
      });

      // Add selected class to clicked tile
      const selectedTile = document.querySelector(`.group-tile[data-chatid="${chatId}"]`);
      if (selectedTile) {
        selectedTile.classList.add('selected');
      }

      // Update the hidden dropdown for backwards compatibility
      const modGroupSelect = document.getElementById('modGroupSelect');
      if (modGroupSelect) {
        modGroupSelect.value = chatId;
      }

      // Reload moderation data for selected group
      await window.loadModGroupData();
    };
window.loadGroupMembers = async function() {
      const groupId = document.getElementById('groupSelect').value;
      if (!groupId) {
        document.getElementById('membersList').style.display = 'none';
        return;
      }

      selectedGroupId = groupId;
      try {
        const res = await fetch(`${workerUrl}/admin/members?groupId=${groupId}`);
        if (!res.ok) throw new Error('Failed to load members');
        const data = await res.json();

        document.getElementById('groupInfo').style.display = 'block';
        document.getElementById('groupName').textContent = data.groupTitle || `Group ${groupId}`;
        document.getElementById('groupMembers').textContent = data.members?.length || 0;

        allMembers = data.members || [];
        renderMembers(allMembers);
        document.getElementById('membersList').style.display = 'block';
      } catch (_err) {
        window.showMessage('moderationMessage', 'Error loading members', 'error');
      }
    };
window.searchMembers = function() {
      const query = document.getElementById('memberSearch').value.toLowerCase();
      const filtered = allMembers.filter(m =>
        (m.name?.toLowerCase() || '').includes(query) ||
        (m.username?.toLowerCase() || '').includes(query)
      );
      renderMembers(filtered);
    };
function renderMembers(members) {
      const html = members.map(m => `
        <div style="padding: 12px; border: 1px solid var(--border); border-radius: 8px; margin-bottom: 8px; display: flex; justify-content: space-between; align-items: center;">
          <div>
            <div><strong>${m.name || m.username || `User ${m.user_id}`}</strong> ${m.is_bot ? '🤖' : ''}</div>
            <div style="font-size: 12px; color: var(--muted);">@${m.username || m.user_id} · ${m.status || 'member'}</div>
          </div>
          <div style="display: flex; gap: 8px;">
            <button class="btn-small" onclick="muteUser('${selectedGroupId}', '${m.user_id}')">🔇 Mute 24h</button>
            <button class="btn-small btn-danger" onclick="banUser('${selectedGroupId}', '${m.user_id}')">🚫 Ban</button>
            <button class="btn-small" onclick="warnUser('${selectedGroupId}', '${m.user_id}')">⚠️ Warn</button>
          </div>
        </div>
      `).join('');

      document.getElementById('membersList').innerHTML = html || '<p style="color: var(--muted);">No members found.</p>';
    }
window.muteUser = async function(groupId, userId) {
      try {
        const res = await fetch(`${workerUrl}/admin/mute`, { credentials: 'include',
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ groupId, userId, duration: 86400 }),
        });
        if (!res.ok) throw new Error('Failed to mute user');
        window.showMessage('moderationMessage', 'User muted for 24 hours', 'success');
      } catch (_err) {
        window.showMessage('moderationMessage', 'Error muting user', 'error');
      }
    };
window.banUser = async function(groupId, userId) {
      if (!confirm('Ban this user permanently?')) return;
      try {
        const res = await fetch(`${workerUrl}/admin/ban`, { credentials: 'include',
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ groupId, userId }),
        });
        if (!res.ok) throw new Error('Failed to ban user');
        window.showMessage('moderationMessage', 'User banned', 'success');
        window.loadGroupMembers();
      } catch (_err) {
        window.showMessage('moderationMessage', 'Error banning user', 'error');
      }
    };
window.loadModGroupData = async function() {
      const chatId = document.getElementById('modGroupSelect').value;

      if (!chatId) {
        document.getElementById('modSubTabs').style.display = 'none';
        document.getElementById('botCapabilities').style.display = 'none';
        filterModConfigCards('');
        return;
      }

      document.getElementById('modSubTabs').style.display = 'flex';
      document.getElementById('botCapabilities').style.display = 'block';
      filterModConfigCards(chatId);

      // Fetch actual bot capabilities from the Telegram API
      try {
        const idToken = await auth.currentUser?.getIdToken().catch(() => null);
        const statusRes = await fetch(`${workerUrl}/admin/bot-status?chatId=${chatId}`, { credentials: 'include',
          headers: { 'Authorization': `Bearer ${idToken}` }
        });
        const statusData = await statusRes.json();
        console.log('Bot status response:', JSON.stringify(statusData));
        if (statusData.ok) {
          const canDelete = statusData.canDeleteMessages === true;
          const canRestrict = statusData.canRestrictMembers === true;
          document.getElementById('botCapDelete').innerHTML = canDelete ? '🟢 Delete messages' : '🔴 Cannot delete messages (not admin)';
          document.getElementById('botCapMute').innerHTML = canRestrict ? '🟢 Mute users' : '🔴 Cannot mute users (not admin)';
          document.getElementById('botCapKick').innerHTML = canDelete ? '🟢 Remove users' : '🔴 Cannot remove users (not admin)';
          const isAdmin = statusData.isAdmin === true;
          const hint = isAdmin ? '' : '⚡ To enable full moderation, make the bot an admin with Delete Messages + Restrict Members permissions.';
          document.getElementById('botCapHint').textContent = hint;
        }
      } catch (err) {
        console.error('Error loading bot status:', err);
      }

      try {
        const idToken = await auth.currentUser?.getIdToken().catch(() => null);
        const res = await fetch(`${workerUrl}/admin/group-settings?chatId=${chatId}`, { credentials: 'include',
          headers: { 'Authorization': `Bearer ${idToken}` }
        });

        if (!res.ok) {
          console.error('Group settings fetch failed:', res.status);
          window.showMessage('moderationMessage', 'Failed to load group settings', 'error');
          return;
        }

        const data = await res.json();
        if (data.ok && data.settings) {
          populateModSettings(data.settings);
          // Silently use defaults if returned
        }
      } catch (err) {
        console.error('Error loading group settings:', err);
        window.showMessage('moderationMessage', 'Network error loading group settings', 'error');
      }
    };
function populateModSettings(settings) {
      const botActive = document.getElementById('botActive');
      if (botActive) botActive.checked = settings.botActive !== false;
      const botInactive = document.getElementById('botInactive');
      if (botInactive) botInactive.checked = !settings.botActive;
      const warnAt = document.getElementById('warnAt');
      if (warnAt) warnAt.value = settings.thresholds?.warn || 1;
      const muteAt = document.getElementById('muteAt');
      if (muteAt) muteAt.value = settings.thresholds?.mute || 3;
      const muteDuration = document.getElementById('muteDuration');
      if (muteDuration) muteDuration.value = settings.thresholds?.muteDuration || 60;
      const banLimit = document.getElementById('banLimit');
      if (banLimit) banLimit.value = settings.thresholds?.ban || 0;
      const geminiEnabled = document.getElementById('geminiEnabled');
      if (geminiEnabled) geminiEnabled.checked = settings.gemini?.enabled === true;
      const geminiSensitivity = document.getElementById('geminiSensitivity');
      if (geminiSensitivity) geminiSensitivity.value = settings.gemini?.sensitivity || 'medium';
      const geminiContextMessages = document.getElementById('geminiContextMessages');
      if (geminiContextMessages) geminiContextMessages.value = settings.gemini?.contextMessages || 10;
      const dmThreshold = document.getElementById('dmThreshold');
      if (dmThreshold) dmThreshold.value = settings.warningMessages?.dmThreshold || 3;
      const notifyAdminFrom = document.getElementById('notifyAdminFrom');
      if (notifyAdminFrom) notifyAdminFrom.value = settings.warningMessages?.notifyAdminFrom || 2;

      // Predefined keywords
      const predefined = settings.keywords?.predefined || {};
      const kwSpam = document.getElementById('kw-spam');
      if (kwSpam) kwSpam.checked = predefined.spam !== false;
      const kwAbuse = document.getElementById('kw-abuse');
      if (kwAbuse) kwAbuse.checked = predefined.abuse !== false;
      const kwLinks = document.getElementById('kw-links');
      if (kwLinks) kwLinks.checked = predefined.links !== false;
      const kwAds = document.getElementById('kw-ads');
      if (kwAds) kwAds.checked = predefined.ads !== false;
      const kwHate = document.getElementById('kw-hate');
      if (kwHate) kwHate.checked = predefined.hate !== false;

      // Custom keywords
      if (typeof renderCustomKeywords === 'function') {
        renderCustomKeywords(settings.keywords?.custom || []);
      }

      // Message levels
      if (typeof renderMessageLevels === 'function') {
        renderMessageLevels(settings.warningMessages?.levels || []);
      }
    }
function renderCustomKeywords(keywords) {
      const container = document.getElementById('customKeywordsList');
      container.innerHTML = keywords.map((kw, i) => `
        <div style="display: inline-block; background: var(--cream-dark); padding: 6px 12px; border-radius: 6px; font-size: 13px;">
          ${kw}
          <button onclick="removeCustomKeyword(${i})" style="background: none; border: none; color: var(--terra); cursor: pointer; margin-left: 6px; font-weight: bold;">×</button>
        </div>
      `).join('');
    }
window.addCustomKeyword = function() {
      const input = document.getElementById('customKeyword');
      const kw = input.value.trim();
      if (!kw) return;

      const keywords = Array.from(document.querySelectorAll('#customKeywordsList > div')).map(el => el.textContent.trim());
      keywords.push(kw);
      renderCustomKeywords(keywords);
      input.value = '';
    };
window.removeCustomKeyword = function(index) {
      const keywords = Array.from(document.querySelectorAll('#customKeywordsList > div')).map(el => el.textContent.trim());
      keywords.splice(index, 1);
      renderCustomKeywords(keywords);
    };
window.switchModTab = function(tabName, btn) {
      document.querySelectorAll('#modSettings, #modConfig, #modKeywords, #modMessages, #modReactions, #modLogs, #modViolations').forEach(el => el.style.display = 'none');
      document.querySelectorAll('#modSubTabs .tab-btn').forEach(el => el.classList.remove('active'));
      document.getElementById('mod' + tabName.charAt(0).toUpperCase() + tabName.slice(1)).style.display = 'block';
      (btn || window.event?.target)?.classList.add('active');
      const chatId = document.getElementById('modGroupSelect').value;
      if (tabName === 'config'     && chatId) loadModConfig();
      if (tabName === 'keywords'   && chatId) loadKeywords(chatId);
      if (tabName === 'violations' && chatId) loadViolations(chatId);
      if (tabName === 'messages'   && chatId) loadMessages(chatId);
      if (tabName === 'reactions'  && chatId) loadReactions(chatId);
      if (tabName === 'logs'       && chatId) { loadLogs(chatId); _startLogsRefresh(chatId); }
      else _stopLogsRefresh();
    };
window.saveModSettings = async function() {
      const chatId = document.getElementById('modGroupSelect').value;
      if (!chatId) return;

      const settings = {
        chatId,
        botActive: document.getElementById('botActive').checked,
        thresholds: {
          warn: parseInt(document.getElementById('warnAt').value),
          mute: parseInt(document.getElementById('muteAt').value),
          muteDuration: parseInt(document.getElementById('muteDuration').value),
          ban: parseInt(document.getElementById('banLimit').value)
        },
        gemini: {
          enabled: document.getElementById('geminiEnabled').checked,
          sensitivity: document.getElementById('geminiSensitivity').value,
          contextMessages: parseInt(document.getElementById('geminiContextMessages').value)
        },
        keywords: {
          predefined: {
            spam: document.getElementById('kw-spam').checked,
            abuse: document.getElementById('kw-abuse').checked,
            links: document.getElementById('kw-links').checked,
            ads: document.getElementById('kw-ads').checked,
            hate: document.getElementById('kw-hate').checked
          },
          custom: Array.from(document.querySelectorAll('#customKeywordsList > div')).map(el => el.textContent.replace('×', '').trim())
        },
        warningMessages: {
          dmThreshold: parseInt(document.getElementById('dmThreshold').value),
          notifyAdminFrom: parseInt(document.getElementById('notifyAdminFrom').value),
          levels: collectMessageLevels()
        }
      };

      try {
        const idToken = await auth.currentUser?.getIdToken().catch(() => null);
        const res = await fetch(`${workerUrl}/admin/group-settings`, { credentials: 'include',
          method: 'POST',
          headers: { 'Authorization': `Bearer ${idToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(settings)
        });
        const data = await res.json();
        window.showMessage('moderationMessage', data.ok ? '✅ Settings saved!' : 'Error saving settings', data.ok ? 'success' : 'error');
      } catch (_err) {
        window.showMessage('moderationMessage', 'Error saving settings', 'error');
      }
    };
window.saveModKeywords = async function() {
      const chatId = document.getElementById('modGroupSelect').value;
      if (!chatId) return;
      await window.saveModSettings();
    };
async function loadKeywords(chatId) {
      try {
        const idToken = await auth.currentUser?.getIdToken().catch(() => null);
        const res = await fetch(`${workerUrl}/admin/keywords?chatId=${chatId}`, { credentials: 'include',
          headers: { 'Authorization': `Bearer ${idToken}` }
        });
        const data = await res.json();
        if (data.ok && data.keywords) {
          document.getElementById('kw-spam').checked = data.keywords.spam !== false;
          document.getElementById('kw-abuse').checked = data.keywords.abuse !== false;
          document.getElementById('kw-links').checked = data.keywords.links !== false;
          document.getElementById('kw-ads').checked = data.keywords.ads !== false;
          document.getElementById('kw-hate').checked = data.keywords.hate !== false;
          const custom = data.keywords.custom || [];
          document.getElementById('customKeywordsList').innerHTML = custom.map((kw, i) => `
            <div style="display: inline-block; background: var(--cream-dark); padding: 6px 12px; border-radius: 6px; font-size: 13px;">
              ${kw}
              <button onclick="removeCustomKeyword(${i})" style="background: none; border: none; color: var(--terra); cursor: pointer; margin-left: 6px; font-weight: bold;">×</button>
            </div>
          `).join('');
        }
      } catch (err) {
        window.showMessage('moderationMessage', 'Error loading keywords: ' + err.message, 'error');
      }
    }
window.saveModMessages = async function() {
      const chatId = document.getElementById('modGroupSelect').value;
      if (!chatId) { window.showMessage('moderationMessage', 'Select a group first', 'error'); return; }

      const levels = collectMessageLevels();
      const dmThreshold    = parseInt(document.getElementById('dmThreshold')?.value    || 3);
      const notifyAdminFrom = parseInt(document.getElementById('notifyAdminFrom')?.value || 2);

      try {
        const idToken = await auth.currentUser?.getIdToken().catch(() => null);
        const res = await fetch(`${workerUrl}/admin/group-settings`, { credentials: 'include',
          method: 'POST',
          headers: { 'Authorization': `Bearer ${idToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chatId,
            warningMessages: { dmThreshold, notifyAdminFrom, levels }
          })
        });
        const data = await res.json();
        window.showMessage('moderationMessage', data.ok ? '✅ Messages saved!' : 'Error saving messages', data.ok ? 'success' : 'error');
      } catch (_err) {
        window.showMessage('moderationMessage', 'Error saving messages', 'error');
      }
    };
async function loadViolations(chatId) {
      try {
        const idToken = await auth.currentUser?.getIdToken().catch(() => null);
        const res = await fetch(`${workerUrl}/admin/violations?chatId=${chatId}`, { credentials: 'include',
          headers: { 'Authorization': `Bearer ${idToken}` }
        });
        const data = await res.json();
        if (data.ok && data.violations) {
          renderViolations(data.violations);
        }
      } catch (_err) {
        window.showMessage('moderationMessage', 'Error loading violations', 'error');
      }
    }
function renderViolations(violations) {
      const table = document.getElementById('violationsTable');
      if (!violations.length) {
        table.innerHTML = `<tr><td colspan="6" style="padding: 20px; text-align: center; color: var(--muted);">No violations recorded.</td></tr>`;
        return;
      }
      table.innerHTML = violations.map(v => {
        const lastDate = v.lastViolation ? new Date(v.lastViolation).toLocaleDateString('en-IN') : '—';
        const flat = v.flatNumber || '—';
        return `
          <tr style="border-bottom: 1px solid var(--border);">
            <td style="padding: 12px;">@${v.username || v.userId}</td>
            <td style="padding: 12px; font-size: 13px;">${flat}</td>
            <td style="padding: 12px; font-weight: 600;">${v.count}</td>
            <td style="padding: 12px; font-size: 12px; color: var(--muted);">${lastDate}</td>
            <td style="padding: 12px;">
              <span style="background: rgba(184,136,42,0.2); color: var(--gold); padding: 4px 8px; border-radius: 6px; font-size: 11px;">Active</span>
            </td>
            <td style="padding: 12px;">
              <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
                <button class="btn-small" title="Reset violations" onclick="resetViolations('${v.userId}')">🔄 Reset</button>
                <input id="mute-mins-${v.userId}" type="number" value="60" min="1" style="width: 56px; padding: 4px 6px; border: 1px solid var(--border); border-radius: 6px; font-size: 12px;" />
                <button class="btn-small" title="Mute user" onclick="muteViolator('${v.userId}')">🔇 Mute</button>
                <button class="btn-small btn-danger" title="Ban user" onclick="banViolator('${v.userId}')">🚫 Ban</button>
              </div>
            </td>
          </tr>
        `;
      }).join('');
    }
window.resetViolations = async function(userId) {
      const chatId = document.getElementById('modGroupSelect').value;
      if (!chatId) return;

      try {
        const idToken = await auth.currentUser?.getIdToken().catch(() => null);
        const res = await fetch(`${workerUrl}/admin/violations/reset`, { credentials: 'include',
          method: 'POST',
          headers: { 'Authorization': `Bearer ${idToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ chatId, userId })
        });
        const data = await res.json();
        window.showMessage('moderationMessage', data.ok ? '✅ Violation count reset!' : 'Error resetting', data.ok ? 'success' : 'error');
        if (data.ok) loadViolations(chatId);
      } catch (_err) {
        window.showMessage('moderationMessage', 'Error resetting violations', 'error');
      }
    };
window.muteViolator = async function(userId) {
      const chatId = document.getElementById('modGroupSelect').value;
      if (!chatId) return;
      const duration = parseInt(document.getElementById(`mute-mins-${userId}`)?.value || '60');

      try {
        const idToken = await auth.currentUser?.getIdToken().catch(() => null);
        const res = await fetch(`${workerUrl}/admin/violations/mute`, { credentials: 'include',
          method: 'POST',
          headers: { 'Authorization': `Bearer ${idToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ chatId, userId, duration })
        });
        const data = await res.json();
        window.showMessage('moderationMessage', data.ok ? `✅ Muted for ${duration} minutes!` : 'Error muting', data.ok ? 'success' : 'error');
      } catch (_err) {
        window.showMessage('moderationMessage', 'Error muting user', 'error');
      }
    };
window.banViolator = async function(userId) {
      if (!confirm('Ban this user permanently from the group? This cannot be undone.')) return;

      const chatId = document.getElementById('modGroupSelect').value;
      try {
        const idToken = await auth.currentUser?.getIdToken().catch(() => null);
        const res = await fetch(`${workerUrl}/admin/violations/ban`, { credentials: 'include',
          method: 'POST',
          headers: { 'Authorization': `Bearer ${idToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ chatId, userId })
        });
        const data = await res.json();
        window.showMessage('moderationMessage', data.ok ? '✅ User banned!' : 'Error banning', data.ok ? 'success' : 'error');
        if (data.ok) loadViolations(chatId);
      } catch (_err) {
        window.showMessage('moderationMessage', 'Error banning user', 'error');
      }
    };
window.filterViolations = function() {
      const search = document.getElementById('violationSearch').value.toLowerCase();
      document.querySelectorAll('#violationsTable tr').forEach(row => {
        const username = row.querySelector('td')?.textContent.toLowerCase() || '';
        row.style.display = username.includes(search) ? '' : 'none';
      });
    };
async function loadModGroups() {
      try {
        const idToken = await auth.currentUser?.getIdToken().catch(() => null);
        const res = await fetch(`${workerUrl}/admin/groups`, { credentials: 'include',
          headers: { 'Authorization': `Bearer ${idToken}` }
        });
        if (!res.ok) throw new Error('Failed to fetch groups');
        const data = await res.json();

        let groups = data.groups || [];

        // Non-superadmins see only their assigned groups
        if (!window.getCurrentAdminDoc()?.isSuperadmin) {
          const allowed = (window.getCurrentAdminDoc()?.telegramGroups || []).map(g =>
            typeof g === 'object' ? String(g.chatId || g.id) : String(g)
          );
          groups = groups.filter(g => allowed.includes(String(g.chatId)));
        }

        if (!groups.length) {
          window.showMessage('moderationMessage', 'No Telegram groups found. Make sure the bot has joined at least one group.', 'warn');
          return;
        }

        // Populate hidden dropdown for backwards compatibility
        const select = document.getElementById('modGroupSelect');
        select.innerHTML = '<option value="">Choose a group...</option>' +
          groups.map(g => `<option value="${g.chatId}">${g.title || `Group ${g.chatId}`}</option>`).join('');
      } catch (err) {
        window.showMessage('moderationMessage', 'Error loading groups: ' + err.message, 'error');
      }
    }
async function saveBotSettings() {
      const token = document.getElementById('botToken').value.trim();
      const adminGroupId = document.getElementById('adminGroupId').value.trim();
      if (!token) {
        window.showMessage('botConfigMessage', '⚠️ Bot token is required', 'warning');
        return;
      }
      try {
        const idToken = await auth.currentUser?.getIdToken().catch(() => null);
        const res = await fetch(`${workerUrl}/admin/settings/bot`, { credentials: 'include',
          method: 'POST',
          headers: { 'Authorization': `Bearer ${idToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ botToken: token, adminGroupId: adminGroupId || '-1001328126394' })
        });
        const data = await res.json();
        if (data.ok) {
          window.showMessage('botConfigMessage', '✅ Bot settings saved successfully', 'success');
          setTimeout(() => location.reload(), 1500);
        } else {
          window.showMessage('botConfigMessage', `⚠️ ${data.error || 'Error saving settings'}`, 'error');
        }
      } catch (err) {
        window.showMessage('botConfigMessage', '❌ Error: ' + err.message, 'error');
      }
    }
async function testBotConnection() {
      const token = document.getElementById('botToken').value.trim();
      if (!token) {
        window.showMessage('botConfigMessage', '⚠️ Enter bot token first', 'warning');
        return;
      }
      try {
        const res = await fetch(`https://api.telegram.org/bot${token}/getMe`);
        const data = await res.json();
        if (data.ok) {
          window.showMessage('botConfigMessage', `✅ Bot connected: @${data.result.username} (${data.result.first_name})`, 'success');
        } else {
          window.showMessage('botConfigMessage', `❌ Invalid token: ${data.description || 'Unknown error'}`, 'error');
        }
      } catch (err) {
        window.showMessage('botConfigMessage', '❌ Connection failed: ' + err.message, 'error');
      }
    }
function filterModConfigCards(selectedChatId) {
      const cards = document.querySelectorAll('.mod-config-card');
      cards.forEach(card => {
        if (!selectedChatId || selectedChatId === 'all') {
          card.style.display = 'block';
        } else {
          card.style.display =
            card.dataset.chatid === String(selectedChatId)
            ? 'block' : 'none';
        }
      });
    }
async function loadModConfig() {
      const configCards = document.getElementById('modConfigCards');
      if (!configCards) return;
      configCards.innerHTML = '';
      const loading = document.getElementById('modConfigLoading');
      loading.style.display = 'block';

      try {
        const idToken = await auth.currentUser?.getIdToken().catch(() => null);

        // Get the selected group from the dropdown
        const modGroupSelect = document.getElementById('modGroupSelect');
        const selectedChatId = modGroupSelect?.value;
        if (!selectedChatId) {
          loading.textContent = 'Please select a group.';
          return;
        }

        // Get all groups to find the selected one
        const groupsRes = await fetch(`${workerUrl}/admin/groups`, { credentials: 'include',
          headers: { 'Authorization': `Bearer ${idToken}` }
        });
        const groupsData = await groupsRes.json();

        if (!groupsData.ok || !groupsData.groups) {
          loading.textContent = 'No groups found.';
          return;
        }

        configCards.innerHTML = '';
        loading.style.display = 'none';

        // Load config only for the selected group
        const group = groupsData.groups.find(g => String(g.chatId) === selectedChatId);
        if (!group) {
          loading.textContent = 'Selected group not found.';
          return;
        }

        // Load moderation config for selected group only
        {
          const chatId = String(group.chatId);
          const groupInfo = group;
          const configRes = await fetch(`${workerUrl}/admin/moderation-config?chatId=${chatId}`, { credentials: 'include',
            headers: { 'Authorization': `Bearer ${idToken}` }
          });
          const configData = await configRes.json();
          const config = configData.ok ? configData.config : {
            enabled: false,
            engine: 'keyword',
            contextWindow: 5,
            action: 'delete_warn',
            rules: 'This is a residential society group. No unsolicited advertising or contact sharing without prior request.',
            triggerKeywords: [],
            allowList: []
          };

          const triggerKeywordsStr = Array.isArray(config.triggerKeywords) ? config.triggerKeywords.join(', ') : '';
          const allowListStr = Array.isArray(config.allowList) ? config.allowList.join(', ') : '';
          const statusBadge = config.enabled ? '🟢 Active' : '⚫ Inactive';
          const memberCount = groupInfo.memberCount || '—';
          const groupPhoto = groupInfo.photo || '';
          const photoSrc = groupPhoto && !groupPhoto.startsWith('http') ? `${workerUrl}${groupPhoto}` : groupPhoto;
          const photoHtml = photoSrc ? `<img src="${photoSrc}" style="width:32px;height:32px;border-radius:50%;object-fit:cover;margin-right:10px;" />` : '<div style="width:32px;height:32px;border-radius:50%;background:var(--border);margin-right:10px;display:flex;align-items:center;justify-content:center;font-size:16px;">👥</div>';

          const card = document.createElement('div');
          card.className = 'mod-config-card';
          card.setAttribute('data-chatid', chatId);
          card.style.cssText = 'background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:20px;display:flex;flex-direction:column;';
          card.innerHTML = `
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;">
              <div style="display:flex;align-items:center;gap:8px;">
                ${photoHtml}
                <div>
                  <h4 style="font-size:14px;font-weight:600;color:var(--ink);margin:0;">${window.escapeHTML(groupInfo.title)}</h4>
                  <p class="group-member-count" style="font-size:11px;color:var(--muted);margin:2px 0 0 0;">👥 ${memberCount} members</p>
                </div>
              </div>
              <span style="font-size:12px;font-weight:600;letter-spacing:0.5px;white-space:nowrap;">${statusBadge}</span>
            </div>

            <label style="display:flex;align-items:center;gap:8px;cursor:pointer;margin-bottom:16px;">
              <input type="checkbox" class="modEnabled" data-chatid="${chatId}" ${config.enabled ? 'checked' : ''} />
              <span style="font-size:14px;">Enable Moderation</span>
            </label>

            <div style="margin-bottom:16px;">
              <label style="display:block;font-size:12px;font-weight:600;margin-bottom:6px;">Engine</label>
              <select class="modEngine" data-chatid="${chatId}" style="width:100%;padding:8px;border:1px solid var(--border);border-radius:6px;font-size:13px;">
                <option value="keyword" ${config.engine === 'keyword' ? 'selected' : ''}>Keyword Only</option>
                <option value="gemini" ${config.engine === 'gemini' ? 'selected' : ''}>Gemini Context-Aware</option>
                <option value="both" ${config.engine === 'both' ? 'selected' : ''}>Both</option>
              </select>
            </div>

            <div style="margin-bottom:16px;">
              <label style="display:block;font-size:12px;font-weight:600;margin-bottom:6px;">Context Window</label>
              <select class="modContextWindow" data-chatid="${chatId}" style="width:100%;padding:8px;border:1px solid var(--border);border-radius:6px;font-size:13px;">
                <option value="3" ${config.contextWindow === 3 ? 'selected' : ''}>3 messages</option>
                <option value="5" ${config.contextWindow === 5 ? 'selected' : ''}>5 messages</option>
                <option value="10" ${config.contextWindow === 10 ? 'selected' : ''}>10 messages</option>
              </select>
            </div>

            <div style="margin-bottom:16px;">
              <label style="display:block;font-size:12px;font-weight:600;margin-bottom:6px;">Action on Violation</label>
              <select class="modAction" data-chatid="${chatId}" style="width:100%;padding:8px;border:1px solid var(--border);border-radius:6px;font-size:13px;">
                <option value="delete_warn" ${config.action === 'delete_warn' ? 'selected' : ''}>Delete + Warn</option>
                <option value="delete_silent" ${config.action === 'delete_silent' ? 'selected' : ''}>Delete Silent</option>
                <option value="warn_only" ${config.action === 'warn_only' ? 'selected' : ''}>Warn Only</option>
                <option value="flag_review" ${config.action === 'flag_review' ? 'selected' : ''}>Flag for Review</option>
              </select>
            </div>

            <div style="margin-bottom:16px;">
              <label style="display:block;font-size:12px;font-weight:600;margin-bottom:6px;">Custom Rules (for Gemini)</label>
              <textarea class="modRules mod-textarea" data-chatid="${chatId}" style="width:100%;padding:8px;border:1px solid var(--border);border-radius:6px;font-size:13px;font-family:inherit;line-height:1.5;min-height:80px;" placeholder="Custom moderation rules for Gemini...">${window.escapeHTML(config.rules)}</textarea>
            </div>

            <hr style="margin:16px 0;border:none;border-top:1px solid var(--border);">

            <div style="margin-bottom:16px;">
              <label style="display:block;font-size:12px;font-weight:600;margin-bottom:6px;color:var(--gold);">⚡ TRIGGER KEYWORDS (Gemini analyzes when these appear)</label>
              <textarea class="modTriggerKeywords" data-chatid="${chatId}" style="width:100%;padding:8px;border:1px solid var(--border);border-radius:6px;font-size:12px;font-family:monospace;min-height:80px;" placeholder="maid, driver, cook, pg, room,&#10;sell, buy, service, call, contact, whatsapp">${window.escapeHTML(triggerKeywordsStr)}</textarea>
              <p style="font-size:11px;color:var(--muted);margin:6px 0 0 0;">One per line or comma-separated</p>
            </div>

            <div style="margin-bottom:16px;">
              <label style="display:block;font-size:12px;font-weight:600;margin-bottom:6px;color:var(--jade);">✓ ALLOW LIST (never flag these phrases)</label>
              <textarea class="modAllowList" data-chatid="${chatId}" style="width:100%;padding:8px;border:1px solid var(--border);border-radius:6px;font-size:12px;font-family:monospace;min-height:80px;" placeholder="society fees, maintenance, amenities,&#10;event, festival, chhath, durga">${window.escapeHTML(allowListStr)}</textarea>
              <p style="font-size:11px;color:var(--muted);margin:6px 0 0 0;">One per line or comma-separated</p>
            </div>

            <div style="background:var(--cream);border:1px solid var(--border);border-radius:8px;padding:12px;margin-bottom:16px;font-size:12px;color:var(--muted);">
              <p style="margin:0;font-weight:600;color:var(--ink);margin-bottom:4px;">📋 Activity</p>
              <p style="margin:0;">Last flagged: ${config.lastActivity ? new Date(config.lastActivity).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' }) : 'No activity yet'}</p>
            </div>

            <button onclick="saveModConfigForGroup('${chatId}')" style="width:100%;background:var(--jade);color:white;padding:10px;border:none;border-radius:6px;cursor:pointer;font-weight:600;font-size:13px;margin-top:auto;">Save Config</button>
          `;
          configCards.appendChild(card);
          console.log('Cards rendered:', configCards.children.length);

          // Fetch live group info and update member count
          console.log('Fetching group info for:', chatId);
          try {
            const freshToken = await auth.currentUser?.getIdToken().catch(() => null);
            console.log('Got fresh token, making fetch request...');
            const groupInfoRes = await fetch(`${workerUrl}/admin/group-info?chatId=${chatId}`, { credentials: 'include',
              headers: { 'Authorization': `Bearer ${freshToken}` }
            });
            console.log('Fetch response received, status:', groupInfoRes.status);
            const groupInfoData = await groupInfoRes.json();
            console.log('group-info response:', groupInfoData);
            if (groupInfoData.ok) {
              console.log('Updating member count to:', groupInfoData.memberCount);
              const memberCountEl = card.querySelector('.group-member-count');
              console.log('Found element:', memberCountEl);
              if (memberCountEl) {
                memberCountEl.textContent = `👥 ${groupInfoData.memberCount.toLocaleString()} members`;
                console.log('Member count updated successfully');
              }
            } else {
              console.log('group-info error:', groupInfoData);
            }
          } catch (e) {
            console.error('Could not fetch live group info for', chatId, e);
          }
        }
      } catch (err) {
        loading.textContent = '❌ Error loading configs: ' + err.message;
      }
    }
window.saveModConfigForGroup = async function(chatId) {
      try {
        const enabled = document.querySelector(`.modEnabled[data-chatid="${chatId}"]`)?.checked || false;
        const engine = document.querySelector(`.modEngine[data-chatid="${chatId}"]`)?.value || 'keyword';
        const contextWindow = parseInt(document.querySelector(`.modContextWindow[data-chatid="${chatId}"]`)?.value || '5');
        const action = document.querySelector(`.modAction[data-chatid="${chatId}"]`)?.value || 'delete_warn';
        const rules = document.querySelector(`.modRules[data-chatid="${chatId}"]`)?.value || '';

        // Parse trigger keywords (comma-separated or newline-separated)
        const triggerKeywordsRaw = document.querySelector(`.modTriggerKeywords[data-chatid="${chatId}"]`)?.value || '';
        const triggerKeywords = triggerKeywordsRaw
          .split(/[,\n]+/)
          .map(k => k.trim().toLowerCase())
          .filter(k => k.length > 0);

        // Parse allow list (comma-separated or newline-separated)
        const allowListRaw = document.querySelector(`.modAllowList[data-chatid="${chatId}"]`)?.value || '';
        const allowList = allowListRaw
          .split(/[,\n]+/)
          .map(a => a.trim().toLowerCase())
          .filter(a => a.length > 0);

        const idToken = await auth.currentUser?.getIdToken().catch(() => null);
        const res = await fetch(`${workerUrl}/admin/moderation-config`, { credentials: 'include',
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${idToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            chatId,
            config: { enabled, engine, contextWindow, action, rules, triggerKeywords, allowList, keywords: null }
          })
        });

        const data = await res.json();
        if (data.ok) {
          alert('✅ Config saved for group ' + chatId);
        } else {
          alert('❌ Error: ' + (data.error || 'Unknown error'));
        }
      } catch (err) {
        alert('❌ Error: ' + err.message);
      }
    };
function _escHtml(str) {
      return String(str ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    }

function collectMessageLevels() {
      const count = document.querySelectorAll('#messageLevelsList > div[data-ml-index]').length;
      const levels = [];
      for (let i = 0; i < count; i++) {
        const sendAsEl = document.querySelector(`input[name="ml-${i}-sendAs"]:checked`);
        levels.push({
          atCount:     parseInt(document.getElementById(`ml-${i}-count`)?.value  || i + 1),
          text:        document.getElementById(`ml-${i}-text`)?.value             || '',
          muteMinutes: parseInt(document.getElementById(`ml-${i}-mute`)?.value   || 0),
          sendAs:      sendAsEl?.value || 'dm'
        });
      }
      return levels;
    }

function renderMessageLevels(levels) {
      const container = document.getElementById('messageLevelsList');
      if (!levels.length) {
        container.innerHTML = '<p style="color: var(--muted); font-size: 13px;">No levels configured. Click "+ Add Level" to get started.</p>';
        return;
      }
      container.innerHTML = levels.filter(level => level != null).map((level, i) => {
        if (!level) return '';
        const sendAs = level.sendAs || 'dm';
        return `
        <div data-ml-index="${i}" style="border: 1px solid var(--border); border-radius: 8px; padding: 16px; background: var(--cream);">
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 12px;">
            <div>
              <label style="font-size: 12px; font-weight: 600; display: block; margin-bottom: 4px;">At violation #</label>
              <input type="number" id="ml-${i}-count" value="${_escHtml(level.atCount)}" min="1"
                style="width: 100%; padding: 8px; border: 1px solid var(--border); border-radius: 6px; font-size: 12px;" />
            </div>
            <div>
              <label style="font-size: 12px; font-weight: 600; display: block; margin-bottom: 4px;">Mute duration (minutes)</label>
              <input type="number" id="ml-${i}-mute" value="${_escHtml(level.muteMinutes ?? 0)}" min="0"
                style="width: 100%; padding: 8px; border: 1px solid var(--border); border-radius: 6px; font-size: 12px;" />
              <div style="font-size: 11px; color: var(--muted); margin-top: 3px;">0 = warn only</div>
            </div>
          </div>
          <div style="margin-bottom: 12px;">
            <label style="font-size: 12px; font-weight: 600; display: block; margin-bottom: 4px;">Message</label>
            <textarea id="ml-${i}-text" rows="4"
              style="width: 100%; padding: 8px; border: 1px solid var(--border); border-radius: 6px; font-size: 12px; resize: vertical; font-family: inherit;">${_escHtml(level.text)}</textarea>
          </div>
          <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
            <div style="font-size: 13px; font-weight: 600; display: flex; align-items: center; gap: 12px;">
              Send as:
              <label style="font-weight: 400; cursor: pointer; display: flex; align-items: center; gap: 4px;">
                <input type="radio" name="ml-${i}-sendAs" id="ml-${i}-sendAs-dm" value="dm" ${sendAs === 'dm' ? 'checked' : ''} />
                DM only
              </label>
              <label style="font-weight: 400; cursor: pointer; display: flex; align-items: center; gap: 4px;">
                <input type="radio" name="ml-${i}-sendAs" id="ml-${i}-sendAs-group" value="group" ${sendAs === 'group' ? 'checked' : ''} />
                Group message
              </label>
            </div>
            <button onclick="removeMessageLevel(${i})"
              style="background: var(--terra); color: white; padding: 6px 14px; border: none; border-radius: 6px; cursor: pointer; font-size: 12px; font-weight: 600;">
              🗑 Remove
            </button>
          </div>
        </div>`;
      }).join('');
    }

window.addMessageLevel = function() {
      const current = collectMessageLevels();
      renderMessageLevels([...current, {
        atCount: current.length + 1, text: '⚠️ Your message was removed.', muteMinutes: 0, sendAs: 'dm'
      }]);
    };

window.removeMessageLevel = function(index) {
      const current = collectMessageLevels();
      current.splice(index, 1);
      renderMessageLevels(current);
    };

function _fmtLogTime(ts) {
      if (!ts) return '—';
      const d = new Date(ts);
      const now = new Date();
      const todayStr = now.toDateString();
      const timeStr  = d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false });
      if (d.toDateString() === todayStr) return `Today ${timeStr}`;
      const yesterday = new Date(now); yesterday.setDate(now.getDate() - 1);
      if (d.toDateString() === yesterday.toDateString()) return `Yesterday ${timeStr}`;
      return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) + ', ' + timeStr;
    }

function _geminiCell(log) {
      const v = log.geminiVerdict || log.gemini?.verdict;
      if (!v || v === 'skip')  return `<span style="color:#aaa; font-size:12px;">⏭ Skip</span>`;
      if (v === 'pass')        return `<span style="color:#16a34a; font-size:12px; font-weight:600;">✅ Pass</span>`;
      return                          `<span style="color:#dc2626; font-size:12px; font-weight:600;">🚩 Flag</span>`;
    }

function _actionBadge(action) {
      const map = {
        passed:  ['badge-passed',  'Passed'],
        warned:  ['badge-warned',  'Warned'],
        deleted: ['badge-deleted', 'Deleted'],
        muted:   ['badge-muted',   'Muted'],
        banned:  ['badge-banned',  'Banned'],
        flagged: ['badge-deleted', 'Flagged'],
      };
      const [cls, label] = map[action] || ['badge-passed', action || 'Unknown'];
      return `<span class="action-badge ${cls}">${label}</span>`;
    }

function _contextBubbles(context) {
      if (!context?.length) return '<span style="color:var(--muted);font-size:12px;">No context captured.</span>';
      return context.map(m => `
        <div style="padding: 6px 10px; margin-bottom: 6px; background: white; border: 1px solid var(--border);
                    border-radius: 8px; font-size: 12px; max-width: 90%;">
          <span style="font-weight:600; color:var(--jade);">@${_escHtml(m.username || 'unknown')}</span>
          <span style="color:var(--muted); margin-left:6px; font-size:11px;">${_fmtLogTime(m.ts)}</span><br>
          <span style="color:var(--ink);">${_escHtml(m.text || '')}</span>
        </div>
      `).join('');
    }

function renderLogs(logs) {
      const tbody = document.getElementById('logsTable');
      const empty = document.getElementById('logsEmptyState');

      const filtered = _logsFilter === 'all' ? logs
        : _logsFilter === 'flagged'
          ? logs.filter(l => (l.geminiVerdict || l.gemini?.verdict) === 'flag' || l.flagged)
          : logs.filter(l => (l.actionTaken || l.action || '').toLowerCase() === _logsFilter);

      if (!filtered.length) {
        tbody.innerHTML = '';
        empty.style.display = 'block';
        return;
      }
      empty.style.display = 'none';

      tbody.innerHTML = filtered.map((log, i) => {
        const id      = `log-detail-${i}`;
        const msg     = log.message || log.text || log.messageText || '';
        const snippet = msg.length > 100 ? msg.slice(0, 100) + '…' : msg;
        const action  = (log.actionTaken || log.action || 'flagged').toLowerCase();
        const username = log.from?.username || log.username || log.user || '—';

        const detailHtml = `
          <tr id="${id}" class="log-detail" style="display:none;">
            <td colspan="6" style="padding: 16px 20px;">
              <div style="margin-bottom:12px;">
                <div style="font-size:11px; font-weight:600; color:var(--muted); margin-bottom:6px; text-transform:uppercase;">Full Message</div>
                <pre style="background: var(--cream); padding: 10px; border-radius:6px; font-size:12px;
                            white-space: pre-wrap; word-break:break-word; margin:0; font-family:inherit;">${_escHtml(msg)}</pre>
              </div>
              ${log.context?.length ? `
              <div style="margin-bottom:12px;">
                <div style="font-size:11px; font-weight:600; color:var(--muted); margin-bottom:6px; text-transform:uppercase;">Context (prior messages)</div>
                ${_contextBubbles(log.context)}
              </div>` : ''}
              <div>
                <div style="font-size:11px; font-weight:600; color:var(--muted); margin-bottom:6px; text-transform:uppercase;">Violation Reason</div>
                <div style="background: white; border: 1px solid var(--border); border-radius:6px; padding:10px; font-size:12px;">
                  ${_escHtml(log.reason || log.matched || 'Flagged message')}
                </div>
              </div>
              <div style="margin-top:12px;">
                <div style="font-size:11px; font-weight:600; color:var(--muted); margin-bottom:6px; text-transform:uppercase;">Action Taken</div>
                <div style="font-size:12px;">${_actionBadge(action)} at ${_fmtLogTime(log.flaggedAt || log.timestamp || log.ts)}</div>
              </div>
            </td>
          </tr>`;

        return `
          <tr class="log-row" onclick="toggleLogDetail('${id}')" style="border-bottom: 1px solid var(--border);">
            <td style="padding: 10px 12px; font-size: 12px; color:var(--muted); white-space:nowrap;">${_fmtLogTime(log.flaggedAt || log.timestamp || log.ts)}</td>
            <td style="padding: 10px 12px; font-size: 13px;">@${_escHtml(username)}</td>
            <td style="padding: 10px 12px; font-size: 12px; color:var(--ink-soft); max-width:240px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${_escHtml(msg)}">${_escHtml(snippet)}</td>
            <td style="padding: 10px 12px; font-size: 12px;">${_escHtml(log.reason || log.matched || '—')}</td>
            <td style="padding: 10px 12px;"><span style="color:#dc2626; font-size:12px; font-weight:600;">${_escHtml(log.geminiVerdict || log.confidence || 'rule')}</span></td>
            <td style="padding: 10px 12px;">${_actionBadge(action)}</td>
          </tr>
          ${detailHtml}`;
      }).join('');
    }

window.toggleLogDetail = function(id) {
      const row = document.getElementById(id);
      if (!row) return;
      const isHidden = row.style.display === 'none';
      // Collapse all others first
      document.querySelectorAll('.log-detail').forEach(r => r.style.display = 'none');
      row.style.display = isHidden ? 'table-row' : 'none';
    };

window.setLogsFilter = function(filter, btn) {
      _logsFilter = filter;
      document.querySelectorAll('.logs-filter-btn').forEach(b => b.classList.remove('active'));
      btn?.classList.add('active');
      renderLogs(_logsCache);
    };

async function loadLogs(chatId) {
      if (!chatId) return;
      document.getElementById('logsSpinner').style.display    = 'block';
      document.getElementById('logsEmptyState').style.display = 'none';
      document.getElementById('logsTable').innerHTML          = '';

      try {
        const idToken = await auth.currentUser?.getIdToken().catch(() => null);
        const res = await fetch(`${workerUrl}/admin/moderation-logs?chatId=${chatId}`, { credentials: 'include',
          headers: { 'Authorization': `Bearer ${idToken}` }
        });
        const data = await res.json();
        _logsCache = data.ok ? (data.logs || []) : [];
        renderLogs(_logsCache);
      } catch (_err) {
        window.showMessage('moderationMessage', 'Error loading moderation logs', 'error');
        _logsCache = [];
        renderLogs([]);
      } finally {
        document.getElementById('logsSpinner').style.display = 'none';
      }
    }

function _startLogsRefresh(chatId) {
      _stopLogsRefresh();
      _logsRefreshTimer = setInterval(() => {
        if (document.getElementById('modLogs')?.style.display !== 'none') {
          loadLogs(chatId);
        } else {
          _stopLogsRefresh();
        }
      }, 60_000);
    }

function _stopLogsRefresh() {
      if (_logsRefreshTimer) { clearInterval(_logsRefreshTimer); _logsRefreshTimer = null; }
    }

async function loadMessages(chatId) {
      try {
        const idToken = await auth.currentUser?.getIdToken().catch(() => null);
        const res = await fetch(`${workerUrl}/admin/group-settings?chatId=${chatId}`, { credentials: 'include',
          headers: { 'Authorization': `Bearer ${idToken}` }
        });
        const data = await res.json();
        const levels = data.ok && data.settings?.warningMessages?.levels?.length
          ? data.settings.warningMessages.levels
          : DEFAULT_MESSAGE_LEVELS;
        renderMessageLevels(levels);
      } catch (_err) {
        renderMessageLevels(DEFAULT_MESSAGE_LEVELS);
        window.showMessage('moderationMessage', 'Could not load saved messages — showing defaults', 'warn');
      }
    }

async function loadReactions(chatId) {
      try {
        const idToken = await auth.currentUser?.getIdToken().catch(() => null);
        const res = await fetch(`${workerUrl}/admin/group-settings?chatId=${chatId}`, { credentials: 'include',
          headers: { 'Authorization': `Bearer ${idToken}` }
        });
        const data = await res.json();
        if (data.ok && data.settings) {
          populateReactions(data.settings.reactions || { enabled: false, rules: [] });
        }
      } catch (err) {
        console.error('Error loading reactions:', err);
      }
    }

function populateReactions(reactions) {
      document.getElementById('reactionsEnabled').checked = reactions.enabled || false;
      const defaults = {
        'happy birthday': '🎂',
        'congratulations': '🎉',
        'welcome': '👋',
        'thank you': '🙏',
        'good morning': '☀️'
      };
      const rules = reactions.rules && reactions.rules.length > 0 ? reactions.rules : Object.entries(defaults).map(([k, v]) => ({ keyword: k, emoji: v }));
      renderReactionsTable(rules);
    }

function renderReactionsTable(rules) {
      const tbody = document.getElementById('reactionsTable');
      tbody.innerHTML = rules.map(rule => `
        <tr style="border-bottom: 1px solid var(--border);">
          <td style="padding: 12px;"><input type="text" value="${rule.keyword}" class="reaction-keyword" style="width: 100%; padding: 6px; border: 1px solid var(--border); border-radius: 4px; font-size: 13px;" /></td>
          <td style="padding: 12px;"><input type="text" value="${rule.emoji}" class="reaction-emoji" style="width: 100%; padding: 6px; border: 1px solid var(--border); border-radius: 4px; font-size: 13px; text-align: center;" maxlength="2" /></td>
          <td style="padding: 12px; text-align: center;"><button onclick="removeReactionRule(this)" style="background: #fee; color: #c33; border: none; border-radius: 4px; padding: 6px 12px; cursor: pointer; font-weight: 600;">Remove</button></td>
        </tr>
      `).join('');
    }

window.addReactionRule = function() {
      const tbody = document.getElementById('reactionsTable');
      const newRow = document.createElement('tr');
      newRow.style.borderBottom = '1px solid var(--border)';
      newRow.innerHTML = `
        <td style="padding: 12px;"><input type="text" placeholder="keyword" class="reaction-keyword" style="width: 100%; padding: 6px; border: 1px solid var(--border); border-radius: 4px; font-size: 13px;" /></td>
        <td style="padding: 12px;"><input type="text" placeholder="emoji" class="reaction-emoji" style="width: 100%; padding: 6px; border: 1px solid var(--border); border-radius: 4px; font-size: 13px; text-align: center;" maxlength="2" /></td>
        <td style="padding: 12px; text-align: center;"><button onclick="removeReactionRule(this)" style="background: #fee; color: #c33; border: none; border-radius: 4px; padding: 6px 12px; cursor: pointer; font-weight: 600;">Remove</button></td>
      `;
      tbody.appendChild(newRow);
    };

window.removeReactionRule = function(btn) {
      btn.closest('tr').remove();
    };

window.saveReactions = async function() {
      const chatId = document.getElementById('modGroupSelect').value;
      if (!chatId) return;

      const rules = Array.from(document.querySelectorAll('#reactionsTable tr')).map(row => ({
        keyword: row.querySelector('.reaction-keyword').value.trim(),
        emoji: row.querySelector('.reaction-emoji').value.trim()
      })).filter(r => r.keyword && r.emoji);

      const reactions = {
        enabled: document.getElementById('reactionsEnabled').checked,
        rules: rules
      };

      try {
        const idToken = await auth.currentUser?.getIdToken().catch(() => null);
        const settings = {
          chatId,
          botActive: document.getElementById('botActive').checked,
          reactions: reactions,
          thresholds: {
            warn: parseInt(document.getElementById('warnAt').value),
            mute: parseInt(document.getElementById('muteAt').value),
            muteDuration: parseInt(document.getElementById('muteDuration').value),
            ban: parseInt(document.getElementById('banLimit').value)
          },
          gemini: {
            enabled: document.getElementById('geminiEnabled').checked,
            sensitivity: document.getElementById('geminiSensitivity').value,
            contextMessages: parseInt(document.getElementById('geminiContextMessages').value)
          },
          keywords: {
            predefined: {
              spam: document.getElementById('kw-spam').checked,
              abuse: document.getElementById('kw-abuse').checked,
              links: document.getElementById('kw-links').checked,
              ads: document.getElementById('kw-ads').checked,
              hate: document.getElementById('kw-hate').checked
            },
            custom: Array.from(document.querySelectorAll('#customKeywordsList > div')).map(el => el.textContent.replace('×', '').trim())
          },
          warningMessages: {
            dmThreshold: parseInt(document.getElementById('dmThreshold').value),
            notifyAdminFrom: parseInt(document.getElementById('notifyAdminFrom').value),
            levels: collectMessageLevels()
          }
        };

        const res = await fetch(`${workerUrl}/admin/group-settings`, { credentials: 'include',
          method: 'POST',
          headers: { 'Authorization': `Bearer ${idToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(settings)
        });
        const data = await res.json();
        window.showMessage('moderationMessage', data.ok ? '✅ Reactions saved!' : 'Error saving reactions', data.ok ? 'success' : 'error');
      } catch (_err) {
        window.showMessage('moderationMessage', 'Error saving reactions', 'error');
      }
    };

// Plain (non-window) declarations above are not global by default in a
// module — expose the ones admin.html calls by bare name or via onclick="".
window.loadModGroups = loadModGroups;
window.saveBotSettings = saveBotSettings;
window.testBotConnection = testBotConnection;
window.filterModConfigCards = filterModConfigCards;
window.loadModConfig = loadModConfig;
window.loadKeywords = loadKeywords;
window.loadViolations = loadViolations;
window.renderViolations = renderViolations;
window.renderMembers = renderMembers;
window.populateModSettings = populateModSettings;
window.renderCustomKeywords = renderCustomKeywords;
