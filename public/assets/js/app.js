const state = {
  user: null,
  books: [],
  selectedCategory: 'all',
};

const toastEl = document.getElementById('toast');

function showToast(message) {
  if (!toastEl) return;
  toastEl.textContent = message;
  toastEl.classList.remove('hidden');
  setTimeout(() => {
    toastEl.classList.add('hidden');
  }, 2400);
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    ...options,
  });

  const data = await response.json().catch(() => ({ message: 'Request failed.' }));
  if (!response.ok) {
    throw new Error(data.message || 'Unexpected error.');
  }

  return data;
}

function escapeHtml(value) {
  return String(value || '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[char]));
}

function renderBookGrid() {
  const grid = document.getElementById('bookGrid');
  if (!grid) return;

  if (!state.books.length) {
    grid.innerHTML = '<div class="empty-state">No books are currently available. Check back soon for new student listings.</div>';
    return;
  }

  const filtered = state.selectedCategory === 'all'
    ? state.books
    : state.books.filter((book) => (book.category || '').toLowerCase() === state.selectedCategory.toLowerCase());

  grid.innerHTML = filtered.map((book) => `
    <article class="book-card">
      <figure>
        <img class="book-cover" src="${book.cover_image || 'https://images.unsplash.com/photo-1512820790803-83ca734da794?auto=format&fit=crop&w=800&q=80'}" alt="${escapeHtml(book.title)}" />
      </figure>
      <div class="book-info">
        <h3>${escapeHtml(book.title)}</h3>
        <div class="meta-row">
          <span>${escapeHtml(book.author)}</span>
          <span>${escapeHtml(book.condition)}</span>
        </div>
        <div class="meta-row">
          <span>Edition: ${escapeHtml(book.edition || 'N/A')}</span>
          <span>${escapeHtml(book.city || 'Local')}</span>
        </div>
        <div class="price-row">
          <span>₹${Number(book.expected_selling_price || 0).toFixed(2)}</span>
          <span>₹${Number(book.original_price || 0).toFixed(2)} original</span>
        </div>
        <div class="book-actions">
          <button class="secondary-btn" data-book-id="${book.id}">View Details</button>
          <button class="link-btn" data-wishlist-book="${book.id}">Wishlist</button>
        </div>
      </div>
    </article>
  `).join('');
}

async function loadBooks() {
  try {
    const query = state.selectedCategory === 'all' ? '' : `?category=${encodeURIComponent(state.selectedCategory)}`;
    const data = await fetchJson(`/api/books${query}`);
    state.books = data.books || [];
    renderBookGrid();
  } catch (error) {
    console.error(error);
    showToast(error.message);
  }
}

async function loadUser() {
  try {
    const data = await fetchJson('/api/auth/me');
    state.user = data.user;
    renderUserState();
  } catch (error) {
    console.error(error);
  }
}

function renderUserState() {
  const dashboardShell = document.getElementById('dashboardShell');
  const buyerDashboard = document.getElementById('buyerDashboard');
  const sellerDashboard = document.getElementById('sellerDashboard');
  const adminDashboard = document.getElementById('adminDashboard');
  const loginBtn = document.getElementById('showLoginBtn');
  const registerBtn = document.getElementById('showRegisterBtn');
  const logoutBtn = document.getElementById('logoutBtn');

  if (!state.user) {
    dashboardShell?.classList.add('hidden');
    buyerDashboard?.classList.add('hidden');
    sellerDashboard?.classList.add('hidden');
    adminDashboard?.classList.add('hidden');
    loginBtn?.classList.remove('hidden');
    registerBtn?.classList.remove('hidden');
    logoutBtn?.classList.add('hidden');
    return;
  }

  dashboardShell?.classList.remove('hidden');
  loginBtn?.classList.add('hidden');
  registerBtn?.classList.add('hidden');
  logoutBtn?.classList.remove('hidden');

  if (state.user.role === 'buyer' || state.user.role === 'seller' || state.user.role === 'admin') {
    fetchDashboard();
  }
}

async function fetchDashboard() {
  try {
    if (state.user.role === 'buyer') {
      const data = await fetchJson('/api/dashboard/buyer');
      renderBuyerDashboard(data);
      return;
    }

    if (state.user.role === 'seller') {
      const data = await fetchJson('/api/dashboard/seller');
      renderSellerDashboard(data);
      return;
    }

    if (state.user.role === 'admin') {
      const data = await fetchJson('/api/dashboard/admin');
      renderAdminDashboard(data);
    }
  } catch (error) {
    console.error(error);
    showToast(error.message);
  }
}

function renderBuyerDashboard(data) {
  const dashboard = document.getElementById('buyerDashboard');
  const sellerDashboard = document.getElementById('sellerDashboard');
  const adminDashboard = document.getElementById('adminDashboard');
  if (!dashboard) return;

  sellerDashboard.classList.add('hidden');
  adminDashboard.classList.add('hidden');
  dashboard.classList.remove('hidden');

  dashboard.innerHTML = `
    <h2>Welcome back, ${escapeHtml(data.user.fullName || data.user.email)}</h2>
    <p>Find the books you need at prices you can afford.</p>
    <div class="dashboard-grid">
      <div class="metric-card"><span>Wishlist</span><strong>${data.stats.wishlistCount}</strong></div>
      <div class="metric-card"><span>Active requests</span><strong>${data.stats.activeRequests}</strong></div>
      <div class="metric-card"><span>Pending offers</span><strong>${data.stats.pendingOffers}</strong></div>
      <div class="metric-card"><span>Completed exchanges</span><strong>${data.stats.completedExchanges}</strong></div>
    </div>

    <div class="list-wrap">
      <h3>My wishlist</h3>
      ${data.wishlist && data.wishlist.length ? data.wishlist.map((book) => `
        <div class="list-item">
          <div>
            <strong>${escapeHtml(book.title)}</strong><br />
            <small>${escapeHtml(book.author)} • ${escapeHtml(book.condition)}</small>
          </div>
          <strong>₹${Number(book.expected_selling_price || 0).toFixed(2)}</strong>
        </div>
      `).join('') : '<div class="empty-state">No wishlist items yet. Save books that interest you.</div>'}
    </div>
  `;
}

function renderSellerDashboard(data) {
  const dashboard = document.getElementById('sellerDashboard');
  const buyerDashboard = document.getElementById('buyerDashboard');
  const adminDashboard = document.getElementById('adminDashboard');
  if (!dashboard) return;

  buyerDashboard.classList.add('hidden');
  adminDashboard.classList.add('hidden');
  dashboard.classList.remove('hidden');

  const metrics = `
    <h2>Welcome back, ${escapeHtml(data.user.fullName || data.user.email)}</h2>
    <p>Manage your books and help other students discover affordable resources.</p>
    <div class="dashboard-grid">
      <div class="metric-card"><span>Active listings</span><strong>${data.stats.activeListings}</strong></div>
      <div class="metric-card"><span>Pending offers</span><strong>${data.stats.pendingOffers}</strong></div>
      <div class="metric-card"><span>Completed sales</span><strong>${data.stats.completedSales}</strong></div>
      <div class="metric-card"><span>Seller earnings</span><strong>₹${Number(data.stats.totalEarnings || 0).toFixed(2)}</strong></div>
    </div>
  `;

  const listingCards = data.listings && data.listings.length ? data.listings.map((book) => `
    <div class="list-item">
      <div>
        <strong>${escapeHtml(book.title)}</strong><br />
        <small>${escapeHtml(book.condition)} • ₹${Number(book.expected_selling_price || 0).toFixed(2)}</small>
      </div>
      <div>
        <span>${escapeHtml(book.status || 'available')}</span>
      </div>
    </div>
  `).join('') : '<div class="empty-state">You have no listings yet. Add your first book to get started.</div>';

  dashboard.innerHTML = `
    ${metrics}
    <div class="form-block">
      <h3>Add new book</h3>
      <form id="sellerBookForm" class="form-grid three-columns">
        <label>Title<input name="title" required /></label>
        <label>Author<input name="author" required /></label>
        <label>Category<select name="category"><option>Engineering</option><option>Medical</option><option>IIT-JEE</option><option>NEET</option><option>UPSC</option><option>CAT</option><option>Management</option><option>General Academic</option></select></label>
        <label>Condition<select name="condition"><option>Like New</option><option>Good</option><option>Fair</option><option>Poor</option></select></label>
        <label>Original price<input name="originalPrice" type="number" min="1" required /></label>
        <label>Expected selling price<input name="expectedSellingPrice" type="number" min="1" required /></label>
        <label>City<input name="city" /></label>
        <label>Area<input name="area" /></label>
        <label>PIN code<input name="pinCode" /></label>
        <label class="full-width">Description<textarea name="description"></textarea></label>
        <label>Image URL<input name="images" /></label>
        <button class="btn btn-primary" type="submit">Add listing</button>
      </form>
    </div>
    <div class="list-wrap" style="margin-top:24px;">
      <h3>My listings</h3>
      ${listingCards}
    </div>
  `;

  document.getElementById('sellerBookForm')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const formData = new FormData(event.target);
    const payload = Object.fromEntries(formData.entries());
    payload.images = payload.images ? [payload.images] : [];

    try {
      await fetchJson('/api/books', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      showToast('Book listing added successfully.');
      await fetchDashboard();
      await loadBooks();
      event.target.reset();
    } catch (error) {
      showToast(error.message);
    }
  });
}

