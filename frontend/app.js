const $ = id => document.getElementById(id);
let token = '', user = null, expiresAt = 0, registerMode = false, page = 1;
let listRequest = 0, detailRequest = 0;
let filters = { search: '', status: 'all', mine: 'false' };
function node(tag, value, className) {
  const el = document.createElement(tag);
  if (value !== undefined) el.textContent = value;
  if (className) el.className = className;
  return el;
}
function notice(message) { $('notice').textContent = message; $('notice').hidden = !message; }
function resetSession() {
  token = ''; user = null; expiresAt = 0; listRequest++; detailRequest++;
  document.querySelectorAll('dialog[open]').forEach(dialog => dialog.close());
  $('workspace').hidden = true; $('account').hidden = true; $('auth').hidden = false;
  $('poll-list').replaceChildren(); $('detail').replaceChildren();
}
async function api(path, { method = 'GET', body } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (method !== 'GET') headers['Content-Type'] = 'application/json';
  const response = await fetch(`/api${path}`, { method, headers,
    body: method === 'GET' ? undefined : JSON.stringify(body || {}), cache: 'no-store' });
  const data = await response.json().catch(() => ({ error: 'Unexpected server response.' }));
  if (!response.ok) {
    if (response.status === 401 && token) {
      resetSession(); notice('Your session ended. Sign in again.');
    }
    throw new Error(data.error || 'Request failed.');
  }
  return data;
}
async function busy(button, action, errorId) {
  button.disabled = true;
  try { await action(); }
  catch (error) {
    if (errorId && $(errorId).closest('dialog')?.open) $(errorId).textContent = error.message;
    else notice(error.message);
  } finally { button.disabled = false; }
}
function confirmAction(message) {
  $('confirm-message').textContent = message;
  return new Promise(resolve => {
    const dialog = $('confirm-dialog');
    $('confirm-yes').onclick = () => { dialog.returnValue = 'yes'; dialog.close(); };
    $('confirm-no').onclick = () => { dialog.returnValue = 'no'; dialog.close(); };
    dialog.addEventListener('close', () => resolve(dialog.returnValue === 'yes'), { once: true });
    dialog.returnValue = 'no'; dialog.showModal();
  });
}
$('switch-auth').onclick = () => {
  registerMode = !registerMode;
  $('auth-title').textContent = registerMode ? 'Join the polling room' : 'Welcome back';
  $('auth-help').textContent = registerMode ? 'Use an email you can confirm. Password: 8–128 characters.' : 'Sign in to browse and vote.';
  $('password').autocomplete = registerMode ? 'new-password' : 'current-password';
  $('auth-submit').textContent = registerMode ? 'Create account' : 'Sign in';
  $('switch-auth').textContent = registerMode ? 'Already registered? Sign in' : 'Create an account';
};
$('auth-form').onsubmit = event => {
  event.preventDefault();
  busy($('auth-submit'), async () => {
    const data = await api(registerMode ? '/auth/register' : '/auth/login', { method: 'POST',
      body: { email: $('auth-email').value, password: $('password').value } });
    $('password').value = '';
    if (registerMode) { notice(data.message); return; }
    token = data.token; user = data.user; expiresAt = data.expires_at * 1000;
    $('email').textContent = user.email; $('auth').hidden = true;
    $('workspace').hidden = false; $('account').hidden = false;
    page = 1; filters = { search: '', status: 'all', mine: 'false' };
    $('filters').reset(); notice(''); await loadPolls();
  });
};
// Token exists only in this tab's memory. No cookies, localStorage, or refresh tokens.
$('logout').onclick = () => { resetSession(); notice('Logged out of this tab.'); };
setInterval(() => {
  if (token && Date.now() >= expiresAt) { resetSession(); notice('Session expired. Sign in again.'); }
}, 15000);
async function loadPolls() {
  const request = ++listRequest;
  $('previous').disabled = true; $('next').disabled = true;
  $('poll-list').setAttribute('aria-busy', 'true'); $('list-status').textContent = 'Loading polls…';
  try {
    const data = await api(`/polls?${new URLSearchParams({ ...filters, page })}`);
    if (request !== listRequest || !token) return;
    $('poll-list').replaceChildren();
    $('list-status').textContent = data.total ? `${data.total} poll(s) found` : 'No polls match. Try different filters or create the first poll.';
    for (const poll of data.items) {
      const card = node('article', undefined, 'card');
      card.append(node('div', poll.closed ? 'Closed' : 'Open', `badge${poll.closed ? ' closed' : ''}`));
      card.append(node('h3', poll.title), node('p', poll.description.slice(0, 140) || 'A question for the community.'));
      card.append(node('p', `Closes ${new Date(poll.ends_at).toLocaleString()}`, 'meta'));
      card.append(node('p', [poll.is_owner ? 'Created by you' : '', poll.has_voted ? 'Vote recorded' : ''].filter(Boolean).join(' · '), 'meta'));
      const button = node('button', poll.closed ? 'View results' : 'Open poll');
      button.onclick = () => openPoll(poll.id); card.append(button); $('poll-list').append(card);
    }
    $('page-info').textContent = `Page ${page} of ${Math.max(1, Math.ceil(data.total / data.page_size))}`;
    $('previous').disabled = page <= 1; $('next').disabled = page * data.page_size >= data.total;
  } catch (error) { if (request === listRequest) { $('list-status').textContent = 'Could not load polls. Apply filters to retry.'; notice(error.message); } }
  finally { if (request === listRequest) $('poll-list').setAttribute('aria-busy', 'false'); }
}
$('filters').onsubmit = event => {
  event.preventDefault(); page = 1;
  filters = { search: $('search').value.trim(), status: $('status').value, mine: String($('mine').checked) };
  loadPolls();
};
$('previous').onclick = () => { if (page > 1) { page--; loadPolls(); } };
$('next').onclick = () => { page++; loadPolls(); };
for (const button of document.querySelectorAll('[data-close]')) button.onclick = () => $(button.dataset.close).close();
$('new-poll').onclick = () => {
  $('create-form').reset(); $('create-error').textContent = '';
  const nextDay = new Date(Date.now() + 86400000);
  const local = new Date(nextDay.getTime() - nextDay.getTimezoneOffset() * 60000);
  $('deadline').value = local.toISOString().slice(0, 16); $('create-dialog').showModal();
};
$('create-form').onsubmit = event => {
  event.preventDefault(); $('create-error').textContent = '';
  busy(event.submitter, async () => {
    const date = new Date($('deadline').value);
    if (!Number.isFinite(date.getTime())) throw new Error('Choose a closing time.');
    const data = await api('/polls', { method: 'POST', body: {
      title: $('question').value, description: $('description').value,
      options: $('choices').value.split(/\r?\n/).map(value => value.trim()).filter(Boolean),
      ends_at: date.toISOString()
    } });
    $('create-dialog').close(); notice('Poll published. Share its question with your classmates.');
    page = 1; await loadPolls(); await openPoll(data.id);
  }, 'create-error');
};
async function openPoll(id) {
  const request = ++detailRequest;
  $('detail').replaceChildren(node('p', 'Loading poll…')); $('detail-error').textContent = '';
  $('detail').setAttribute('aria-busy', 'true');
  if (!$('detail-dialog').open) $('detail-dialog').showModal();
  try {
    const poll = await api(`/polls/${id}`);
    if (request !== detailRequest || !token || !$('detail-dialog').open) return;
    $('detail-title').textContent = poll.title;
    const target = $('detail'); target.replaceChildren(node('p', poll.description));
    target.append(node('p', `${poll.closed ? 'Closed' : 'Open'} · Scheduled close: ${new Date(poll.ends_at).toLocaleString()}`, 'meta'));
    if (poll.closed) {
      target.append(node('h3', `${poll.total_votes} vote(s) recorded`));
      const highest = Math.max(...poll.options.map(option => option.votes));
      const winners = poll.options.filter(option => option.votes === highest).map(option => option.label);
      target.append(node('p', poll.total_votes === 0 ? 'No votes were cast.' : `${winners.length > 1 ? 'Tie' : 'Top choice'}: ${winners.join(', ')}`));
      for (const option of poll.options) {
        const percent = poll.total_votes ? option.votes / poll.total_votes * 100 : 0;
        const row = node('div', undefined, 'result');
        row.append(node('strong', option.label), node('p', `${option.votes} vote(s) · ${percent.toFixed(1)}%`));
        const progress = document.createElement('progress'); progress.max = 100; progress.value = percent;
        progress.setAttribute('aria-label', `${option.label}: ${percent.toFixed(1)} percent`);
        row.append(progress); target.append(row);
      }
    } else {
      target.append(node('p', poll.has_voted ? 'Your vote is recorded. Results appear after closing.' : 'Choose carefully. You can vote once and cannot change your vote.'));
      const form = node('form'), fieldset = node('fieldset');
      fieldset.append(node('legend', 'Available choices'));
      for (const option of poll.options) {
        const label = node('label', undefined, 'option'), radio = document.createElement('input');
        radio.type = 'radio'; radio.name = 'choice'; radio.value = option.id; radio.required = true;
        radio.disabled = poll.has_voted; label.append(radio, node('span', option.label)); fieldset.append(label);
      }
      form.append(fieldset);
      if (!poll.has_voted) {
        const voteButton = node('button', 'Submit vote'); voteButton.type = 'submit'; form.append(voteButton);
        form.onsubmit = event => {
          event.preventDefault();
          busy(voteButton, async () => {
            const choice = new FormData(form).get('choice');
            if (!choice) throw new Error('Select a choice.');
            if (!await confirmAction('Submit this vote? Your choice cannot be changed.')) return;
            await api(`/polls/${id}/votes`, { method: 'POST', body: { option_id: choice } });
            await openPoll(id); await loadPolls();
          }, 'detail-error');
        };
      }
      target.append(form);
    }
    const actions = node('div', undefined, 'actions');
    const refresh = node('button', 'Refresh poll', 'secondary'); refresh.onclick = () => openPoll(id); actions.append(refresh);
    if (poll.is_owner && !poll.closed) {
      const close = node('button', 'Close voting', 'secondary');
      close.onclick = () => busy(close, async () => {
        if (!await confirmAction('Close voting now? It cannot be reopened.')) return;
        await api(`/polls/${id}/close`, { method: 'PATCH' }); await openPoll(id); await loadPolls();
      }, 'detail-error'); actions.append(close);
    }
    if (poll.can_delete) {
      const remove = node('button', 'Delete empty poll', 'danger');
      remove.onclick = () => busy(remove, async () => {
        if (!await confirmAction('Permanently delete this empty poll?')) return;
        await api(`/polls/${id}`, { method: 'DELETE' }); $('detail-dialog').close();
        notice('Poll deleted.'); await loadPolls();
      }, 'detail-error'); actions.append(remove);
    }
    target.append(actions);
  } catch (error) {
    if (request === detailRequest) { $('detail').replaceChildren(); $('detail-error').textContent = error.message; }
  } finally { if (request === detailRequest) $('detail').setAttribute('aria-busy', 'false'); }
}
