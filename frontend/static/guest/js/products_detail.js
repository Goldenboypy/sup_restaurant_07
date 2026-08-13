/**
 * guest/product_detail.js
 * Behavior for product_detail.html -- Step 4 of the guest flow.
 * GET /api/guest/menu/items/:id -> large photo + ingredient list.
 * Wires the three bottom buttons:
 *   [ Back to Category List ]  -> data-nav="back" (handled by base.js)
 *   [ Configure Order ]        -> navigate to configure_order.html
 *   [ Order ]                  -> POST /api/guest/cart/items, no
 *                                  modifications, then return to the
 *                                  Category List the product came from
 *                                  (Step 5 of the guest flow).
 *
 * Expects in the DOM (rendered server-side by guest_api/views.py):
 *   <div id="productDetail"
 *        data-item-id="{{ item.id }}"
 *        data-category-id="{{ category.id }}">
 *     <img class="product-detail__photo" alt="">
 *     <ul class="product-detail__ingredients"></ul>
 *     <button class="product-detail__configure-btn" type="button">Configure Order</button>
 *     <button class="product-detail__order-btn" type="button">Order</button>
 *   </div>
 */
(function () {
  "use strict";

  document.addEventListener("DOMContentLoaded", async () => {
    const root = document.getElementById("productDetail");
    if (!root) return;

    const itemId = root.dataset.itemId;
    const categoryId = root.dataset.categoryId;
    if (!itemId) {
      console.error("[product_detail.js] #productDetail is missing data-item-id");
      return;
    }

    const photoEl = root.querySelector(".product-detail__photo");
    const ingredientsEl = root.querySelector(".product-detail__ingredients");
    const configureBtn = root.querySelector(".product-detail__configure-btn");
    const orderBtn = root.querySelector(".product-detail__order-btn");

    try {
      const { data: item } = await window.Guest.api(`/menu/items/${itemId}`);

      if (photoEl) {
        photoEl.src = item.image_url;
        photoEl.alt = item.name;
      }
      if (ingredientsEl) {
        ingredientsEl.innerHTML = (item.ingredients ?? [])
          .map((ingredient) => `<li class="tag">${ingredient}</li>`)
          .join("");
      }

      // 4a. CONFIGURE ORDER -> exclusion checklist page for this item.
      configureBtn?.addEventListener("click", () => {
        window.location.href = `/menu/items/${itemId}/configure/`;
      });

      // 4b. ORDER (direct) -> item added to cart with no modifications.
      orderBtn?.addEventListener("click", async () => {
        orderBtn.disabled = true;
        try {
          await window.Guest.api("/cart/items", {
            method: "POST",
            body: { item_id: Number(itemId) },
          });
          await window.Guest.cart.refreshBadge();
          window.Guest.toast(`${item.name} added to cart`, { type: "success" });

          // Step 5: return to the Category List the product came from.
          window.location.href = categoryId ? `/menu/categories/${categoryId}/` : "/menu/";
        } catch (err) {
          console.error("[product_detail.js] failed to add item to cart", err);
          window.Guest.toast("Could not add this item. Please try again.", { type: "error" });
          orderBtn.disabled = false;
        }
      });
    } catch (err) {
      console.error("[product_detail.js] failed to load item detail", err);
      window.Guest.toast("Could not load this item.", { type: "error" });
      if (configureBtn) configureBtn.disabled = true;
      if (orderBtn) orderBtn.disabled = true;
    }
  });
})();