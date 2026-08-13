/**
 * guest/products.js
 * Behavior for products.html -- Step 3 of the guest flow.
 * GET /api/guest/menu/categories/:id/items -> photo grid of all items
 * in that category (photo, name, price), laid out like an Amazon
 * search-results page. Tapping a product navigates to product_detail.html.
 *
 * Expects in the DOM (rendered server-side by guest_api/views.py):
 *   <div id="productGrid"
 *        class="product-grid"
 *        data-category-id="{{ category.id }}"
 *        data-category-name="{{ category.name }}"></div>
 */
(function () {
  "use strict";

  function cardTemplate(item, categoryId) {
    const el = document.createElement("a");
    el.href = `/menu/categories/${categoryId}/items/${item.id}/`;
    el.className = "product-card";
    el.setAttribute("data-item-id", String(item.id));
    el.innerHTML = `
      <img class="product-card__image" src="${item.image_url}" alt="" loading="lazy">
      <div class="product-card__body">
        <span class="product-card__name">${item.name}</span>
        <span class="product-card__price">${item.price_display}</span>
      </div>
    `;
    return el;
  }

  function renderSkeleton(grid, count = 8) {
    grid.innerHTML = "";
    for (let i = 0; i < count; i += 1) {
      const skel = document.createElement("div");
      skel.className = "product-card skeleton";
      grid.appendChild(skel);
    }
  }

  function renderEmpty(grid, categoryName) {
    grid.innerHTML = "";
    const el = document.createElement("div");
    el.className = "empty-state";
    el.innerHTML = `
      <h2>No items in ${categoryName || "this category"} right now</h2>
      <p>Try another category from the menu.</p>
      <a class="btn btn--secondary" href="/menu/">Back to Categories</a>
    `;
    grid.appendChild(el);
  }

  document.addEventListener("DOMContentLoaded", async () => {
    const grid = document.getElementById("productGrid");
    if (!grid) return;

    const categoryId = grid.dataset.categoryId;
    const categoryName = grid.dataset.categoryName;
    if (!categoryId) {
      console.error("[products.js] #productGrid is missing data-category-id");
      return;
    }

    renderSkeleton(grid);

    try {
      const { data } = await window.Guest.api(`/menu/categories/${categoryId}/items`);
      const items = data.items ?? [];
      if (!items.length) {
        renderEmpty(grid, categoryName);
        return;
      }
      grid.innerHTML = "";
      const fragment = document.createDocumentFragment();
      items.forEach((item) => fragment.appendChild(cardTemplate(item, categoryId)));
      grid.appendChild(fragment);
    } catch (err) {
      console.error("[products.js] failed to load category items", err);
      renderEmpty(grid, categoryName);
      window.Guest.toast("Could not load this category. Pull down to retry.", { type: "error" });
    }
  });
})();