function renderAdminDashboard(data) {
  const dashboard = document.getElementById('adminDashboard');
  const buyerDashboard = document.getElementById('buyerDashboard');
  const sellerDashboard = document.getElementById('sellerDashboard');
  if (!dashboard) return;

  buyerDashboard.classList.add('hidden');
  sellerDashboard.classList.add('hidden');
  dashboard.classList.remove('hidden');

  dashboard.innerHTML = `
    <h2>StudySwap administration</h2>
    <div class="dashboard-grid">
      <div class="metric-card"><span>Users</span><strong>${data.users.length}</strong></div>
      <div class="metric-card"><span>Books</span><strong>${data.books.length}</strong></div>
      <div class="metric-card"><span>Exchanges</span><strong>${data.exchanges.length}</strong></div>
      <div class="metric-card"><span>Platform</span><strong>Live</strong></div>
    </div>

    <div class="list-wrap">
      <h3>Registered users</h3>
      ${data.users.map((user) => `
        <div class="list-item"><div><strong>${escapeHtml(user.full_name)}</strong><br /><small>${escapeHtml(user.email)}</small></div><span>${escapeHtml(user.role)}</span></div>
      `).join('') || '<div class="empty-state">No users yet.</div>'}
    </div>
  `;
}

async function handleAuthSubmit(event, mode) {
  event.preventDefault();
  const target = event.target;
  const formData = new FormData(target);
  const payload = Object.fromEntries(formData.entries());

  try {
    const response = await fetchJson(mode === 'login' ? '/api/auth/login' : '/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    const user = response.user;
    state.user = user;
    showToast(mode === 'login' ? 'Logged in successfully.' : 'Registration successful.');
    renderUserState();
    document.getElementById('authPanel')?.classList.add('hidden');
    target.reset();
    await loadBooks();
  } catch (error) {
    showToast(error.message);
  }
}

async function handleLogout() {
  try {
    await fetchJson('/api/auth/logout', { method: 'POST' });
    state.user = null;
    document.getElementById('dashboardShell')?.classList.add('hidden');
    document.getElementById('buyerDashboard')?.classList.add('hidden');
    document.getElementById('sellerDashboard')?.classList.add('hidden');
    document.getElementById('adminDashboard')?.classList.add('hidden');
    renderUserState();
    showToast('Logged out successfully.');
  } catch (error) {
    showToast(error.message);
  }
}

function toggleAuthPanels(type, selectedRole = 'buyer') {
  const loginForm = document.getElementById('loginForm');
  const registerForm = document.getElementById('registerForm');

  loginForm?.classList.toggle('active', type === 'login');
  registerForm?.classList.toggle('active', type === 'register');

  document.querySelectorAll('.role-btn').forEach((button) => {
    button.classList.toggle('active', button.dataset.role === selectedRole);
  });

  const roleSelect = document.querySelector('#registerForm select[name="role"]');
  if (roleSelect) {
    roleSelect.value = selectedRole;
  }
}

async function handlePricingEstimate(event) {
  event.preventDefault();
  const form = event.target;
  const payload = Object.fromEntries(new FormData(form).entries());

  try {
    const data = await fetchJson('/api/pricing/estimate', {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    const estimate = data.estimate;
    const result = document.getElementById('pricingResult');
    const suggestedRange = estimate.suggestedRange || {};
    result.classList.remove('empty');
    result.innerHTML = `
      <strong>${escapeHtml(estimate.recommendationText)}</strong><br />
      <div style="margin-top:10px;">Suggested price: ₹${Number(estimate.hybridEstimate || 0).toFixed(2)}</div>
      <div>Fair range: ₹${Number(suggestedRange.min || 0).toFixed(2)} - ₹${Number(suggestedRange.max || 0).toFixed(2)}</div>
      <div>Math baseline: ₹${Number(estimate.mathEstimate || 0).toFixed(2)}</div>
      <div>Evidence: ${escapeHtml(estimate.evidenceLabel)} (${estimate.comparableSalesCount || 0} comparable sales)</div>
      <div style="margin-top:12px; font-size:0.95rem; color:#627089;">${escapeHtml(estimate.explanation)}</div>
    `;
  } catch (error) {
    showToast(error.message);
  }
}

async function handleSearch() {
  const value = document.getElementById('landingSearch')?.value || '';
  const query = value.trim() ? `?search=${encodeURIComponent(value)}` : '';

  try {
    const data = await fetchJson(`/api/books${query}`);
    state.books = data.books || [];
    renderBookGrid();
  } catch (error) {
    showToast(error.message);
  }
}

async function addBookToWishlist(bookId) {
  try {
    await fetchJson('/api/books/wishlist', {
      method: 'POST',
      body: JSON.stringify({ bookId }),
    });
    showToast('Book added to wishlist.');
  } catch (error) {
    showToast(error.message);
  }
}

function bindEvents() {
  const openAuthPanel = (mode, role = 'buyer') => {
    const panel = document.getElementById('authPanel');
    panel?.classList.remove('hidden');
    toggleAuthPanels(mode, role);
    const form = mode === 'login' ? document.getElementById('loginForm') : document.getElementById('registerForm');
    form?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  document.getElementById('showLoginBtn')?.addEventListener('click', (event) => {
    event.preventDefault();
    openAuthPanel('login');
  });

  document.getElementById('showRegisterBtn')?.addEventListener('click', (event) => {
    event.preventDefault();
    openAuthPanel('register');
  });

  document.getElementById('logoutBtn')?.addEventListener('click', handleLogout);

  document.querySelectorAll('.role-btn').forEach((button) => {
    button.addEventListener('click', () => {
      const role = button.dataset.role;
      toggleAuthPanels('register', role);
    });
  });

  document.getElementById('sellActionBtn')?.addEventListener('click', (event) => {
    event.preventDefault();
    openAuthPanel('register', 'seller');
  });

  document.getElementById('requestBookBtn')?.addEventListener('click', (event) => {
    event.preventDefault();
    document.getElementById('requestModal')?.classList.remove('hidden');
  });

  document.getElementById('searchBooksBtn')?.addEventListener('click', handleSearch);
  document.getElementById('landingSearch')?.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') handleSearch();
  });

  document.getElementById('loginForm')?.addEventListener('submit', (event) => handleAuthSubmit(event, 'login'));
  document.getElementById('registerForm')?.addEventListener('submit', (event) => handleAuthSubmit(event, 'register'));
  document.getElementById('pricingForm')?.addEventListener('submit', handlePricingEstimate);

  document.getElementById('requestBookForm')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const payload = Object.fromEntries(new FormData(event.target).entries());

    try {
      await fetchJson('/api/books/requests', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      showToast('Book request submitted successfully.');
      event.target.reset();
      document.getElementById('requestModal')?.classList.add('hidden');
    } catch (error) {
      showToast(error.message);
    }
  });

  document.querySelectorAll('[data-close-modal]').forEach((button) => {
    button.addEventListener('click', () => {
      const modalId = button.getAttribute('data-close-modal');
      document.getElementById(modalId)?.classList.add('hidden');
    });
  });

  document.getElementById('forgotPasswordBtn')?.addEventListener('click', async () => {
    const email = document.querySelector('#loginForm input[name="email"]')?.value;
    if (!email) {
      showToast('Enter your email before requesting a reset link.');
      return;
    }

    try {
      const data = await fetchJson('/api/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email }),
      });
      showToast(data.message || 'Reset token generated.');
    } catch (error) {
      showToast(error.message);
    }
  });

  document.querySelectorAll('.chip').forEach((chip) => {
    chip.addEventListener('click', async () => {
      state.selectedCategory = chip.dataset.category;
      document.querySelectorAll('.chip').forEach((item) => item.classList.toggle('active', item === chip));
      await loadBooks();
    });
  });

  document.getElementById('bookGrid')?.addEventListener('click', async (event) => {
    const wishlistBtn = event.target.closest('[data-wishlist-book]');
    if (wishlistBtn) {
      await addBookToWishlist(wishlistBtn.getAttribute('data-wishlist-book'));
      return;
    }

    const detailBtn = event.target.closest('[data-book-id]');
    if (detailBtn) {
      const bookId = detailBtn.getAttribute('data-book-id');
      const book = state.books.find((entry) => String(entry.id) === String(bookId));
      if (!book) {
        showToast('Book details are unavailable.');
        return;
      }

      const detailModal = document.getElementById('bookDetailModal');
      const detailContent = document.getElementById('bookDetailContent');
      detailContent.innerHTML = `
        <div class="book-detail">
          <img src="${book.cover_image || 'https://images.unsplash.com/photo-1512820790803-83ca734da794?auto=format&fit=crop&w=800&q=80'}" alt="${escapeHtml(book.title)}" style="max-height:320px; object-fit:cover; border-radius:18px; margin-bottom:16px;" />
          <h4>${escapeHtml(book.title)}</h4>
          <p><strong>Author:</strong> ${escapeHtml(book.author)}</p>
          <p><strong>Category:</strong> ${escapeHtml(book.category)}</p>
          <p><strong>Condition:</strong> ${escapeHtml(book.condition)}</p>
          <p><strong>Original price:</strong> ₹${Number(book.original_price || 0).toFixed(2)}</p>
          <p><strong>Seller price:</strong> ₹${Number(book.expected_selling_price || 0).toFixed(2)}</p>
          <p><strong>Location:</strong> ${escapeHtml(book.city || 'Local')} • ${escapeHtml(book.area || '')}</p>
          <p>${escapeHtml(book.description || 'No description provided by the seller.')}</p>
        </div>
      `;
      detailModal?.classList.remove('hidden');
    }
  });

  document.getElementById('requestBookModalBtn')?.addEventListener('click', () => {
    document.getElementById('requestModal')?.classList.remove('hidden');
  });
}

async function loadOverviewStats() {
  try {
    const data = await fetchJson('/api/dashboard/overview');
    const stats = data.stats || {};

    const reusedCountEl = document.getElementById('reusedCount');
    const sellerCountEl = document.getElementById('sellerCount');
    const savingCountEl = document.getElementById('savingCount');

    if (reusedCountEl) reusedCountEl.textContent = Number(stats.reusedCount || 0);
    if (sellerCountEl) sellerCountEl.textContent = Number(stats.sellerCount || 0);
    if (savingCountEl) savingCountEl.textContent = `₹${Number(stats.savings || 0).toFixed(2)}`;
  } catch (error) {
    console.error(error);
  }
}

async function boot() {
  bindEvents();
  await loadBooks();
  await loadUser();
  await loadOverviewStats();
}

boot();
