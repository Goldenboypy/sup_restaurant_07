/**
 * guest/categories.js
 * Behavior for categories.html -- Step 2 of the guest flow.
 * GET /api/guest/menu/categories -> renders the 7-category grid
 * (Breakfast | Lunch | Dinner | Offers | Desserts | Soups | Drinks).
 * Tapping a card navigates to products.html for that category.
 *
 * Expects in the DOM:
 *   <div id="categoryGrid" class="category-grid"></div>
 * Optionally rendered server-side already (Django template fallback);
 * in that case this script only re-hydrates click handlers and skips
 * fetching again.
 */
(function () {
  "use strict";

  const CACHE_KEY = "guest.categoriesCache";
  const CACHE_TTL_MS = 60_000;

  function cardTemplate(category) {
    const el = document.createElement("a");
    el.href = `/menu/categories/${category.id}/`;
    el.className = "category-card" + (category.slug === "offers" ? " category-card--offers" : "");
    el.setAttribute("data-category-id", String(category.id));
    el.innerHTML = `
      <img class="category-card__image" src="${category.image_url}" alt="" loading="lazy">
      <span class="category-card__label">
        ${category.name}
        <span class="category-card__count">${category.item_count} items</span>
      </span>
    `;
    return el;
  }

  function renderSkeleton(grid, count = 7) {
    grid.innerHTML = "";
    for (let i = 0; i < count; i += 1) {
      const skel = document.createElement("div");
      skel.className = "category-card skeleton";
      grid.appendChild(skel);
    }
  }

  function render(grid, categories) {
    grid.innerHTML = "";
    if (!categories.length) {
      grid.replaceWith(emptyState());
      return;
    }
    const fragment = document.createDocumentFragment();
    categories.forEach((category) => fragment.appendChild(cardTemplate(category)));
    grid.appendChild(fragment);
  }

  function emptyState() {
    const el = document.createElement("div");
    el.className = "empty-state";
    el.innerHTML = `
      <h2>Menu is being updated</h2>
      <p>Please ask a member of staff, or check back in a moment.</p>
    `;
    return el;
  }

  function readCache() {
    try {
      const raw = sessionStorage.getItem(CACHE_KEY);
      if (!raw) return null;
      const { data, ts } = JSON.parse(raw);
      if (Date.now() - ts > CACHE_TTL_MS) return null;
      return data;
    } catch (_) {
      return null;
    }
  }

  document.addEventListener("DOMContentLoaded", async () => {
    const grid = document.getElementById("categoryGrid");
    if (!grid) return;

    const cached = readCache();
    if (cached?.categories?.length) {
      render(grid, cached.categories);
    } else {
      renderSkeleton(grid);
    }

    try {
      const { data } = await window.Guest.api("/menu/categories");
      render(grid, data.categories ?? []);
    } catch (err) {
      if (!cached) {
        grid.replaceWith(emptyState());
      }
      console.error("[categories.js] failed to load categories", err);
    }
  });
})();